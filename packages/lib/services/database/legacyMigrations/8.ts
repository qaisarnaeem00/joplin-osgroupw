import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 8 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('sync_disabled', sql.raw('INT'), c => c.notNull().defaultTo(sqliteStringDefault('0'))),
	),
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('sync_disabled_reason', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
];
