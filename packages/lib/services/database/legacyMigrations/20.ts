import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import addMigrationFile from '../addMigrationFile';
import { SqlQuery } from '../types';

// Preserve the original version 20 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('migrations')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('number', sql.raw('INTEGER'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.alterTable('resources').addColumn('size', sql.raw('INT'), c => c.notNull().defaultTo(-1))),
	addMigrationFile(20),
];
