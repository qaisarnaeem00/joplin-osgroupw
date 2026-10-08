import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 49 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('sync_items')
			.addColumn('remote_item_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
];
