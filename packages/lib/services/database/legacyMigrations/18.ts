import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault, virtualTable, trigger, dropTrigger } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 18 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('notes_normalized')
			.addColumn('id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(qb.schema.createIndex('notes_normalized_id').on('notes_normalized').columns(['id'])),
	dropTrigger('notes_fts_before_update', true),
	dropTrigger('notes_fts_before_delete', true),
	dropTrigger('notes_after_update', true),
	dropTrigger('notes_after_insert', true),
	compileQuery(qb.schema.dropTable('notes_fts').ifExists()),
	virtualTable('notes_fts', 'fts4', 'content="notes_normalized", notindexed="id", id, title, body'),
	trigger(
		'notes_fts_before_update',
		'BEFORE',
		'UPDATE',
		'notes_normalized',
		qb.deleteFrom('notes_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'notes_fts_before_delete',
		'BEFORE',
		'DELETE',
		'notes_normalized',
		qb.deleteFrom('notes_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'notes_after_update',
		'AFTER',
		'UPDATE',
		'notes_normalized',
		qb
			.insertInto('notes_fts')
			.columns(['docid', 'id', 'title', 'body'])
			.expression(
				qb
					.selectFrom('notes_normalized')
					.select(['rowid', 'id', 'title', 'body'])
					.where(eb => eb(sql.ref('new.rowid'), '=', eb.ref('notes_normalized.rowid'))),
			),
	),
	trigger(
		'notes_after_insert',
		'AFTER',
		'INSERT',
		'notes_normalized',
		qb
			.insertInto('notes_fts')
			.columns(['docid', 'id', 'title', 'body'])
			.expression(
				qb
					.selectFrom('notes_normalized')
					.select(['rowid', 'id', 'title', 'body'])
					.where(eb => eb(sql.ref('new.rowid'), '=', eb.ref('notes_normalized.rowid'))),
			),
	),
];
