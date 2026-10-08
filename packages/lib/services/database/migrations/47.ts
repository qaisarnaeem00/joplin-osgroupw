import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 47 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('sync_warning_ignored', sql.raw('INT'), c => c.notNull().defaultTo(sqliteStringDefault('0'))),
	),
];
