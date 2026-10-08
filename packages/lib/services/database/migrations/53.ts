import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

// Recreate conflict_note_states with a numeric auto-increment primary key, to
// match the convention used by the other tables. note_id keeps its uniqueness
// through a UNIQUE constraint. The table was added in migration 51 and hasn't
// shipped in a release yet, so it is safe to drop and recreate it rather than
// migrate the rows

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(queryBuilder.schema.dropTable('conflict_note_states').ifExists()).sql,
		compileQuery(
			queryBuilder.schema
				.createTable('conflict_note_states')
				.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey().autoIncrement())
				.addColumn('note_id', sql.raw('TEXT'), (column) => column.notNull().unique())
				.addColumn('base_body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('base_title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('remote_body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('remote_title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
				.addColumn('remote_updated_time', sql.raw('INT'), (column) =>
					column.notNull().defaultTo(sql.raw('0')),
				),
		),
	];
};
