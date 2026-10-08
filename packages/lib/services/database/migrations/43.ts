import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('notes')
				.addColumn('user_data', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('tags')
				.addColumn('user_data', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('folders')
				.addColumn('user_data', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('resources')
				.addColumn('user_data', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
		),
	];
};
