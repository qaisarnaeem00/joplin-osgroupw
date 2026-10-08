import { compileQuery, queryBuilder, sql, selectQuery } from '../services/database/queryBuilder';
import BaseModel, { ModelType } from '../BaseModel';
import shim from '../shim';
import eventManager, { EventName } from '../eventManager';
import { ItemChangeEntity, SqlQuery } from '../services/database/types';
import { Mutex } from 'async-mutex';

export interface ChangeSinceIdOptions {
	limit?: number;
	fields?: string[];
}

interface BaseAddOptions {
	changeSource?: number|null;
	changeId?: string|null;
}

interface AddOneOptions extends BaseAddOptions {
	beforeChangeItemJson?: string|null;
}

interface AddMultiOptions extends BaseAddOptions {
	beforeChangeItemJsons?: string[]|null;
}

export default class ItemChange extends BaseModel {

	private static addChangeMutex_: Mutex = new Mutex();
	private static saveCalls_: boolean[] = [];

	public static TYPE_CREATE = 1;
	public static TYPE_UPDATE = 2;
	public static TYPE_DELETE = 3;

	public static SOURCE_UNSPECIFIED = 1;
	public static SOURCE_SYNC = 2;
	public static SOURCE_DECRYPTION = 2; // CAREFUL - SAME ID AS SOURCE_SYNC!
	public static SOURCE_SHARE_SERVICE = 4;

	public static tableName() {
		return 'item_changes';
	}

	public static modelType() {
		return BaseModel.TYPE_ITEM_CHANGE;
	}

	public static async addMulti(
		itemType: ModelType,
		itemIds: string[],
		type: number,
		{ changeSource = null, changeId = null, beforeChangeItemJsons = null }: AddMultiOptions = {},
	) {
		if (!itemIds.length) return;

		if (changeSource === null) changeSource = ItemChange.SOURCE_UNSPECIFIED;
		if (beforeChangeItemJsons && beforeChangeItemJsons.length !== itemIds.length) throw new Error('beforeChangeItemJsons does not match itemIds');

		ItemChange.saveCalls_.push(true);

		// Using a mutex so that records can be added to the database in the
		// background, without making the UI wait.
		const release = await ItemChange.addChangeMutex_.acquire();

		try {
			const queries: SqlQuery[] = [];

			for (let i = 0; i < itemIds.length; i++) {
				const itemId = itemIds[i];
				const beforeChangeItemJson = beforeChangeItemJsons ? beforeChangeItemJsons[i] : '';

				queries.push(compileQuery(
					queryBuilder.deleteFrom('item_changes').where((eb) => eb(sql.ref('item_id'), '=', sql.val(itemId))),
				));

				queries.push(compileQuery(
					queryBuilder
						.insertInto('item_changes')
						.values([
							{
								item_type: sql.val(itemType),
								item_id: sql.val(itemId),
								type: sql.val(type),
								source: sql.val(changeSource),
								created_time: sql.val(Date.now()),
								before_change_item: sql.val(beforeChangeItemJson),
							},
						]),
				));
			}

			await this.db().transactionExecBatch(queries);
		} finally {
			release();
			ItemChange.saveCalls_.pop();

			for (const itemId of itemIds) {
				eventManager.emit(EventName.ItemChange, {
					itemType: itemType,
					itemId,
					changeId,
					eventType: type,
				});
			}
		}
	}

	public static async add(itemType: ModelType, itemId: string, type: number, options: AddOneOptions = {}) {
		await this.addMulti(itemType, [itemId], type, {
			...options,
			beforeChangeItemJsons: options?.beforeChangeItemJson ? [options.beforeChangeItemJson] : null,
		});
	}

	public static async lastChangeId() {
		const row = await this.db().selectOne(compileQuery(
			queryBuilder.selectFrom('item_changes').select([queryBuilder.fn('max', [sql.ref('id')]).as('max_id')]),
		));
		return row && row.max_id ? row.max_id : 0;
	}

	// Because item changes are recorded in the background, this function
	// can be used for synchronous code, in particular when unit testing.
	public static async waitForAllSaved() {
		return new Promise((resolve) => {
			const iid = shim.setInterval(() => {
				if (!ItemChange.saveCalls_.length) {
					shim.clearInterval(iid);
					resolve(null);
				}
			}, 100);
		});
	}

	public static async deleteOldChanges(lowestChangeId: number, itemMinTtl: number) {
		if (!lowestChangeId) return;

		const cutOffDate = Date.now() - itemMinTtl;

		return this.db().exec(compileQuery(
			queryBuilder
				.deleteFrom('item_changes')
				.where((eb) =>
					eb.and([
						eb(sql.ref('id'), '<=', sql.val(lowestChangeId)),
						eb(sql.ref('created_time'), '<=', sql.val(cutOffDate)),
					]),
				),
		));
	}

	public static async changesSinceId(changeId: number, options: ChangeSinceIdOptions = null): Promise<ItemChangeEntity[]> {
		options = {
			limit: 100,
			fields: ['id', 'item_type', 'item_id', 'type', 'created_time'],
			...options,
		};

		return this.db().selectAll(selectQuery('item_changes', options.fields).where('id', '>', changeId).orderBy('id').limit(options.limit));
	}

	public static async itemChange(itemType: ModelType, itemId: string): Promise<ItemChangeEntity> {
		return await this.db().selectOne(compileQuery(
			queryBuilder
				.selectFrom('item_changes')
				.select(['item_type', 'item_id', 'type', 'source', 'created_time', 'before_change_item'])
				.where((eb) =>
					eb.and([
						eb(sql.ref('item_type'), '=', sql.val(itemType)),
						eb(sql.ref('item_id'), '=', sql.val(itemId)),
					]),
				)
				.orderBy(sql.ref('created_time'), 'desc')
				.limit(1),
		));
	}

	public static async oldNoteContent(noteId: string): Promise<string> {
		const itemChange = await this.itemChange(ModelType.Note, noteId);
		return itemChange && itemChange.before_change_item ? itemChange.before_change_item : null;
	}

	public static async resetOldNoteContent(noteId: string) {
		const itemChange = await this.itemChange(ModelType.Note, noteId);

		// Only create a new item change if there is an existing item change and it has the before_change_item populated on it
		if (itemChange && itemChange.before_change_item) {
			await this.add(itemChange.item_type, itemChange.item_id, itemChange.type);
		}
	}

}
