import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 24 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.alterTable('notes').addColumn('markup_language', sql.raw('INT'), c => c.notNull().defaultTo(1)),
	),
];
