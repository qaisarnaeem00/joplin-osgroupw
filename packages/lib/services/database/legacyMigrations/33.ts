import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault, virtualTable, trigger, dropTrigger } from '../sqlite';
import addMigrationFile from '../addMigrationFile';
import { SqlQuery } from '../types';

// Preserve the original version 33 schema and data changes.
export default (): SqlQuery[] => [
	dropTrigger('notes_fts_before_update', false),
	dropTrigger('notes_fts_before_delete', false),
	dropTrigger('notes_after_update', false),
	dropTrigger('notes_after_insert', false),
	compileQuery(qb.schema.dropIndex('notes_normalized_id')),
	compileQuery(qb.schema.dropTable('notes_normalized')),
	compileQuery(qb.schema.dropTable('notes_fts')),
	compileQuery(
		qb.schema
			.createTable('notes_normalized')
			.addColumn('id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('is_todo', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('todo_completed', sql.raw('INT'), c => c.notNull().defaultTo(0))
			.addColumn('parent_id', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('latitude', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('longitude', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('altitude', sql.raw('NUMERIC'), c => c.notNull().defaultTo(0))
			.addColumn('source_url', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(qb.schema.createIndex('notes_normalized_id').on('notes_normalized').columns(['id'])),
	compileQuery(
		qb.schema.createIndex('notes_normalized_user_created_time').on('notes_normalized').columns(['user_created_time']),
	),
	compileQuery(
		qb.schema.createIndex('notes_normalized_user_updated_time').on('notes_normalized').columns(['user_updated_time']),
	),
	compileQuery(qb.schema.createIndex('notes_normalized_is_todo').on('notes_normalized').columns(['is_todo'])),
	compileQuery(
		qb.schema.createIndex('notes_normalized_todo_completed').on('notes_normalized').columns(['todo_completed']),
	),
	compileQuery(qb.schema.createIndex('notes_normalized_parent_id').on('notes_normalized').columns(['parent_id'])),
	compileQuery(qb.schema.createIndex('notes_normalized_latitude').on('notes_normalized').columns(['latitude'])),
	compileQuery(qb.schema.createIndex('notes_normalized_longitude').on('notes_normalized').columns(['longitude'])),
	compileQuery(qb.schema.createIndex('notes_normalized_altitude').on('notes_normalized').columns(['altitude'])),
	compileQuery(qb.schema.createIndex('notes_normalized_source_url').on('notes_normalized').columns(['source_url'])),
	virtualTable(
		'notes_fts',
		'fts4',
		'content="notes_normalized", notindexed="id", notindexed="user_created_time", notindexed="user_updated_time", notindexed="is_todo", notindexed="todo_completed", notindexed="parent_id", notindexed="latitude", notindexed="longitude", notindexed="altitude", notindexed="source_url", id, title, body, user_created_time, user_updated_time, is_todo, todo_completed, parent_id, latitude, longitude, altitude, source_url',
	),
	trigger(
		'notes_fts_before_update',
		'BEFORE',
		'UPDATE',
		'notes_normalized',
		qb.deleteFrom('notes_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'notes_fts_before_delete',
		'BEFORE',
		'DELETE',
		'notes_normalized',
		qb.deleteFrom('notes_fts').where(eb => eb(eb.ref('docid'), '=', eb.ref('old.rowid'))),
	),
	trigger(
		'notes_after_update',
		'AFTER',
		'UPDATE',
		'notes_normalized',
		qb
			.insertInto('notes_fts')
			.columns([
				'docid',
				'id',
				'title',
				'body',
				'user_created_time',
				'user_updated_time',
				'is_todo',
				'todo_completed',
				'parent_id',
				'latitude',
				'longitude',
				'altitude',
				'source_url',
			])
			.expression(
				qb
					.selectFrom('notes_normalized')
					.select([
						'rowid',
						'id',
						'title',
						'body',
						'user_created_time',
						'user_updated_time',
						'is_todo',
						'todo_completed',
						'parent_id',
						'latitude',
						'longitude',
						'altitude',
						'source_url',
					])
					.where(eb => eb(sql.ref('new.rowid'), '=', eb.ref('notes_normalized.rowid'))),
			),
	),
	trigger(
		'notes_after_insert',
		'AFTER',
		'INSERT',
		'notes_normalized',
		qb
			.insertInto('notes_fts')
			.columns([
				'docid',
				'id',
				'title',
				'body',
				'user_created_time',
				'user_updated_time',
				'is_todo',
				'todo_completed',
				'parent_id',
				'latitude',
				'longitude',
				'altitude',
				'source_url',
			])
			.expression(
				qb
					.selectFrom('notes_normalized')
					.select([
						'rowid',
						'id',
						'title',
						'body',
						'user_created_time',
						'user_updated_time',
						'is_todo',
						'todo_completed',
						'parent_id',
						'latitude',
						'longitude',
						'altitude',
						'source_url',
					])
					.where(eb => eb(sql.ref('new.rowid'), '=', eb.ref('notes_normalized.rowid'))),
			),
	),
	addMigrationFile(33),
];
