import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 52 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('note_embeddings_meta')
			.ifNotExists()
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey().autoIncrement())
			.addColumn('note_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('chunk_index', sql.raw('INTEGER'), c => c.notNull())
			.addColumn('model_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('chunk_text', sql.raw('TEXT'), c => c.notNull())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull().defaultTo(0)),
	),
	compileQuery(
		qb.schema.createIndex('note_embeddings_meta_note_id').ifNotExists().on('note_embeddings_meta').columns(['note_id']),
	),
	compileQuery(
		qb.schema
			.createIndex('note_embeddings_meta_note_chunk')
			.unique()
			.ifNotExists()
			.on('note_embeddings_meta')
			.columns(['note_id', 'chunk_index']),
	),
];
