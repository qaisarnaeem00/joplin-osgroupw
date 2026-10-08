import { literalList, queryBuilder as qb, compileQuery, selectColumns } from '../services/database/kysely';
import BaseModel from '../BaseModel';
import { NoteEntity, SqlQuery } from '../services/database/types';
import BaseItem from './BaseItem';
import { LoadOptions } from './utils/types';

export type AssociatedResourceNote = Partial<NoteEntity> & {
	resource_id: string;
	note_id: string;
};

// - If is_associated = 1, note_resources indicates which note_id is currently associated with the given resource_id
// - If is_associated = 0, note_resources indicates which note_id *was* associated with the given resource_id
// - last_seen_time tells the last time that resource was associated with this note.
// - If last_seen_time is 0, it means the resource has never been associated with any note.

export default class NoteResource extends BaseModel {
	public static tableName() {
		return 'note_resources';
	}

	public static modelType() {
		return BaseModel.TYPE_NOTE_RESOURCE;
	}

	public static async applySharedStatusToLinkedResources() {
		const queries: SqlQuery[] = [];

		queries.push(compileQuery(qb.updateTable('resources').set(eb => ({ 'is_shared': eb.val(0) }))));

		queries.push(compileQuery(
			qb
				.updateTable('resources')
				.set(eb => ({ is_shared: eb.val(1) }))
				.where(eb =>
					eb(
						eb.ref('id'),
						'in',
						qb
							.selectFrom('notes')
							.select(['note_resources.resource_id'])
							.distinct()
							.innerJoin('note_resources', join =>
								join.on(eb => eb(eb.ref('notes.id'), '=', eb.ref('note_resources.note_id'))),
							)
							.where(eb => eb(eb.ref('notes.is_shared'), '=', eb.val(1))),
					),
				),
		));

		await this.db().transactionExecBatch(queries);
	}

	public static async associatedNoteIds(resourceId: string): Promise<string[]> {
		const rows = await this.modelSelectAll(compileQuery(
			qb
				.selectFrom('note_resources')
				.select(['note_id'])
				.where(eb =>
					eb.and([
						eb(eb.ref('resource_id'), '=', eb.val(resourceId)),
						eb(eb.ref('is_associated'), '=', eb.val(1)),
					]),
				),
		));
		return rows.map((r: { note_id: string }) => r.note_id);
	}

	public static async associatedResourceNotes(resourceIds: string[], options: LoadOptions = null): Promise<Record<string, AssociatedResourceNote[]>> {
		if (!resourceIds.length) return {};

		const fields: string[] = options && options.fields ? (options.fields as string[]).slice() : [];
		fields.push('resource_id');
		fields.push('note_id');

		const rows = await this.modelSelectAll(compileQuery(
			selectColumns(qb.selectFrom('note_resources'), { ...options, fields }?.fields || '*')
				.leftJoin('notes', join =>
					join.on(eb => eb(eb.ref('notes.id'), '=', eb.ref('note_resources.note_id'))),
				)
				.where(eb =>
					eb.and([
						eb(eb.ref('resource_id'), 'in', literalList(resourceIds)),
						eb(eb.ref('is_associated'), '=', eb.val(1)),
					]),
				),
		));

		const output: Record<string, AssociatedResourceNote[]> = {};
		for (const row of rows) {
			if (!output[row.resource_id]) output[row.resource_id] = [];
			output[row.resource_id].push(row);
		}

		return output;
	}

