import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('sync_items')
				.addColumn('sync_warning_ignored', sql.raw('INT'), (column) =>
					column.notNull().defaultTo(sql.raw('"0"')),
				),
		),
	];
};
