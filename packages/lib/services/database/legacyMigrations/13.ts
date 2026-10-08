import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 13 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('fetch_status', sql.raw('INT'), c => c.notNull().defaultTo(sqliteStringDefault('2'))),
	),
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('fetch_error', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(qb.updateTable('resources').set(eb => ({ fetch_status: eb.val(2) }))),
];
