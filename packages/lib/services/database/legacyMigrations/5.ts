import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 5 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.alterTable('notes').addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema.alterTable('notes').addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.updateTable('notes').set(eb => ({ user_created_time: eb.ref('created_time') }))),
	compileQuery(qb.updateTable('notes').set(eb => ({ user_updated_time: eb.ref('updated_time') }))),
	compileQuery(qb.schema.createIndex('notes_user_updated_time').on('notes').columns(['user_updated_time'])),
	compileQuery(
		qb.schema.alterTable('folders').addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema.alterTable('folders').addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.updateTable('folders').set(eb => ({ user_created_time: eb.ref('created_time') }))),
	compileQuery(qb.updateTable('folders').set(eb => ({ user_updated_time: eb.ref('updated_time') }))),
	compileQuery(qb.schema.createIndex('folders_user_updated_time').on('folders').columns(['user_updated_time'])),
	compileQuery(
		qb.schema.alterTable('tags').addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema.alterTable('tags').addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.updateTable('tags').set(eb => ({ user_created_time: eb.ref('created_time') }))),
	compileQuery(qb.updateTable('tags').set(eb => ({ user_updated_time: eb.ref('updated_time') }))),
	compileQuery(qb.schema.createIndex('tags_user_updated_time').on('tags').columns(['user_updated_time'])),
	compileQuery(
		qb.schema.alterTable('note_tags').addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema.alterTable('note_tags').addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.updateTable('note_tags').set(eb => ({ user_created_time: eb.ref('created_time') }))),
	compileQuery(qb.updateTable('note_tags').set(eb => ({ user_updated_time: eb.ref('updated_time') }))),
	compileQuery(qb.schema.createIndex('note_tags_user_updated_time').on('note_tags').columns(['user_updated_time'])),
	compileQuery(
		qb.schema.alterTable('resources').addColumn('user_created_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema.alterTable('resources').addColumn('user_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.updateTable('resources').set(eb => ({ user_created_time: eb.ref('created_time') }))),
	compileQuery(qb.updateTable('resources').set(eb => ({ user_updated_time: eb.ref('updated_time') }))),
	compileQuery(qb.schema.createIndex('resources_user_updated_time').on('resources').columns(['user_updated_time'])),
];
