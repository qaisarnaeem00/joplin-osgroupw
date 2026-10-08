import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 48 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('ocr_driver_id', sql.raw('INT'), c => c.notNull().defaultTo(sqliteStringDefault('1'))),
	),
];
