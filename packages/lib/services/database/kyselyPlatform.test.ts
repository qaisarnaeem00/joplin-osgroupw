import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { ModuleKind, transpileModule } from 'typescript';
import Database from '../../database';
import type DatabaseDriver from '../../database-driver';
import { db, compile } from './kysely';

// Execute the actual platform driver methods with their native transport mocked.
// This verifies forwarding and no-row behavior, without claiming device coverage.
function loadDriver(filename: string, dependencies: Record<string, unknown>) {
	const source = readFileSync(resolve(__dirname, '../../../app-mobile/utils', filename), 'utf8');
	const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
	const module = { exports: {} as { default: new ()=> DatabaseDriver } };
	runInNewContext(compiled, { module, exports: module.exports, require: (name: string) => {
		if (!(name in dependencies)) throw new Error(`Unexpected platform dependency: ${name}`);
		return dependencies[name];
	} });
	return new module.exports.default();
}

describe('Kysely platform driver contracts', () => {
	it('forwards bound and binary values through the actual React Native driver', async () => {
		let rows: unknown[] = [{ id: 'result' }];
		const executeSql = jest.fn((_statement, _parameters, success) => success({ rows: {
			length: rows.length, item: (index: number) => rows[index],
		}, insertId: '5' }));
		const driver = loadDriver('database-driver-react-native.ts', {
			'react-native-sqlite-storage': { openDatabase: (_options: unknown, ready: (connection: unknown)=> void) => ready({ executeSql }) },
		});
		await driver.open({ name: 'contract' });
		const connection = new Database(driver);
		const payload = Buffer.from([0, 255]);
		const query = db.selectFrom('notes').select('id').where('title', '=', 'quoted\'value').where('body', '=', payload);
		const compiled = compile(query);
		expect(await connection.selectOne(query)).toEqual({ id: 'result' });
		expect(executeSql.mock.calls[0].slice(0, 2)).toEqual([compiled.sql, compiled.params]);
		expect(await connection.selectAll(query)).toEqual(rows);
		rows = [];
		expect(await connection.selectOne(query)).toBeNull();
		await connection.exec(db.insertInto('notes').values({ id: 'write', body: payload }));
		expect(executeSql.mock.calls[3][1]).toContain(payload);
	});

	it('forwards compiled queries through the actual browser WASM driver', async () => {
		let rows: unknown[] = [{ id: 'result' }];
		const transport = jest.fn(async (command: string, options: Record<string, unknown>) => {
			if (command === 'open') return { dbId: 7 };
			const callback = options.callback as (row: unknown)=> void;
			if (callback) {
				for (const [index, row] of rows.entries()) callback({ rowNumber: index + 1, row });
			}
			return {};
		});
		const driver = loadDriver('database-driver-react-native.web.ts', {
			'@sqlite.org/sqlite-wasm': { sqlite3Worker1Promiser: (options: { onready: ()=> void }) => {
				queueMicrotask(options.onready);
				return transport;
			} },
			'@joplin/utils/path': { safeFilename: (name: string) => name },
		});
		await driver.open({ name: 'contract' });
		const connection = new Database(driver);
		const query = db.selectFrom('notes').select('id').where('title', '=', 'quoted\'value');
		const compiled = compile(query);
		expect(await connection.selectOne(query.compile())).toEqual({ id: 'result' });
		expect(transport.mock.calls[1]).toEqual(['exec', expect.objectContaining({ dbId: 7, sql: compiled.sql, bind: compiled.params })]);
		expect(await connection.selectAll(query)).toEqual(rows);
		rows = [];
		expect(await connection.selectOne(query)).toBeNull();
		const write = db.insertInto('notes').values({ id: 'write', body: Buffer.from([0, 255]) });
		await connection.exec(write);
		expect(transport.mock.calls[4]).toEqual(['exec', expect.objectContaining({ sql: compile(write).sql, bind: compile(write).params })]);
	});
});
