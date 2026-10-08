import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 19 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('revisions')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('parent_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('item_type', sql.raw('INT'), c => c.notNull())
			.addColumn('item_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('item_updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('title_diff', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('body_diff', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('metadata_diff', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('revisions_parent_id').on('revisions').columns(['parent_id'])),
	compileQuery(qb.schema.createIndex('revisions_item_type').on('revisions').columns(['item_type'])),
	compileQuery(qb.schema.createIndex('revisions_item_id').on('revisions').columns(['item_id'])),
	compileQuery(qb.schema.createIndex('revisions_item_updated_time').on('revisions').columns(['item_updated_time'])),
	compileQuery(qb.schema.createIndex('revisions_updated_time').on('revisions').columns(['updated_time'])),
	compileQuery(qb.schema.alterTable('item_changes').addColumn('source', sql.raw('INT'), c => c.notNull().defaultTo(1))),
	compileQuery(
		qb.schema
			.alterTable('item_changes')
			.addColumn('before_change_item', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
];
