import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 50 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(qb.schema.alterTable('notes').addColumn('is_locked', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(
		qb.schema
			.alterTable('notes')
			.addColumn('extracted_resource_ids', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault(''))),
	),
	compileQuery(qb.schema.alterTable('revisions').addColumn('is_locked', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(qb.schema.alterTable('resources').addColumn('is_locked', sql.raw('INT'), c => c.notNull().defaultTo(0))),
];
