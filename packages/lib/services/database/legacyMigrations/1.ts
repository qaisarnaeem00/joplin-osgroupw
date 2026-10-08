import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 1 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('folders')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('folders_title').on('folders').columns(['title'])),
	compileQuery(qb.schema.createIndex('folders_updated_time').on('folders').columns(['updated_time'])),
	compileQuery(
		qb.schema
			.createTable('notes')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('parent_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('is_conflict', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('latitude', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('longitude', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('altitude', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('author', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('source_url', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('is_todo', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('todo_due', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('todo_completed', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('source', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('source_application', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('application_data', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('order', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('notes_title').on('notes').columns(['title'])),
	compileQuery(qb.schema.createIndex('notes_updated_time').on('notes').columns(['updated_time'])),
	compileQuery(qb.schema.createIndex('notes_is_conflict').on('notes').columns(['is_conflict'])),
	compileQuery(qb.schema.createIndex('notes_is_todo').on('notes').columns(['is_todo'])),
	compileQuery(qb.schema.createIndex('notes_order').on('notes').columns(['order'])),
	compileQuery(
		qb.schema
			.createTable('tags')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('tags_title').on('tags').columns(['title'])),
	compileQuery(qb.schema.createIndex('tags_updated_time').on('tags').columns(['updated_time'])),
	compileQuery(
		qb.schema
			.createTable('note_tags')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('note_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('tag_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('note_tags_note_id').on('note_tags').columns(['note_id'])),
	compileQuery(qb.schema.createIndex('note_tags_tag_id').on('note_tags').columns(['tag_id'])),
	compileQuery(qb.schema.createIndex('note_tags_updated_time').on('note_tags').columns(['updated_time'])),
	compileQuery(
		qb.schema
			.createTable('resources')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('mime', sql.raw('TEXT'), c => c.notNull())
			.addColumn('filename', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('resources_title').on('resources').columns(['title'])),
	compileQuery(qb.schema.createIndex('resources_updated_time').on('resources').columns(['updated_time'])),
	compileQuery(
		qb.schema
			.createTable('settings')
			.addColumn('key', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('value', sql.raw('TEXT'))
			.addColumn('type', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(
		qb.schema
			.createTable('table_fields')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('table_name', sql.raw('TEXT'), c => c.notNull())
			.addColumn('field_name', sql.raw('TEXT'), c => c.notNull())
			.addColumn('field_type', sql.raw('INT'), c => c.notNull())
			.addColumn('field_default', sql.raw('TEXT')),
	),
	compileQuery(
		qb.schema
			.createTable('sync_items')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('sync_target', sql.raw('INT'), c => c.notNull())
			.addColumn('sync_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('item_type', sql.raw('INT'), c => c.notNull())
			.addColumn('item_id', sql.raw('TEXT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('sync_items_sync_time').on('sync_items').columns(['sync_time'])),
	compileQuery(qb.schema.createIndex('sync_items_sync_target').on('sync_items').columns(['sync_target'])),
	compileQuery(qb.schema.createIndex('sync_items_item_type').on('sync_items').columns(['item_type'])),
	compileQuery(qb.schema.createIndex('sync_items_item_id').on('sync_items').columns(['item_id'])),
	compileQuery(
		qb.schema
			.createTable('deleted_items')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('item_type', sql.raw('INT'), c => c.notNull())
			.addColumn('item_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('deleted_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createTable('version').addColumn('version', sql.raw('INT'), c => c.notNull())),
	compileQuery(qb.insertInto('version').values(eb => ({ version: eb.val(1) }))),
];
