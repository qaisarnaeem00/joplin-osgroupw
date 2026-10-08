import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('notes')
				.addColumn('is_locked', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('notes')
				.addColumn('extracted_resource_ids', sql.raw('TEXT'), (column) =>
					column.notNull().defaultTo(sql.raw('""')),
				),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('revisions')
				.addColumn('is_locked', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
		compileQuery(
			queryBuilder.schema
				.alterTable('resources')
				.addColumn('is_locked', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
	];
};
