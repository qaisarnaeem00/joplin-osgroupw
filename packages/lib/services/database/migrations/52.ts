import { db } from '../kysely';
import { createTable } from '../sqlite';
import { StringOrSqlQuery } from '../types';

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

export default (): StringOrSqlQuery[] => {
	return [
		createTable('note_embeddings_meta', {
			id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
			note_id: 'TEXT NOT NULL',
			chunk_index: 'INTEGER NOT NULL',
			model_id: 'TEXT NOT NULL',
			chunk_text: 'TEXT NOT NULL',
			created_time: 'INT NOT NULL DEFAULT 0',
		}).ifNotExists(),
		db.schema.createIndex('note_embeddings_meta_note_id').ifNotExists().on('note_embeddings_meta').column('note_id'),
		db.schema.createIndex('note_embeddings_meta_note_chunk').ifNotExists().unique().on('note_embeddings_meta').columns(['note_id', 'chunk_index']),
	];
};
