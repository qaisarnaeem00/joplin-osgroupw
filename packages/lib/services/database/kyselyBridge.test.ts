import Database from '../../database';
import { setupDatabase, db as testDatabase } from '../../testing/test-utils';
import { db, compile, legacyCondition } from './kysely';

describe('Kysely database bridge', () => {
	beforeEach(async () => {
		await setupDatabase(1);
		await testDatabase(1).exec(db.schema.dropTable('builder_bridge').ifExists());
		await testDatabase(1).exec(db.schema.createTable('builder_bridge')
			.addColumn('id', 'text', column => column.primaryKey())
			.addColumn('label', 'text', column => column.defaultTo('default label'))
			.addColumn('payload', 'blob'));
	});

	it('preserves bound quotes, defaults, nulls, binary values and missing rows', async () => {
		const connection = testDatabase(1);
		const id = 'id\'with quotes';
		const payload = Buffer.from([0, 1, 127, 255]);
		await connection.exec(db.insertInto('builder_bridge').values({ id, payload }));
		await connection.exec(db.insertInto('builder_bridge').values({ id: 'null', label: null, payload: null }));
		expect(await connection.selectOne(db.selectFrom('builder_bridge').selectAll().where('id', '=', id)))
			.toMatchObject({ id, label: 'default label', payload });
		expect(await connection.selectOne(db.selectFrom('builder_bridge').selectAll().where('id', '=', 'null')))
			.toMatchObject({ label: null, payload: null });
		expect(await connection.selectOne(db.selectFrom('builder_bridge').selectAll().where('id', '=', 'missing'))).toBeUndefined();
	});

	it('preserves public SQL conditions with quoted question marks, comments and numbered parameters', async () => {
		const connection = testDatabase(1);
		await connection.exec(db.insertInto('builder_bridge').values({ id: 'quoted\'id', label: '?' }));
		const condition = legacyCondition('label = \'?\' AND id = ?1 /* ? is not a parameter */ AND id = ?1', ['quoted\'id']);
		expect(await connection.selectAll(db.selectFrom('builder_bridge').select('id').where(condition)))
			.toEqual([{ id: 'quoted\'id' }]);
	});

	it('rolls back a failed batch and serializes concurrent batches', async () => {
		const connection = testDatabase(1);
		await expect(connection.transactionExecBatch([
			db.insertInto('builder_bridge').values({ id: 'rolled back' }),
			db.insertInto('builder_bridge').values({ id: 'rolled back' }),
		])).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT' });
		expect(await connection.selectAll(db.selectFrom('builder_bridge').selectAll())).toEqual([]);
		await Promise.all(['first', 'second'].map(prefix => connection.transactionExecBatch([
			db.insertInto('builder_bridge').values({ id: `${prefix}-1` }),
			db.insertInto('builder_bridge').values({ id: `${prefix}-2` }),
		])));
		expect(await connection.selectAll(db.selectFrom('builder_bridge').select('id').orderBy('id')))
			.toEqual([{ id: 'first-1' }, { id: 'first-2' }, { id: 'second-1' }, { id: 'second-2' }]);
	});

	it('forwards compilation to platform driver contracts and preserves short batch behavior', async () => {
		const driver = {
			exec: jest.fn(async () => {}),
			selectOne: jest.fn(async () => ({ id: 'result' })),
			selectAll: jest.fn(async () => [{ id: 'result' }]),
		};
		const connection = new Database(driver);
		const read = db.selectFrom('builder_bridge').select('id').where('label', '=', '\'quoted\'');
		const compiled = compile(read);
		expect(await connection.selectOne(read)).toEqual({ id: 'result' });
		expect(await connection.selectAll(read.compile())).toEqual([{ id: 'result' }]);
		expect(driver.selectOne).toHaveBeenCalledWith(compiled.sql, compiled.params);
		expect(driver.selectAll).toHaveBeenCalledWith(compiled.sql, compiled.params);
		await connection.transactionExecBatch([]);
		expect(driver.exec).not.toHaveBeenCalled();
		const write = db.insertInto('builder_bridge').values({ id: 'single' });
		await connection.transactionExecBatch([write]);
		expect(driver.exec).toHaveBeenCalledTimes(1);
		expect(driver.exec).toHaveBeenCalledWith(compile(write).sql, compile(write).params);
	});
});
