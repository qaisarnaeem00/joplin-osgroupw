import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 21 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.alterTable('sync_items').addColumn('item_location', sql.raw('INT'), c => c.notNull().defaultTo(1)),
	),
];
