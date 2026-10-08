import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 39 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('notes')
			.addColumn('conflict_original_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
];
