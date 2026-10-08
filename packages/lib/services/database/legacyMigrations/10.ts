import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 10 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('item_changes')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey().autoIncrement())
			.addColumn('item_type', sql.raw('INT'), c => c.notNull())
			.addColumn('item_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('type', sql.raw('INT'), c => c.notNull())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('item_changes_item_id').on('item_changes').columns(['item_id'])),
	compileQuery(qb.schema.createIndex('item_changes_created_time').on('item_changes').columns(['created_time'])),
	compileQuery(qb.schema.createIndex('item_changes_item_type').on('item_changes').columns(['item_type'])),
	compileQuery(
		qb.schema
			.createTable('note_resources')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('note_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('resource_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('is_associated', sql.raw('INT'), c => c.notNull())
			.addColumn('last_seen_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(qb.schema.createIndex('note_resources_note_id').on('note_resources').columns(['note_id'])),
	compileQuery(qb.schema.createIndex('note_resources_resource_id').on('note_resources').columns(['resource_id'])),
	compileQuery(
		qb
			.insertInto('item_changes')
			.columns(['item_type', 'item_id', 'type', 'created_time'])
			.expression(
				qb
					.selectFrom('notes')
					.select(eb => [
						eb.val(1).as('__value_1635'),
						'id',
						eb.val(1).as('__value_1660'),
						eb.val(Date.now()).as('__value_1671'),
					]),
			),
	),
];
