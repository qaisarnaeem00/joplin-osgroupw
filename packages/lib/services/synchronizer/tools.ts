import { compileQuery, queryBuilder } from '../database/queryBuilder';
import JoplinDatabase from '../../JoplinDatabase';
import BaseItem from '../../models/BaseItem';
import Setting from '../../models/Setting';
import SyncTargetRegistry from '../../SyncTargetRegistry';
import { SqlQuery } from '../database/types';

async function clearSyncContext() {
	const syncTargetIds = SyncTargetRegistry.allIds();

	for (const syncTargetId of syncTargetIds) {
		const key = `sync.${syncTargetId}.context`;
		if (Setting.keyExists(key)) {
			Setting.resetKey(key);
		}
	}

	await Setting.saveAll();
}

export async function clearLocalSyncStateForReupload(db: JoplinDatabase) {
	const queries: SqlQuery[] = [
		compileQuery(queryBuilder.deleteFrom('deleted_items')),
		compileQuery(queryBuilder.deleteFrom('sync_items')),
	];

	await db.transactionExecBatch(queries);

	await clearSyncContext();
}

export async function clearLocalDataForRedownload(db: JoplinDatabase) {
	const queries: SqlQuery[] = [
		compileQuery(queryBuilder.deleteFrom('deleted_items')),
		compileQuery(queryBuilder.deleteFrom('sync_items')),
		compileQuery(queryBuilder.deleteFrom('item_changes')),
		compileQuery(queryBuilder.deleteFrom('note_resources')),
	];

	const syncItemTypes = BaseItem.syncItemTypes();

	for (const syncItemType of syncItemTypes) {
		const SyncItemClass = BaseItem.getClassByItemType(syncItemType);
		queries.push(compileQuery(queryBuilder.deleteFrom(SyncItemClass.tableName())));
	}

	await db.transactionExecBatch(queries);

	await clearSyncContext();
}
