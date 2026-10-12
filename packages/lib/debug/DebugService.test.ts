import DebugService from './DebugService';
import { setupDatabase, db as testDatabase } from '../testing/test-utils';
import { db } from '../services/database/kysely';

describe('DebugService database cleanup', () => {
	beforeEach(async () => {
		await setupDatabase(1);
	});

	it('clears sync state, resets generated IDs and preserves note content and unrelated settings', async () => {
		const connection = testDatabase(1);
		await connection.exec(db.insertInto('notes').values({ id: 'retained-note', title: 'Retained content', created_time: 1, updated_time: 1 }));
		const change = { item_type: 1, item_id: 'retained-note', type: 1, created_time: 1 };
		await connection.exec(db.insertInto('item_changes').values({ ...change, id: 40 }));
		await connection.exec(db.insertInto('deleted_items').values({ item_type: 1, item_id: 'deleted', deleted_time: 1, sync_target: 2 }));
		await connection.exec(db.insertInto('sync_items').values({ sync_target: 2, item_type: 1, item_id: 'retained-note' }));
		await connection.exec(db.insertInto('key_values').values({ key: 'sync-state', value: 'cached', type: 1, updated_time: 1 }));
		for (const key of ['sync.2.context', 'sync.2.auth', 'unrelated.setting']) {
			await connection.exec(db.insertInto('settings').values({ key, value: 'retained value' }));
		}

		await new DebugService(connection).clearSyncState();

		for (const table of ['item_changes', 'deleted_items', 'sync_items', 'key_values']) {
			expect(await connection.selectAll(db.selectFrom(table).selectAll())).toEqual([]);
		}
		expect(await connection.selectOne(db.selectFrom('notes').select('title').where('id', '=', 'retained-note')))
			.toEqual({ title: 'Retained content' });
		expect(await connection.selectAll(db.selectFrom('settings').select('key').where('key', 'in', ['sync.2.context', 'sync.2.auth', 'unrelated.setting'])))
			.toEqual([{ key: 'unrelated.setting' }]);
		await connection.exec(db.insertInto('item_changes').values(change));
		expect(await connection.selectOne(db.selectFrom('item_changes').select('id'))).toEqual({ id: 1 });
	});
});
