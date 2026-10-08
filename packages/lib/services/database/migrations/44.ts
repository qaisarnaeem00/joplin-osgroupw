import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('resources')
				.addColumn('blob_updated_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
		compileQuery(queryBuilder.updateTable('resources').set({ 'blob_updated_time': sql.ref('updated_time') })),
	];
};
