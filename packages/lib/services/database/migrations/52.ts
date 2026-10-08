import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import { SqlQuery } from '../types';

// Storage for the AI embeddings index. Two tables:
//
// - `note_embeddings_meta` holds the per-chunk metadata. It is a regular table
//   so the metadata (chunk text, source note ID, model identifier) can be
//   inspected and managed even on platforms where the sqlite-vec extension
//   isn't available.
//
// - `note_embeddings_vec` is the sqlite-vec virtual table holding the actual
//   vectors. It is created lazily by the embeddings code when sqlite-vec is
//   available, because virtual-table syntax differs by extension version and
//   trying to create it unconditionally would break startup on platforms
//   without the prebuilt.
//
// Neither table is synced — embeddings are large, model-specific, and easily
// re-derivable on demand.

export default (): (SqlQuery|string)[] => {
	return [
		compileQuery(
			queryBuilder.schema
				.createTable('note_embeddings_meta')
				.ifNotExists()
				.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey().autoIncrement())
				.addColumn('note_id', sql.raw('TEXT'), (column) => column.notNull())
				.addColumn('chunk_index', sql.raw('INTEGER'), (column) => column.notNull())
				.addColumn('model_id', sql.raw('TEXT'), (column) => column.notNull())
				.addColumn('chunk_text', sql.raw('TEXT'), (column) => column.notNull())
				.addColumn('created_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
		),
		compileQuery(
			queryBuilder.schema
				.createIndex('note_embeddings_meta_note_id')
				.ifNotExists()
				.on('note_embeddings_meta')
				.columns(['note_id']),
		),
		compileQuery(
			queryBuilder.schema
				.createIndex('note_embeddings_meta_note_chunk')
				.ifNotExists()
				.unique()
				.on('note_embeddings_meta')
				.columns(['note_id', 'chunk_index']),
		),
	];
};
