import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 2 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(qb.schema.dropTable('deleted_items')),
	compileQuery(
		qb.schema
			.createTable('deleted_items')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('item_type', sql.raw('INT'), c => c.notNull())
			.addColumn('item_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('deleted_time', sql.raw('INT'), c => c.notNull())
			.addColumn('sync_target', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('deleted_items_sync_target').on('deleted_items').columns(['sync_target'])),
];
