import { db, sql } from '../kysely';
import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	const view = db.selectFrom('tags').leftJoin('note_tags as nt', 'nt.tag_id', 'tags.id').leftJoin('notes', 'notes.id', 'nt.note_id')
		.select(['tags.id as id', 'tags.title as title', 'tags.created_time as created_time', 'tags.updated_time as updated_time'])
		.select(eb => [eb.fn.count('notes.id').as('note_count'),
			// eslint-disable-next-line promise/prefer-await-to-then -- Kysely CASE expression, not a Promise.
			eb.fn.sum(eb.case().when('notes.todo_completed', '>', sql.lit(0)).then(sql.lit(1)).else(sql.lit(0)).end()).as('todo_completed_count')])
		.where('notes.id', 'is not', null).where('notes.deleted_time', '=', sql.lit(0)).groupBy('tags.id');
	return [
		addColumn('notes', 'deleted_time', 'INT NOT NULL DEFAULT 0'),
		addColumn('folders', 'deleted_time', 'INT NOT NULL DEFAULT 0'),
		db.schema.dropView('tags_with_note_count'),
		db.schema.createView('tags_with_note_count').as(view),
	];
};
