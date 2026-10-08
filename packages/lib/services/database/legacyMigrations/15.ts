import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { virtualTable, trigger } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 15 schema and data changes.
export default (): SqlQuery[] => [
	virtualTable('notes_fts', 'fts4', 'content="notes", notindexed="id", id, title, body'),
	compileQuery(
		qb
			.insertInto('notes_fts')
			.columns(['docid', 'id', 'title', 'body'])
			.expression(
				qb
					.selectFrom('notes')
					.select(['rowid', 'id', 'title', 'body'])
					.where(eb =>
						eb.and([eb(eb.ref('is_conflict'), '=', eb.val(0)), eb(eb.ref('encryption_applied'), '=', eb.val(0))]),
					),
			),
	),
	trigger(
		'notes_fts_before_update',
		'BEFORE',
		'UPDATE',
		'notes',
		qb.deleteFrom('notes_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'notes_fts_before_delete',
		'BEFORE',
		'DELETE',
		'notes',
		qb.deleteFrom('notes_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'notes_after_update',
		'AFTER',
		'UPDATE',
		'notes',
		qb
			.insertInto('notes_fts')
			.columns(['docid', 'id', 'title', 'body'])
			.expression(
				qb
					.selectFrom('notes')
					.select(['rowid', 'id', 'title', 'body'])
					.where(eb =>
						eb.and([
							eb.and([eb(eb.ref('is_conflict'), '=', sql.lit(0)), eb(eb.ref('encryption_applied'), '=', sql.lit(0))]),
							eb(sql.ref('new.rowid'), '=', eb.ref('notes.rowid')),
						]),
					),
			),
	),
	trigger(
		'notes_after_insert',
		'AFTER',
		'INSERT',
		'notes',
		qb
			.insertInto('notes_fts')
			.columns(['docid', 'id', 'title', 'body'])
			.expression(
				qb
					.selectFrom('notes')
					.select(['rowid', 'id', 'title', 'body'])
					.where(eb =>
						eb.and([
							eb.and([eb(eb.ref('is_conflict'), '=', sql.lit(0)), eb(eb.ref('encryption_applied'), '=', sql.lit(0))]),
							eb(sql.ref('new.rowid'), '=', eb.ref('notes.rowid')),
						]),
					),
			),
	),
];
