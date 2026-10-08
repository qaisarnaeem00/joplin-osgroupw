import { setupDatabaseAndSynchronizer, switchClient } from './testing/test-utils';
import BaseModel from './BaseModel';
import Database from './database';
import { queryBuilder, rawQuery, literalStrings } from './services/database/queryBuilder';

describe('database', () => {
	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	it('should not modify cached field names', (async () => {
		const db = BaseModel.db();

		const fieldNames = db.tableFieldNames('notes');
		const fieldCount = fieldNames.length;
		fieldNames.push('type_');

		expect(fieldCount).toBeGreaterThan(0);
		expect(db.tableFieldNames('notes').length).toBe(fieldCount);
	}));

	it('should execute builders with bound values and quoted identifiers', async () => {
		const db = BaseModel.db();
		await db.exec(queryBuilder.schema.createTable('builder_values').temporary()
			.addColumn('id', 'integer', column => column.primaryKey())
			.addColumn('order', 'text'));
		const value = 'A quote \' and a question mark ?';
		await db.exec(queryBuilder.insertInto('builder_values').values({ id: 1, order: value }));
		expect(await db.selectOne(queryBuilder.selectFrom('builder_values').selectAll().where('order', '=', value)))
			.toEqual({ id: 1, order: value });
	});

	it('should keep metadata out of writes and bind undefined as null', async () => {
		const db = BaseModel.db();
		await db.exec(queryBuilder.schema.createTable('builder_metadata').temporary()
			.addColumn('id', 'integer', column => column.primaryKey())
			.addColumn('value', 'text', column => column.defaultTo('default')));
		await db.exec(Database.insertQuery('builder_metadata', { id: 1, value: undefined, type_: 1 }));
		expect(await db.selectOne(queryBuilder.selectFrom('builder_metadata').selectAll())).toEqual({ id: 1, value: null });
		await db.exec(Database.updateQuery('builder_metadata', { value: 'changed', internal_: true }, { id: 1 }));
		await db.exec(Database.updateQuery('builder_metadata', { value: undefined }, { id: 1 }));
		expect(await db.selectOne(queryBuilder.selectFrom('builder_metadata').selectAll())).toEqual({ id: 1, value: null });
		expect(() => Database.updateQuery('builder_metadata', { value: 'unsafe' }, {})).toThrow();
	});

	it('should preserve SQL equality with null in object update conditions', async () => {
		const db = BaseModel.db();
		await db.exec(queryBuilder.schema.createTable('builder_nulls').temporary().addColumn('value', 'text'));
		await db.exec(Database.insertQuery('builder_nulls', { value: null }));
		await db.exec(Database.updateQuery('builder_nulls', { value: 'changed' }, { value: null }));
		expect(await db.selectOne(queryBuilder.selectFrom('builder_nulls').selectAll())).toEqual({ value: null });
	});

	it('should bind legacy predicates without treating quoted or commented question marks as parameters', async () => {
		const predicate = rawQuery<boolean>('\'?\' = \'?\' AND value = ? /* ? */ -- ?\n', ['bound \' value']);
		const compiled = queryBuilder.selectFrom('settings').selectAll().where(predicate).compile();
		expect(compiled.parameters).toEqual(['bound \' value']);
	});

	it('should roll back a batch when a builder fails', async () => {
		const db = BaseModel.db();
		await db.exec(queryBuilder.schema.createTable('builder_rollback').temporary().addColumn('id', 'integer', column => column.primaryKey()));
		await expect(db.transactionExecBatch([
			queryBuilder.insertInto('builder_rollback').values({ id: 1 }),
			queryBuilder.insertInto('builder_rollback').values({ id: 1 }),
		])).rejects.toThrow();
		expect(await db.selectAll(queryBuilder.selectFrom('builder_rollback').selectAll())).toEqual([]);
		await db.exec(queryBuilder.insertInto('builder_rollback').values({ id: 2 }));
		expect(await db.selectOne(queryBuilder.selectFrom('builder_rollback').select('id'))).toEqual({ id: 2 });
	});

	it('should preserve large ID lists without exhausting SQLite parameters', async () => {
		const db = BaseModel.db();
		await db.exec(queryBuilder.schema.createTable('builder_large_ids').temporary().addColumn('id', 'text', column => column.primaryKey()));
		const id = 'id with a quote \' and a question mark ?';
		await db.exec(queryBuilder.insertInto('builder_large_ids').values({ id }));
		const ids = [id, ...Array.from({ length: 33000 }, (_, index) => `missing-${index}`)];
		const query = queryBuilder.selectFrom('builder_large_ids').selectAll().where('id', 'in', literalStrings(ids));
		expect(query.compile().parameters).toEqual([]);
		expect(await db.selectAll(query)).toEqual([{ id }]);
	});

});
