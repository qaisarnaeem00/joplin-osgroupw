import Database from '../../database';
import { DatabaseDriverNode } from '../../database-driver-node';
import { compileExpression, legacyCondition, queryBuilder as qb, sql } from './kysely';

describe('Kysely execution bridge', () => {
	let db: Database;
	beforeEach(async () => {
		db = new Database(new DatabaseDriverNode());
		await db.open({ name: ':memory:' });
		await db.exec(qb.schema.createTable('sample')
			.addColumn('id', 'integer', c => c.primaryKey())
			.addColumn('value', 'text', c => c.defaultTo('default'))
			.addColumn('blob', 'blob'));
	});
	afterEach(async () => db.close());

	it('preserves defaults, nulls, binary data, and the no-row result', async () => {
		await db.exec(qb.insertInto('sample').values({ id: 1 }));
		const blob = Buffer.from([0, 255, 39, 63]);
		await db.exec(qb.insertInto('sample').values({ id: 2, value: null, blob }));
		expect(await db.selectAll(qb.selectFrom('sample').selectAll().orderBy('id'))).toEqual([
			{ id: 1, value: 'default', blob: null }, { id: 2, value: null, blob },
		]);
		expect(await db.selectOne(qb.selectFrom('sample').selectAll().where('id', '=', 3))).toBeUndefined();
	});

	it('keeps undefined update values as null and rejects an empty update condition', async () => {
		await db.exec(Database.insertQuery('sample', { id: 1, value: 'before' }));
		await db.exec(Database.updateQuery('sample', { value: undefined }, { id: 1 }));
		expect(await db.selectOne(qb.selectFrom('sample').select('value'))).toEqual({ value: null });
		await expect(db.exec(Database.updateQuery('sample', { value: 'after' }, {}))).rejects.toThrow();
		expect(await db.selectOne(qb.selectFrom('sample').select('value'))).toEqual({ value: null });
	});

	it('rolls back a failed batch and releases the lock for later writes', async () => {
		await expect(db.transactionExecBatch([
			qb.insertInto('sample').values({ id: 1 }), qb.insertInto('sample').values({ id: 1 }),
		])).rejects.toThrow('UNIQUE');
		expect(await db.selectAll(qb.selectFrom('sample').selectAll())).toEqual([]);
		await db.transactionExecBatch([qb.insertInto('sample').values({ id: 2 }), qb.insertInto('sample').values({ id: 3 })]);
		expect(await db.selectAll(qb.selectFrom('sample').select('id').orderBy('id'))).toEqual([{ id: 2 }, { id: 3 }]);
	});

	it('serializes concurrent batches and retains empty and single-query semantics', async () => {
		const exec = jest.spyOn(db, 'exec');
		await db.transactionExecBatch([]);
		expect(exec).not.toHaveBeenCalled();
		await db.transactionExecBatch([qb.insertInto('sample').values({ id: 1 })]);
		expect(exec).toHaveBeenCalledTimes(1);
		await Promise.all([2, 4].map(id => db.transactionExecBatch([
			qb.insertInto('sample').values({ id }), qb.insertInto('sample').values({ id: id + 1 }),
		])));
		expect((await db.selectAll(qb.selectFrom('sample').selectAll())).length).toBe(5);
	});

	it('preserves SQLite named, repeated, numbered, and omitted predicate bindings', async () => {
		await db.exec(qb.insertInto('sample').values({ id: 1, value: '?literal' }));
		const cases: [string, unknown[]][] = [
			['id = :id OR id = :id', [1]],
			['id = @id OR id = @id', [1]],
			['id = $id::scope(suffix)', [1]],
			['id = ?2', [99, 1]],
			['id = :id AND value = ?2 OR id = ?1', [1, '?literal']],
			['value = \'?literal\' AND id = :id /* ? @ignored */', [1]],
			['id = ?', []],
		];
		for (const [predicate, params] of cases) {
			const expected = await db.selectAll(`SELECT id FROM sample WHERE ${predicate}`, params);
			const actual = await db.selectAll(qb.selectFrom('sample').select('id').where(legacyCondition(predicate, params)));
			expect(actual).toEqual(expected);
		}
	});

	it('binds public legacy predicates without replacing question marks inside literals', async () => {
		await db.exec(qb.insertInto('sample').values({ id: 1, value: '?literal' }));
		const predicate = legacyCondition('value = \'?literal\' AND id = ? /* ? */', [1]);
		expect(await db.selectOne(qb.selectFrom('sample').select('id').where(predicate))).toEqual({ id: 1 });
		expect(await db.selectOne(qb.selectFrom('sample').select('id').where(legacyCondition('id = ?', [])))).toBeUndefined();
		expect(() => legacyCondition('id = ?', [1, 2])).toThrow('parameter count');
		// Functions without a FROM clause are SQLite expressions, compiled by Kysely.
		expect(await db.selectOne(compileExpression(sql`select last_insert_rowid() as id`))).toEqual({ id: 1 });
	});
});
