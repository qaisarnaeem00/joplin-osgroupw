import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 29 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.alterTable('version').addColumn('table_fields_version', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
];
