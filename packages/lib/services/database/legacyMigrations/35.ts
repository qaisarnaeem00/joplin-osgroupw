import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import addMigrationFile from '../addMigrationFile';
import { SqlQuery } from '../types';

// Preserve the original version 35 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.alterTable('notes_normalized').addColumn('todo_due', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(qb.schema.createIndex('notes_normalized_todo_due').on('notes_normalized').columns(['todo_due'])),
	addMigrationFile(35),
];
