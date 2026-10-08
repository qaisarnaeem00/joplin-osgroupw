import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 26 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(qb.schema.alterTable('notes').addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(qb.schema.alterTable('folders').addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(qb.schema.alterTable('tags').addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(qb.schema.alterTable('note_tags').addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0))),
	compileQuery(qb.schema.alterTable('resources').addColumn('is_shared', sql.raw('INT'), c => c.notNull().defaultTo(0))),
];
