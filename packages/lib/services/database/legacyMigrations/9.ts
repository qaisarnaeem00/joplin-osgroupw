import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 9 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('master_keys')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('source_application', sql.raw('TEXT'), c => c.notNull())
			.addColumn('encryption_method', sql.raw('INT'), c => c.notNull())
			.addColumn('checksum', sql.raw('TEXT'), c => c.notNull())
			.addColumn('content', sql.raw('TEXT'), c => c.notNull()),
	),
	compileQuery(
		qb.schema
			.alterTable('notes')
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema.alterTable('notes').addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('notes_encryption_applied').on('notes').columns(['encryption_applied'])),
	compileQuery(
		qb.schema
			.alterTable('folders')
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema.alterTable('folders').addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('folders_encryption_applied').on('folders').columns(['encryption_applied'])),
	compileQuery(
		qb.schema
			.alterTable('tags')
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema.alterTable('tags').addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('tags_encryption_applied').on('tags').columns(['encryption_applied'])),
	compileQuery(
		qb.schema
			.alterTable('note_tags')
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema.alterTable('note_tags').addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('note_tags_encryption_applied').on('note_tags').columns(['encryption_applied'])),
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb.schema.alterTable('resources').addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('resources_encryption_applied').on('resources').columns(['encryption_applied'])),
	compileQuery(
		qb.schema.alterTable('sync_items').addColumn('force_sync', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema
			.alterTable('resources')
			.addColumn('encryption_blob_encrypted', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
];