	public static async setAssociatedResources(noteId: string, resourceIds: string[]) {
		const existingRows = await this.modelSelectAll(compileQuery(qb.selectFrom('note_resources').selectAll().where(eb => eb(eb.ref('note_id'), '=', eb.val(noteId)))));

		const notProcessedResourceIds = resourceIds.slice();
		const queries = [];
		for (let i = 0; i < existingRows.length; i++) {
			const row = existingRows[i];
			const resourceIndex = resourceIds.indexOf(row.resource_id);

			if (resourceIndex >= 0) {
				queries.push(compileQuery(
					qb
						.updateTable('note_resources')
						.set(eb => ({ last_seen_time: eb.val(Date.now()), is_associated: eb.val(1) }))
						.where(eb => eb(eb.ref('id'), '=', eb.val(row.id))),
				));
				notProcessedResourceIds.splice(notProcessedResourceIds.indexOf(row.resource_id), 1);
			} else {
				queries.push(compileQuery(
					qb
						.updateTable('note_resources')
						.set(eb => ({ is_associated: eb.val(0) }))
						.where(eb => eb(eb.ref('id'), '=', eb.val(row.id))),
				));
			}
		}

		for (let i = 0; i < notProcessedResourceIds.length; i++) {
			queries.push(compileQuery(
				qb
					.insertInto('note_resources')
					.values(eb => ({
						note_id: eb.val(noteId),
						resource_id: eb.val(notProcessedResourceIds[i]),
						is_associated: eb.val(1),
						last_seen_time: eb.val(Date.now()),
					})),
			));
		}

		await this.db().transactionExecBatch(queries);
	}

	public static async addOrphanedResources() {
		const missingResources = await this.db().selectAll(compileQuery(
			qb
				.selectFrom('resources')
				.select(['id'])
				.where(eb =>
					eb.not(
						eb(eb.ref('id'), 'in', qb.selectFrom('note_resources').select(['resource_id']).distinct()),
					),
				),
		));
		const queries = [];
		for (let i = 0; i < missingResources.length; i++) {
			const id = missingResources[i].id;

			// If the resource is not associated with any note, and has never
			// been synced, it means it's a local resource that was removed from
			// a note (or the note was deleted). In which case, we set a
			// "last_seen_time", so that it can be considered an orphan resource
			// that can be auto-deleted.
			//
			// https://github.com/laurent22/joplin/issues/932#issuecomment-933736405

			const hasBeenSynced = await BaseItem.itemHasBeenSynced(id);
			const lastSeenTime = hasBeenSynced ? 0 : Date.now();

			queries.push(compileQuery(
				qb
					.insertInto('note_resources')
					.values(eb => ({
						note_id: eb.val(''),
						resource_id: eb.val(id),
						is_associated: eb.val(0),
						last_seen_time: eb.val(lastSeenTime),
					})),
			),
			);
		}
		await this.db().transactionExecBatch(queries);
	}

	public static async remove(noteId: string) {
		await this.db().exec(compileQuery(
			qb
				.updateTable('note_resources')
				.set(eb => ({ is_associated: eb.val(0) }))
				.where(eb => eb(eb.ref('note_id'), '=', eb.val(noteId))),
		));
	}

	public static async orphanResources(expiryDelay: number = null) {
		if (expiryDelay === null) expiryDelay = 1000 * 60 * 60 * 24 * 10;
		const cutOffTime = Date.now() - expiryDelay;
		const output = await this.modelSelectAll(
			compileQuery(
				qb
					.selectFrom('note_resources')
					.select(eb => ['resource_id', eb.fn('sum', [eb.ref('is_associated')]).as('sum(is_associated)')])
					.groupBy(['resource_id'])
					.having(eb =>
						eb.and([
							eb.and([
								eb(eb.fn('sum', [eb.ref('is_associated')]), '<=', eb.val(0)),
								eb(eb.ref('last_seen_time'), '<', eb.val(cutOffTime)),
							]),
							eb(eb.ref('last_seen_time'), '!=', eb.val(0)),
						]),
					),
			),
		);
		return output.map((r: { resource_id: string }) => r.resource_id);
	}

	public static async deleteByResource(resourceId: string) {
		await this.db().exec(compileQuery(qb.deleteFrom('note_resources').where(eb => eb(eb.ref('resource_id'), '=', eb.val(resourceId)))));
	}
}
