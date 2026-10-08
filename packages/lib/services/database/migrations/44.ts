import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 44 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.alterTable('resources').addColumn('blob_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.updateTable('resources').set(eb => ({ blob_updated_time: eb.ref('updated_time') }))),
];
