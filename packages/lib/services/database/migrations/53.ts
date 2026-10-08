import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { sqliteStringDefault } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve migration 53: this unshipped table is deliberately dropped and
// recreated with a numeric primary key. Existing conflict snapshots are discarded.
export default (): SqlQuery[] => [
	compileQuery(qb.schema.dropTable('conflict_note_states').ifExists()),
	compileQuery(
		qb.schema
			.createTable('conflict_note_states')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey().autoIncrement())
			.addColumn('note_id', sql.raw('TEXT'), c => c.notNull().unique())
			.addColumn('base_body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('base_title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('remote_body', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('remote_title', sql.raw('TEXT'), c => c.notNull().defaultTo(sqliteStringDefault('')))
			.addColumn('remote_updated_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
];
