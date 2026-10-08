import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 14 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('resource_local_states')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('resource_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('fetch_status', sql.raw('INT'), c => c.notNull().defaultTo(sqliteStringDefault('2')))
			.addColumn('fetch_error', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(
		qb
			.insertInto('resource_local_states')
			.columns(['id', 'resource_id', 'fetch_status', 'fetch_error'])
			.expression(
				qb.selectFrom('resources').select(eb => [eb.val(null).as('__value_804'), 'id', 'fetch_status', 'fetch_error']),
			),
	),
	compileQuery(
		qb.schema.createIndex('resource_local_states_resource_id').on('resource_local_states').columns(['resource_id']),
	),
	compileQuery(
		qb.schema
			.createIndex('resource_local_states_resource_fetch_status')
			.on('resource_local_states')
			.columns(['fetch_status']),
	),
	compileQuery(
		qb.schema
			.createTable('resources_backup')
			.temporary()
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('mime', sql.raw('TEXT'), c => c.notNull())
			.addColumn('filename', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('file_extension', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('encryption_blob_encrypted', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb
			.insertInto('resources_backup')
			.columns([
				'id',
				'title',
				'mime',
				'filename',
				'created_time',
				'updated_time',
				'user_created_time',
				'user_updated_time',
				'file_extension',
				'encryption_cipher_text',
				'encryption_applied',
				'encryption_blob_encrypted',
			])
			.expression(
				qb
					.selectFrom('resources')
					.select([
						'id',
						'title',
						'mime',
						'filename',
						'created_time',
						'updated_time',
						'user_created_time',
						'user_updated_time',
						'file_extension',
						'encryption_cipher_text',
						'encryption_applied',
						'encryption_blob_encrypted',
					]),
			),
	),
	compileQuery(qb.schema.dropTable('resources')),
	compileQuery(
		qb.schema
			.createTable('resources')
			.addColumn('id', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('mime', sql.raw('TEXT'), c => c.notNull())
			.addColumn('filename', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('created_time', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('file_extension', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('encryption_blob_encrypted', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb
			.insertInto('resources')
			.columns([
				'id',
				'title',
				'mime',
				'filename',
				'created_time',
				'updated_time',
				'user_created_time',
				'user_updated_time',
				'file_extension',
				'encryption_cipher_text',
				'encryption_applied',
				'encryption_blob_encrypted',
			])
			.expression(
				qb
					.selectFrom('resources_backup')
					.select([
						'id',
						'title',
						'mime',
						'filename',
						'created_time',
						'updated_time',
						'user_created_time',
						'user_updated_time',
						'file_extension',
						'encryption_cipher_text',
						'encryption_applied',
						'encryption_blob_encrypted',
					]),
			),
	),
	compileQuery(qb.schema.dropTable('resources_backup')),
];
