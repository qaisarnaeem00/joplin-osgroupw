import { DummyDriver, Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely';
import Database from '../../database';
import { DatabaseDriverNode } from '../../database-driver-node';

describe('Kysely compiled JavaScript compatibility', () => {
	it('compiles a query and executes it on the existing SQLite connection', async () => {
		const builder = new Kysely<{ sample: { id: number; value: string } }>({
			dialect: {
				createDriver: () => new DummyDriver(),
				createAdapter: () => new SqliteAdapter(),
				createIntrospector: db => new SqliteIntrospector(db),
				createQueryCompiler: () => new SqliteQueryCompiler(),
			},
		});
		const db = new Database(new DatabaseDriverNode());
		await db.open({ name: ':memory:' });
		try {
			await db.exec('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)');
			const insert = builder.insertInto('sample').values({ id: 1, value: 'quoted \' value' }).compile();
			await db.exec(insert.sql, [...insert.parameters]);
			const select = builder.selectFrom('sample').selectAll().where('id', '=', 1).compile();
			expect(await db.selectOne(select.sql, [...select.parameters])).toEqual({ id: 1, value: 'quoted \' value' });
		} finally {
			await db.close();
		}
	});
});
