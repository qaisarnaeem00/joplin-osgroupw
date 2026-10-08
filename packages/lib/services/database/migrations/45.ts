import { compileQuery, queryBuilder, sql } from '../queryBuilder';
import sqlStringToLines from '../sqlStringToLines';
import { SqlQuery } from '../types';

export default (): (SqlQuery|string)[] => {
	const queries: (SqlQuery|string)[] = [];

	queries.push(compileQuery(
		queryBuilder.schema
			.alterTable('resources')
			.addColumn('ocr_text', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
	));
	queries.push(compileQuery(
		queryBuilder.schema
			.alterTable('resources')
			.addColumn('ocr_details', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
	));
	queries.push(compileQuery(
		queryBuilder.schema
			.alterTable('resources')
			.addColumn('ocr_status', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
	));
	queries.push(compileQuery(
		queryBuilder.schema
			.alterTable('resources')
			.addColumn('ocr_error', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
	));

	const itemsNormalized = compileQuery(
		queryBuilder.schema
			.createTable('items_normalized')
			.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey().autoIncrement())
			.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('item_id', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('item_type', sql.raw('INT'), (column) => column.notNull())
			.addColumn('user_updated_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('reserved1', sql.raw('INT'))
			.addColumn('reserved2', sql.raw('INT'))
			.addColumn('reserved3', sql.raw('INT'))
			.addColumn('reserved4', sql.raw('INT'))
			.addColumn('reserved5', sql.raw('INT'))
			.addColumn('reserved6', sql.raw('INT')),
	);

	queries.push(itemsNormalized);

	queries.push(compileQuery(queryBuilder.schema.createIndex('items_normalized_id').on('items_normalized').columns(['id'])));
	queries.push(compileQuery(
		queryBuilder.schema.createIndex('items_normalized_item_id').on('items_normalized').columns(['item_id']),
	));
	queries.push(compileQuery(
		queryBuilder.schema
			.createIndex('items_normalized_item_type')
			.on('items_normalized')
			.columns(['item_type']),
	));

	const tableFields = 'id, title, body, item_id, item_type, user_updated_time, reserved1, reserved2, reserved3, reserved4, reserved5, reserved6';

	const newVirtualTableSql = `
		CREATE VIRTUAL TABLE items_fts USING fts4(
			content="items_normalized",
			notindexed="id",
			notindexed="item_id",
			notindexed="item_type",
			notindexed="user_updated_time",
			notindexed="reserved1",
			notindexed="reserved2",
			notindexed="reserved3",
			notindexed="reserved4",
			notindexed="reserved5",
			notindexed="reserved6",
			${tableFields}
		);`
	;

	queries.push(sqlStringToLines(newVirtualTableSql)[0]);

	queries.push(`
		CREATE TRIGGER items_fts_before_update BEFORE UPDATE ON items_normalized BEGIN
			DELETE FROM items_fts WHERE docid=old.rowid;
		END;`);
	queries.push(`
		CREATE TRIGGER items_fts_before_delete BEFORE DELETE ON items_normalized BEGIN
			DELETE FROM items_fts WHERE docid=old.rowid;
		END;`);
	queries.push(`
		CREATE TRIGGER items_after_update AFTER UPDATE ON items_normalized BEGIN
			INSERT INTO items_fts(docid, ${tableFields}) SELECT rowid, ${tableFields} FROM items_normalized WHERE new.rowid = items_normalized.rowid;
		END;`);
	queries.push(`
		CREATE TRIGGER items_after_insert AFTER INSERT ON items_normalized BEGIN
			INSERT INTO items_fts(docid, ${tableFields}) SELECT rowid, ${tableFields} FROM items_normalized WHERE new.rowid = items_normalized.rowid;
		END;`);

	return queries;
};
