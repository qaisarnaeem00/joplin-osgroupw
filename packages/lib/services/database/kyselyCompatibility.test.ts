import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { db as database } from './kysely';

describe('Kysely compatibility', () => {
	it('compiles schema and distinct queries without Node globals or recent array helpers', async () => {
		const module = { exports: {} as typeof import('kysely') };
		const context = { module, exports: module.exports, console };
		runInNewContext('Array.prototype.at = undefined; Array.prototype.toSorted = undefined; Object.hasOwn = undefined;', context);
		runInNewContext(readFileSync(resolve(__dirname, 'vendor/kysely.cjs'), 'utf8'), context);
		const runtime = module.exports;
		const isolated = new runtime.Kysely<Record<string, { id: string }>>({ dialect: {
			createAdapter: () => new runtime.SqliteAdapter(), createDriver: () => new runtime.DummyDriver(),
			createIntrospector: db => new runtime.SqliteIntrospector(db), createQueryCompiler: () => new runtime.SqliteQueryCompiler(),
		} });
		expect(isolated.selectFrom('notes').select('id').distinct().compile().sql).toContain('distinct');
		expect(isolated.schema.createTable('compatibility').addColumn('id', 'text').addUniqueConstraint('unique_id', ['id']).compile().sql).toContain('unique');
		await expect(isolated.executeQuery(isolated.selectFrom('notes').select('id').compile())).resolves.toEqual({ rows: [] });
	});

	it('loads from compiled CommonJS and compiles parameterized SQLite queries', () => {
		const title = 'A title with \'quotes\'';
		const query = database.selectFrom('notes').select('id').where('title', '=', title).compile();
		expect(query.parameters).toEqual([title]);
		expect(query.sql).toContain('?');
		expect(query.sql).not.toContain(title);
	});
});
