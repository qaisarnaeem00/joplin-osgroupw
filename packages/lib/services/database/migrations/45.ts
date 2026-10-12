import { db } from '../kysely';
import { addColumn, createTable, createTrigger, ftsTable } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	const columns = ['id', 'title', 'body', 'item_id', 'item_type', 'user_updated_time', 'reserved1', 'reserved2', 'reserved3', 'reserved4', 'reserved5', 'reserved6'];
	const queries: StringOrSqlQuery[] = [
		addColumn('resources', 'ocr_text', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('resources', 'ocr_details', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('resources', 'ocr_status', 'INT NOT NULL DEFAULT 0'),
		addColumn('resources', 'ocr_error', 'TEXT NOT NULL DEFAULT ""'),
		createTable('items_normalized', {
			id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
			title: 'TEXT NOT NULL DEFAULT ""',
			body: 'TEXT NOT NULL DEFAULT ""',
			item_id: 'TEXT NOT NULL',
			item_type: 'INT NOT NULL',
			user_updated_time: 'INT NOT NULL DEFAULT 0',
			reserved1: 'INT NULL',
			reserved2: 'INT NULL',
			reserved3: 'INT NULL',
			reserved4: 'INT NULL',
			reserved5: 'INT NULL',
			reserved6: 'INT NULL',
		}),
	];
	for (const column of ['id', 'item_id', 'item_type']) {
		queries.push(db.schema.createIndex(`items_normalized_${column}`).on('items_normalized').column(column));
	}
	queries.push(ftsTable('items_fts', 'items_normalized', columns, columns.filter(column => column !== 'title' && column !== 'body')));
	const removeOld = db.deleteFrom('items_fts').whereRef('docid', '=', 'old.rowid');
	const insertNew = db.insertInto('items_fts').columns(['docid', ...columns]).expression(
		db.selectFrom('items_normalized').select(['rowid', ...columns]).whereRef('new.rowid', '=', 'items_normalized.rowid'));
	queries.push(createTrigger('items_fts_before_update', 'before', 'update', 'items_normalized', [removeOld]));
	queries.push(createTrigger('items_fts_before_delete', 'before', 'delete', 'items_normalized', [removeOld]));
	queries.push(createTrigger('items_after_update', 'after', 'update', 'items_normalized', [insertNew]));
	queries.push(createTrigger('items_after_insert', 'after', 'insert', 'items_normalized', [insertNew]));
	return queries;
};
