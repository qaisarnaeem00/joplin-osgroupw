import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 46 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(qb.schema.alterTable('notes').addColumn('deleted_time', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(
		qb.schema.alterTable('folders').addColumn('deleted_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.dropView('tags_with_note_count')),
	compileQuery(
		qb.schema.createView('tags_with_note_count').as(
			qb
				.selectFrom('tags')
				.select(eb => [
					eb.ref('tags.id').as('id'),
					eb.ref('tags.title').as('title'),
					eb.ref('tags.created_time').as('created_time'),
					eb.ref('tags.updated_time').as('updated_time'),
					eb.fn('count', [eb.ref('notes.id')]).as('note_count'),
					eb
						.fn('sum', [
							// eslint-disable-next-line promise/prefer-await-to-then -- This is Kysely's CASE builder, not a Promise.
							eb.case().when(sql.ref<number>('notes.todo_completed'), '>', 0).then(eb.val(1)).else(eb.val(0)).end(),
						])
						.as('todo_completed_count'),
				])
				.leftJoin('note_tags as nt', join => join.on(eb => eb(eb.ref('nt.tag_id'), '=', eb.ref('tags.id'))))
				.leftJoin('notes', join => join.on(eb => eb(eb.ref('notes.id'), '=', eb.ref('nt.note_id'))))
				.where(eb =>
					eb.and([
						eb.not(eb(eb.ref('notes.id'), 'is', eb.val(null))),
						eb(eb.ref('notes.deleted_time'), '=', eb.val(0)),
					]),
				)
				.groupBy(['tags.id']),
		),
	),
];
