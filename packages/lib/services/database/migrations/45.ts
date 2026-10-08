import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault, virtualTable, trigger } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 45 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('ocr_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('ocr_details', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema.alterTable('resources').addColumn('ocr_status', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('ocr_error', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema
			.createTable('items_normalized')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey().autoIncrement())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('item_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('item_type', sql.raw('INT'), c => c.notNull())
			.addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('reserved1', sql.raw('INT'))
			.addColumn('reserved2', sql.raw('INT'))
			.addColumn('reserved3', sql.raw('INT'))
			.addColumn('reserved4', sql.raw('INT'))
			.addColumn('reserved5', sql.raw('INT'))
			.addColumn('reserved6', sql.raw('INT')),
	),
	compileQuery(qb.schema.createIndex('items_normalized_id').on('items_normalized').columns(['id'])),
	compileQuery(qb.schema.createIndex('items_normalized_item_id').on('items_normalized').columns(['item_id'])),
	compileQuery(qb.schema.createIndex('items_normalized_item_type').on('items_normalized').columns(['item_type'])),
	virtualTable(
		'items_fts',
		'fts4',
		'content="items_normalized", notindexed="id", notindexed="item_id", notindexed="item_type", notindexed="user_updated_time", notindexed="reserved1", notindexed="reserved2", notindexed="reserved3", notindexed="reserved4", notindexed="reserved5", notindexed="reserved6", id, title, body, item_id, item_type, user_updated_time, reserved1, reserved2, reserved3, reserved4, reserved5, reserved6',
	),
	trigger(
		'items_fts_before_update',
		'BEFORE',
		'UPDATE',
		'items_normalized',
		qb.deleteFrom('items_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'items_fts_before_delete',
		'BEFORE',
		'DELETE',
		'items_normalized',
		qb.deleteFrom('items_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'items_after_update',
		'AFTER',
		'UPDATE',
		'items_normalized',
		qb
			.insertInto('items_fts')
			.columns([
				'docid',
				'id',
				'title',
				'body',
				'item_id',
				'item_type',
				'user_updated_time',
				'reserved1',
				'reserved2',
				'reserved3',
				'reserved4',
				'reserved5',
				'reserved6',
			])
			.expression(
				qb
					.selectFrom('items_normalized')
					.select([
						'rowid',
						'id',
						'title',
						'body',
						'item_id',
						'item_type',
						'user_updated_time',
						'reserved1',
						'reserved2',
						'reserved3',
						'reserved4',
						'reserved5',
						'reserved6',
					])
					.where(eb => eb(sql.ref('new.rowid'), '=', eb.ref('items_normalized.rowid'))),
			),
	),
	trigger(
		'items_after_insert',
		'AFTER',
		'INSERT',
		'items_normalized',
		qb
			.insertInto('items_fts')
			.columns([
				'docid',
				'id',
				'title',
				'body',
				'item_id',
				'item_type',
				'user_updated_time',
				'reserved1',
				'reserved2',
				'reserved3',
				'reserved4',
				'reserved5',
				'reserved6',
			])
			.expression(
				qb
					.selectFrom('items_normalized')
					.select([
						'rowid',
						'id',
						'title',
						'body',
						'item_id',
						'item_type',
						'user_updated_time',
						'reserved1',
						'reserved2',
						'reserved3',
						'reserved4',
						'reserved5',
						'reserved6',
					])
					.where(eb => eb(sql.ref('new.rowid'), '=', eb.ref('items_normalized.rowid'))),
			),
	),
];
