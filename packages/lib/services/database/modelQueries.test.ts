import BaseModel from '../../BaseModel';
import JoplinDatabase from '../../JoplinDatabase';
import { DatabaseDriverNode } from '../../database-driver-node';
import paginatedFeed from '../../models/utils/paginatedFeed';
import { PaginationOrderDir } from '../../models/utils/types';

let db: JoplinDatabase;
class NoteRows extends BaseModel {
	public static tableName() { return 'notes'; }
	public static modelType() { return BaseModel.TYPE_NOTE; }
	public static db() { return db; }
}

describe('shared model builder queries', () => {
	beforeEach(async () => {
		db = new JoplinDatabase(new DatabaseDriverNode());
		await db.open({ name: ':memory:' });
	});
	afterEach(async () => db.close());

	it('loads quoted IDs, preserves empty selections, and binds legacy public predicates', async () => {
		await db.exec('INSERT INTO notes (id, title, body, created_time, updated_time) VALUES (?, ?, ?, ?, ?)', ['id\'quoted', 'alpha', 'literal?value', 1, 2]);
		expect(await NoteRows.byIds([])).toEqual([]);
		expect(await NoteRows.byIds(['id\'quoted'])).toHaveLength(1);
		expect(await NoteRows.all({ fields: ['id'], where: 'body = ?', whereParams: ['literal?value'] })).toMatchObject([{ id: 'id\'quoted' }]);
		expect(await NoteRows.load('absent')).toBeFalsy();
		expect(await NoteRows.search({ titlePattern: 'a*', limit: 0 })).toEqual([]);
	});

	it('loads large ID lists without exceeding SQLite parameter limits', async () => {
		await db.exec('INSERT INTO notes (id, title, created_time, updated_time) VALUES (\'present\', \'title\', 1, 2)');
		const ids = Array.from({ length: 33000 }, (_, index) => `missing${index}`);
		ids.push('present');
		expect(await NoteRows.byIds(ids, { fields: ['id'] })).toMatchObject([{ id: 'present' }]);
	});

	it('preserves the collation on the final equality in a multi-field lookup', async () => {
		await db.exec('INSERT INTO notes (id, title, body, created_time, updated_time) VALUES (\'one\', \'alpha\', \'MiXeD\', 1, 2)');
		expect(await NoteRows.loadByFields({ title: 'alpha', body: 'mixed' }, { caseInsensitive: true })).toMatchObject({ id: 'one' });
		expect(await NoteRows.loadByFields({ title: 'ALPHA', body: 'mixed' }, { caseInsensitive: true })).toBeFalsy();
		expect(await NoteRows.loadByField('title', 'ALPHA', { caseInsensitive: true })).toMatchObject({ id: 'one' });
	});

	it('keeps the ID tie-breaker and page boundaries for equal case-insensitive sort values', async () => {
		for (const [id, title] of [['a', 'same'], ['b', 'SAME'], ['c', 'same']]) {
			await db.exec('INSERT INTO notes (id, title, created_time, updated_time) VALUES (?, ?, 1, 2)', [id, title]);
		}
		const pagination = { limit: 2, page: 1, order: [{ by: 'title', dir: PaginationOrderDir.ASC, caseInsensitive: true }] };
		const first = await paginatedFeed(db, 'notes', pagination, null, ['id']);
		const second = await paginatedFeed(db, 'notes', { ...pagination, page: 2 }, null, ['id']);
		expect(first).toEqual({ items: [{ id: 'a' }, { id: 'b' }], has_more: true });
		expect(second).toEqual({ items: [{ id: 'c' }], has_more: false });
	});
});
