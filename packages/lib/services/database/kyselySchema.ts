import type { Generated } from 'kysely';

// SQLite row types, separate from model entities and application-only metadata.
// Keep these aligned with the schema upgrades; historical migrations use the
// dynamic builder because they intentionally address earlier column layouts.
export interface KyselyDatabaseSchema {
	alarms: {
		'id': Generated<number>;
		'note_id': string;
		'trigger_time': number;
		rowid: Generated<number>;
	};
	conflict_note_states: {
		'id': Generated<number>;
		'note_id': string;
		'base_body': Generated<string>;
		'base_title': Generated<string>;
		'remote_body': Generated<string>;
		'remote_title': Generated<string>;
		'remote_updated_time': Generated<number>;
		rowid: Generated<number>;
	};
	deleted_items: {
		'id': Generated<number>;
		'item_type': number;
		'item_id': string;
		'deleted_time': number;
		'sync_target': number;
		rowid: Generated<number>;
	};
	folders: {
		'id': string | null;
		'title': Generated<string>;
		'created_time': number;
		'updated_time': number;
		'user_created_time': Generated<number>;
		'user_updated_time': Generated<number>;
		'encryption_cipher_text': Generated<string>;
		'encryption_applied': Generated<number>;
		'parent_id': Generated<string>;
		'is_shared': Generated<number>;
		'share_id': Generated<string>;
		'master_key_id': Generated<string>;
		'icon': Generated<string>;
		'user_data': Generated<string>;
		'deleted_time': Generated<number>;
		rowid: Generated<number>;
	};
	item_changes: {
		'id': Generated<number>;
		'item_type': number;
		'item_id': string;
		'type': number;
		'created_time': number;
		'source': Generated<number>;
		'before_change_item': Generated<string>;
		rowid: Generated<number>;
	};
	items_fts: {
		'id': string | number | null;
		'title': string | number | null;
		'body': string | number | null;
		'item_id': string | number | null;
		'item_type': string | number | null;
		'user_updated_time': string | number | null;
		'reserved1': string | number | null;
		'reserved2': string | number | null;
		'reserved3': string | number | null;
		'reserved4': string | number | null;
		'reserved5': string | number | null;
		'reserved6': string | number | null;
		rowid: Generated<number>;
	};
	items_normalized: {
		'id': Generated<number>;
		'title': Generated<string>;
		'body': Generated<string>;
		'item_id': string;
		'item_type': number;
		'user_updated_time': Generated<number>;
		'reserved1': number | null;
		'reserved2': number | null;
		'reserved3': number | null;
		'reserved4': number | null;
		'reserved5': number | null;
		'reserved6': number | null;
		rowid: Generated<number>;
	};
	key_values: {
		'id': Generated<number>;
		'key': string;
		'value': string;
		'type': number;
		'updated_time': number;
		rowid: Generated<number>;
	};
	master_keys: {
		'id': string | null;
		'created_time': number;
		'updated_time': number;
		'source_application': string;
		'encryption_method': number;
		'checksum': string;
		'content': string;
		rowid: Generated<number>;
	};
	migrations: {
		'id': Generated<number>;
		'number': number;
		'updated_time': number;
		'created_time': number;
		rowid: Generated<number>;
	};
	note_embeddings_meta: {
		'id': Generated<number>;
		'note_id': string;
		'chunk_index': number;
		'model_id': string;
		'chunk_text': string;
		'created_time': Generated<number>;
		rowid: Generated<number>;
	};
	note_resources: {
		'id': Generated<number>;
		'note_id': string;
		'resource_id': string;
		'is_associated': number;
		'last_seen_time': number;
		rowid: Generated<number>;
	};
	note_tags: {
		'id': string | null;
		'note_id': string;
		'tag_id': string;
		'created_time': number;
		'updated_time': number;
		'user_created_time': Generated<number>;
		'user_updated_time': Generated<number>;
		'encryption_cipher_text': Generated<string>;
		'encryption_applied': Generated<number>;
		'is_shared': Generated<number>;
		rowid: Generated<number>;
	};
	notes: {
		'id': string | null;
		'parent_id': Generated<string>;
		'title': Generated<string>;
		'body': Generated<string>;
		'created_time': number;
		'updated_time': number;
		'is_conflict': Generated<number>;
		'latitude': Generated<number>;
		'longitude': Generated<number>;
		'altitude': Generated<number>;
		'author': Generated<string>;
		'source_url': Generated<string>;
		'is_todo': Generated<number>;
		'todo_due': Generated<number>;
		'todo_completed': Generated<number>;
		'source': Generated<string>;
		'source_application': Generated<string>;
		'application_data': Generated<string>;
		'order': Generated<number>;
		'user_created_time': Generated<number>;
		'user_updated_time': Generated<number>;
		'encryption_cipher_text': Generated<string>;
		'encryption_applied': Generated<number>;
		'markup_language': Generated<number>;
		'is_shared': Generated<number>;
		'share_id': Generated<string>;
		'conflict_original_id': Generated<string>;
		'master_key_id': Generated<string>;
		'user_data': Generated<string>;
		'deleted_time': Generated<number>;
		'is_locked': Generated<number>;
		'extracted_resource_ids': Generated<string>;
		rowid: Generated<number>;
	};
	notes_fts: {
		'id': string | number | null;
		'title': string | number | null;
		'body': string | number | null;
		'user_created_time': string | number | null;
		'user_updated_time': string | number | null;
		'is_todo': string | number | null;
		'todo_completed': string | number | null;
		'parent_id': string | number | null;
		'latitude': string | number | null;
		'longitude': string | number | null;
		'altitude': string | number | null;
		'source_url': string | number | null;
		rowid: Generated<number>;
	};
	notes_normalized: {
		'id': string;
		'title': Generated<string>;
		'body': Generated<string>;
		'user_created_time': Generated<number>;
		'user_updated_time': Generated<number>;
		'is_todo': Generated<number>;
		'todo_completed': Generated<number>;
		'parent_id': Generated<string>;
		'latitude': Generated<number>;
		'longitude': Generated<number>;
		'altitude': Generated<number>;
		'source_url': Generated<string>;
		'todo_due': Generated<number>;
		rowid: Generated<number>;
	};
	resource_local_states: {
		'id': Generated<number>;
		'resource_id': string;
		'fetch_status': Generated<number>;
		'fetch_error': Generated<string>;
		rowid: Generated<number>;
	};
	resources: {
		'id': string | null;
		'title': Generated<string>;
		'mime': string;
		'filename': Generated<string>;
		'created_time': number;
		'updated_time': number;
		'user_created_time': Generated<number>;
		'user_updated_time': Generated<number>;
		'file_extension': Generated<string>;
		'encryption_cipher_text': Generated<string>;
		'encryption_applied': Generated<number>;
		'encryption_blob_encrypted': Generated<number>;
		'size': Generated<number>;
		'is_shared': Generated<number>;
		'share_id': Generated<string>;
		'master_key_id': Generated<string>;
		'user_data': Generated<string>;
		'blob_updated_time': Generated<number>;
		'ocr_text': Generated<string>;
		'ocr_details': Generated<string>;
		'ocr_status': Generated<number>;
		'ocr_error': Generated<string>;
		'ocr_driver_id': Generated<number>;
		'is_locked': Generated<number>;
		rowid: Generated<number>;
	};
	resources_to_download: {
		'id': Generated<number>;
		'resource_id': string;
		'updated_time': number;
		'created_time': number;
		rowid: Generated<number>;
	};
	revisions: {
		'id': string | null;
		'parent_id': Generated<string>;
		'item_type': number;
		'item_id': string;
		'item_updated_time': number;
		'title_diff': Generated<string>;
		'body_diff': Generated<string>;
		'metadata_diff': Generated<string>;
		'encryption_cipher_text': Generated<string>;
		'encryption_applied': Generated<number>;
		'updated_time': number;
		'created_time': number;
		'is_locked': Generated<number>;
		rowid: Generated<number>;
	};
	settings: {
		'key': string | null;
		'value': string | null;
		rowid: Generated<number>;
	};
	sync_items: {
		'id': Generated<number>;
		'sync_target': number;
		'sync_time': Generated<number>;
		'item_type': number;
		'item_id': string;
		'sync_disabled': Generated<number>;
		'sync_disabled_reason': Generated<string>;
		'force_sync': Generated<number>;
		'item_location': Generated<number>;
		'sync_warning_ignored': Generated<number>;
		'remote_item_updated_time': Generated<number>;
		'base_body': Generated<string>;
		'base_title': Generated<string>;
		'base_conflict_note_id': Generated<string>;
		rowid: Generated<number>;
	};
	table_fields: {
		'id': Generated<number>;
		'table_name': string;
		'field_name': string;
		'field_type': number;
		'field_default': string | null;
		rowid: Generated<number>;
	};
	tags: {
		'id': string | null;
		'title': Generated<string>;
		'created_time': number;
		'updated_time': number;
		'user_created_time': Generated<number>;
		'user_updated_time': Generated<number>;
		'encryption_cipher_text': Generated<string>;
		'encryption_applied': Generated<number>;
		'is_shared': Generated<number>;
		'parent_id': Generated<string>;
		'user_data': Generated<string>;
		rowid: Generated<number>;
	};
	tags_with_note_count: {
		'id': string | null;
		'title': string | null;
		'created_time': number | null;
		'updated_time': number | null;
		'note_count': string | number | null;
		'todo_completed_count': string | number | null;
	};
	version: {
		'version': number;
		'table_fields_version': Generated<number>;
		rowid: Generated<number>;
	};
	note_embeddings_vec: { rowid: number; embedding: Uint8Array; distance: number; k: number };
}
