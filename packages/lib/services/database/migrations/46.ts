import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('notes')
				.addColumn('deleted_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('folders')
				.addColumn('deleted_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
		compileQuery(queryBuilder.schema.dropView('tags_with_note_count')).sql,
		compileQuery(
			queryBuilder.schema.createView('tags_with_note_count').as(
				queryBuilder
					.selectFrom('tags')
					.leftJoin('note_tags as nt', (join) =>
						join.on((eb) => eb(sql.ref('nt.tag_id'), '=', sql.ref('tags.id'))),
					)
					.leftJoin('notes', (join) => join.on((eb) => eb(sql.ref('notes.id'), '=', sql.ref('nt.note_id'))))
					.select([
						sql.ref('tags.id').as('id'),
						sql.ref('tags.title').as('title'),
						sql.ref('tags.created_time').as('created_time'),
						sql.ref('tags.updated_time').as('updated_time'),
						queryBuilder.fn('count', [sql.ref('notes.id')]).as('note_count'),
						queryBuilder
							.fn('sum', [
								queryBuilder
									.case()
									.when(sql.ref('notes.todo_completed'), '>', sql.val(0))
									// eslint-disable-next-line promise/prefer-await-to-then -- Kysely CASE expression, not a Promise
									.then(sql.val(1))
									.else(sql.val(0))
									.end(),
							])
							.as('todo_completed_count'),
					])
					.where((eb) =>
						eb.and([
							eb(sql.ref('notes.id'), 'is not', sql.val(null)),
							eb(sql.ref('notes.deleted_time'), '=', sql.val(0)),
						]),
					)
					.groupBy(['tags.id']),
			),
		),
	];
};
