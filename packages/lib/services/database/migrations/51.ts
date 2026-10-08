import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 51 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('base_body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('base_title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('base_conflict_note_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.createTable('conflict_note_states')
			.ifNotExists()
			.addColumn('note_id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('base_body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('base_title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('remote_body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('remote_title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('remote_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
];
