import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 6 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('alarms')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey().autoIncrement())
			.addColumn('note_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('trigger_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('alarm_note_id').on('alarms').columns(['note_id'])),
];
