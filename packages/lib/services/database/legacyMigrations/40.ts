import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 40 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('folders')
			.addColumn('master_key_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.alterTable('notes')
			.addColumn('master_key_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('master_key_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
];
