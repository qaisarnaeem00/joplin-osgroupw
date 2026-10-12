import { addColumn, createTable } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('sync_items', 'base_body', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('sync_items', 'base_title', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('sync_items', 'base_conflict_note_id', 'TEXT NOT NULL DEFAULT ""'),
		createTable('conflict_note_states', {
			note_id: 'TEXT PRIMARY KEY',
			base_body: 'TEXT NOT NULL DEFAULT ""',
			base_title: 'TEXT NOT NULL DEFAULT ""',
			remote_body: 'TEXT NOT NULL DEFAULT ""',
			remote_title: 'TEXT NOT NULL DEFAULT ""',
			remote_updated_time: 'INT NOT NULL DEFAULT 0',
		}).ifNotExists(),
	];
};
