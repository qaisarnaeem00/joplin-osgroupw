import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { transpileModule, ModuleKind } from 'typescript';
import Database from '../../database';
import DatabaseDriver from '../../database-driver';
import { compileQuery, queryBuilder as qb } from './kysely';

// Exercise the actual adapters with stubbed platform APIs. These are argument
// contracts, not a claim that Node tests run a device or an OPFS browser.
function loadAdapter(file: string, dependency: string, platformApi: unknown): new ()=> DatabaseDriver {
	const source = readFileSync(resolve(__dirname, '../../../app-mobile/utils', file), 'utf8');
	const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
	const exported = { exports: {} as { default?: new ()=> DatabaseDriver } };
	runInNewContext(compiled, {
		module: exported, exports: exported.exports,
		require: (name: string) => name === dependency ? platformApi : require(name),
	});
	return exported.exports.default;
}

describe('Kysely platform argument contracts', () => {
	it.each(['native', 'web'])('forwards compiled SQL and parameters through the %s adapter', async platform => {
		const calls: { sql: string; params: unknown }[] = [];
		const row = { id: 'quoted\' ?', value: 'value' };
		let Adapter: new ()=> DatabaseDriver;
		if (platform === 'native') {
			Adapter = loadAdapter('database-driver-react-native.ts', 'react-native-sqlite-storage', {
				openDatabase: (_options: unknown, success: (db: unknown)=> void) => success({
					executeSql: (sql: string, params: unknown, complete: (result: unknown)=> void) => {
						calls.push({ sql, params });
						complete({ rows: { length: 1, item: () => row } });
					},
				}),
			});
		} else {
			Adapter = loadAdapter('database-driver-react-native.web.ts', '@sqlite.org/sqlite-wasm', {
				sqlite3Worker1Promiser: ({ onready }: { onready: ()=> void }) => {
					setTimeout(onready, 0);
					return async (command: string, options: { sql: string; bind: unknown; callback?: (row: unknown)=> void }) => {
						if (command === 'open') return { dbId: 1 };
						calls.push({ sql: options.sql, params: options.bind });
						options.callback?.({ rowNumber: 1, row });
						return {};
					};
				},
			});
		}
		const db = new Database(new Adapter());
		await db.open({ name: 'contract' });
		const query = qb.selectFrom('sample').selectAll().where('id', '=', row.id);
		expect(await db.selectOne(query)).toEqual(row);
		expect(await db.selectAll(query)).toEqual([row]);
		const update = qb.updateTable('sample').set({ value: null }).where('id', '=', row.id);
		await db.exec(update);
		for (const [index, expected] of [query, query, update].entries()) {
			const compiled = compileQuery(expected);
			expect(calls[index]).toEqual({ sql: compiled.sql, params: compiled.params });
		}
	});
});
