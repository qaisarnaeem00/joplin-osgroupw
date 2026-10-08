import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('sync_items')
				.addColumn('base_body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('sync_items')
				.addColumn('base_title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('sync_items')
				.addColumn('base_conflict_note_id', sql.raw('TEXT'), (column) =>
					column.notNull().defaultTo(sql.raw('""')),
				),
		),
		compileQuery(
			queryBuilder.schema
				.createTable('conflict_note_states')
				.ifNotExists()
				.addColumn('note_id', sql.raw('TEXT'), (column) => column.primaryKey())
				.addColumn('base_body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('base_title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('remote_body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('remote_title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('remote_updated_time', sql.raw('INT'), (column) =>
					column.notNull().defaultTo(sql.raw('0')),
				),
		),
	];
};
