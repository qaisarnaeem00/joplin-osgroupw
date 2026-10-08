import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.alterTable('resources')
				.addColumn('ocr_driver_id', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('"1"'))),
		),
	];
};
