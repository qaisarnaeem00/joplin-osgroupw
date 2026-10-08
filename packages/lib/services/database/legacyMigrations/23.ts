import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 23 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('key_values')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('key', sql.raw('TEXT'), c => c.notNull())
			.addColumn('value', sql.raw('TEXT'), c => c.notNull())
			.addColumn('type', sql.raw('INT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('key_values_key').unique().on('key_values').columns(['key'])),
];
