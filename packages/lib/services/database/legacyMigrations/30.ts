import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 30 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('notes_backup')
			.temporary()
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
			.addColumn('order', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('markup_language', sql.raw('INT'), c => c.notNull().defaultTo(1))
			.addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb
			.insertInto('notes_backup')
			.columns([
				'id',
				'parent_id',
				'title',
				'body',
				'created_time',
				'updated_time',
				'is_conflict',
				'latitude',
				'longitude',
				'altitude',
				'author',
				'source_url',
				'is_todo',
				'todo_due',
				'todo_completed',
				'source',
				'source_application',
				'application_data',
				'order',
				'user_created_time',
				'user_updated_time',
				'encryption_cipher_text',
				'encryption_applied',
				'markup_language',
				'is_shared',
			])
			.expression(
				qb
					.selectFrom('notes')
					.select([
						'id',
						'parent_id',
						'title',
						'body',
						'created_time',
						'updated_time',
						'is_conflict',
						'latitude',
						'longitude',
						'altitude',
						'author',
						'source_url',
						'is_todo',
						'todo_due',
						'todo_completed',
						'source',
						'source_application',
						'application_data',
						'order',
						'user_created_time',
						'user_updated_time',
						'encryption_cipher_text',
						'encryption_applied',
						'markup_language',
						'is_shared',
					]),
			),
	),
	compileQuery(qb.schema.dropTable('notes')),
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
			.addColumn('order', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('encryption_cipher_text', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('encryption_applied', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('markup_language', sql.raw('INT'), c => c.notNull().defaultTo(1))
			.addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb
			.insertInto('notes')
			.columns([
				'id',
				'parent_id',
				'title',
				'body',
				'created_time',
				'updated_time',
				'is_conflict',
				'latitude',
				'longitude',
				'altitude',
				'author',
				'source_url',
				'is_todo',
				'todo_due',
				'todo_completed',
				'source',
				'source_application',
				'application_data',
				'order',
				'user_created_time',
				'user_updated_time',
				'encryption_cipher_text',
				'encryption_applied',
				'markup_language',
				'is_shared',
			])
			.expression(
				qb
					.selectFrom('notes_backup')
					.select([
						'id',
						'parent_id',
						'title',
						'body',
						'created_time',
						'updated_time',
						'is_conflict',
						'latitude',
						'longitude',
						'altitude',
						'author',
						'source_url',
						'is_todo',
						'todo_due',
						'todo_completed',
						'source',
						'source_application',
						'application_data',
						'order',
						'user_created_time',
						'user_updated_time',
						'encryption_cipher_text',
						'encryption_applied',
						'markup_language',
						'is_shared',
					]),
			),
	),
	compileQuery(qb.schema.dropTable('notes_backup')),
];
