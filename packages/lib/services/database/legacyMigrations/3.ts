import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 3 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('settings_backup')
			.temporary()
			.addColumn('key', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('value', sql.raw('TEXT')),
	),
	compileQuery(
		qb
			.insertInto('settings_backup')
			.columns(['key', 'value'])
			.expression(qb.selectFrom('settings').select(['key', 'value'])),
	),
	compileQuery(qb.schema.dropTable('settings')),
	compileQuery(
		qb.schema
			.createTable('settings')
			.addColumn('key', sql.raw('TEXT'), c => c.primaryKey())
			.addColumn('value', sql.raw('TEXT')),
	),
	compileQuery(
		qb
			.insertInto('settings')
			.columns(['key', 'value'])
			.expression(qb.selectFrom('settings_backup').select(['key', 'value'])),
	),
	compileQuery(qb.schema.dropTable('settings_backup')),
];
