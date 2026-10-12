import type { MasterKeyEntity } from '../e2ee/types';
import type { ColumnType, Generated } from 'kysely';
import type {
	AlarmEntity,
	ConflictNoteStateEntity,
	DeletedItemEntity,
	FolderEntity,
	ItemChangeEntity,
	ItemsFtEntity,
	ItemsFtsDocsizeEntity,
	ItemsFtsSegdirEntity,
	ItemsFtsSegmentEntity,
	ItemsFtsStatEntity,
	ItemsNormalizedEntity,
	KeyValueEntity,
	MigrationEntity,
	NoteEmbeddingsMetaEntity,
	NoteResourceEntity,
	NoteTagEntity,
	NoteEntity,
	NotesNormalizedEntity,
	ResourceLocalStateEntity,
	ResourceEntity,
	ResourcesToDownloadEntity,
	RevisionEntity,
	SettingEntity,
	SyncItemEntity,
	TableFieldEntity,
	TagEntity,
	TagsWithNoteCountEntity,
	VersionEntity,
} from './types';

// Persisted rows exclude application metadata. Only actual SQLite defaults
// and integer primary keys may be omitted on insert; nullable columns retain null.
type TableRow<Entity, Defaults extends keyof Entity = never, Nullable extends keyof Entity = never> = {
	[Key in Exclude<keyof Entity, 'type_'>]-?: Key extends Defaults
		? Generated<Key extends Nullable ? Exclude<Entity[Key], undefined> | null : Exclude<Entity[Key], undefined | null>>
		: Key extends Nullable ? Exclude<Entity[Key], undefined> | null : Exclude<Entity[Key], undefined | null>;
};
type ViewRow<Entity> = {
	[Key in Exclude<keyof Entity, 'type_'>]-?: ColumnType<Exclude<Entity[Key], undefined> | null, never, never>;
};

export interface KyselySchema {
	alarms: TableRow<AlarmEntity, 'id', never>;
	conflict_note_states: TableRow<ConflictNoteStateEntity, 'id' | 'base_body' | 'base_title' | 'remote_body' | 'remote_title' | 'remote_updated_time', never>;
	deleted_items: TableRow<DeletedItemEntity, 'id', never>;
	folders: TableRow<FolderEntity, 'title' | 'user_created_time' | 'user_updated_time' | 'encryption_cipher_text' | 'encryption_applied' | 'parent_id' | 'is_shared' | 'share_id' | 'master_key_id' | 'icon' | 'user_data' | 'deleted_time', 'id'>;
	item_changes: TableRow<ItemChangeEntity, 'id' | 'source' | 'before_change_item', never>;
	items_fts: TableRow<ItemsFtEntity, never, 'id' | 'title' | 'body' | 'item_id' | 'item_type' | 'user_updated_time' | 'reserved1' | 'reserved2' | 'reserved3' | 'reserved4' | 'reserved5' | 'reserved6'>;
	items_fts_docsize: TableRow<ItemsFtsDocsizeEntity, 'docid', 'size'>;
	items_fts_segdir: TableRow<ItemsFtsSegdirEntity, 'level' | 'idx', 'start_block' | 'leaves_end_block' | 'end_block' | 'root'>;
	items_fts_segments: TableRow<ItemsFtsSegmentEntity, 'blockid', 'block'>;
	items_fts_stat: TableRow<ItemsFtsStatEntity, 'id', 'value'>;
	items_normalized: TableRow<ItemsNormalizedEntity, 'id' | 'title' | 'body' | 'user_updated_time', 'reserved1' | 'reserved2' | 'reserved3' | 'reserved4' | 'reserved5' | 'reserved6'>;
	key_values: TableRow<KeyValueEntity, 'id', never>;
	migrations: TableRow<MigrationEntity, 'id', never>;
	note_embeddings_meta: TableRow<NoteEmbeddingsMetaEntity, 'id' | 'created_time', never>;
	note_resources: TableRow<NoteResourceEntity, 'id', never>;
	note_tags: TableRow<NoteTagEntity, 'user_created_time' | 'user_updated_time' | 'encryption_cipher_text' | 'encryption_applied' | 'is_shared', 'id'>;
	notes: TableRow<NoteEntity, 'parent_id' | 'title' | 'body' | 'is_conflict' | 'latitude' | 'longitude' | 'altitude' | 'author' | 'source_url' | 'is_todo' | 'todo_due' | 'todo_completed' | 'source' | 'source_application' | 'application_data' | 'order' | 'user_created_time' | 'user_updated_time' | 'encryption_cipher_text' | 'encryption_applied' | 'markup_language' | 'is_shared' | 'share_id' | 'conflict_original_id' | 'master_key_id' | 'user_data' | 'deleted_time' | 'is_locked' | 'extracted_resource_ids', 'id'>;
	notes_normalized: ViewRow<NotesNormalizedEntity>;
	resource_local_states: TableRow<ResourceLocalStateEntity, 'id' | 'fetch_status' | 'fetch_error', never>;
	resources: TableRow<ResourceEntity, 'title' | 'filename' | 'user_created_time' | 'user_updated_time' | 'file_extension' | 'encryption_cipher_text' | 'encryption_applied' | 'encryption_blob_encrypted' | 'size' | 'is_shared' | 'share_id' | 'master_key_id' | 'user_data' | 'blob_updated_time' | 'ocr_text' | 'ocr_details' | 'ocr_status' | 'ocr_error' | 'ocr_driver_id' | 'is_locked', 'id'>;
	resources_to_download: TableRow<ResourcesToDownloadEntity, 'id', never>;
	revisions: TableRow<RevisionEntity, 'parent_id' | 'title_diff' | 'body_diff' | 'metadata_diff' | 'encryption_cipher_text' | 'encryption_applied' | 'is_locked', 'id'>;
	settings: TableRow<SettingEntity, never, 'key' | 'value'>;
	sync_items: TableRow<SyncItemEntity, 'id' | 'sync_time' | 'sync_disabled' | 'sync_disabled_reason' | 'force_sync' | 'item_location' | 'sync_warning_ignored' | 'remote_item_updated_time' | 'base_body' | 'base_title' | 'base_conflict_note_id', never>;
	table_fields: TableRow<TableFieldEntity, 'id', 'field_default'>;
	tags: TableRow<TagEntity, 'title' | 'user_created_time' | 'user_updated_time' | 'encryption_cipher_text' | 'encryption_applied' | 'is_shared' | 'parent_id' | 'user_data', 'id'>;
	tags_with_note_count: ViewRow<TagsWithNoteCountEntity>;
	version: TableRow<VersionEntity, 'table_fields_version', never>;
	master_keys: TableRow<Omit<MasterKeyEntity, 'enabled' | 'hasBeenUsed'>, never, 'id'>;
	note_embeddings_vec: { rowid: Generated<number>; embedding: ColumnType<Uint8Array, string | Uint8Array, string | Uint8Array>; distance: ColumnType<number, never, never>; k: ColumnType<number, never, never> };
	sqlite_sequence: { name: string; seq: number };
	sqlite_master: { type: string; name: string; tbl_name: string; rootpage: number; sql: string | null };
}
