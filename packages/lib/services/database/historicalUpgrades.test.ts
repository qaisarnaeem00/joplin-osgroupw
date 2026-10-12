import { readFileSync } from 'fs';
import { resolve } from 'path';
import Database from '../../database';
import JoplinDatabase from '../../JoplinDatabase';
import { DatabaseDriverNode } from '../../database-driver-node';
import { db, compile } from './kysely';
import type { HistoricalUpgradeFixtures } from './captureHistoricalUpgradeFixtures';

const fixtures: HistoricalUpgradeFixtures = JSON.parse(readFileSync(resolve(__dirname, 'historicalUpgradeFixtures.json'), 'utf8'));
const fallbackVersions = [15, 18, 33, 34];

async function replay(connection: Database, fromVersion: number, toVersion: number) {
	for (const batch of fixtures.batches.filter(batch => batch.version > fromVersion && batch.version <= toVersion)) {
		try {
			await connection.transactionExecBatch(batch.queries);
		} catch (error) {
			if (!fallbackVersions.includes(batch.version)) throw error;
			await connection.exec(batch.queries[batch.queries.length - 1]);
		}
	}
}

async function columns(connection: Database, table: string) {
	return connection.selectAll(`PRAGMA table_info(${JSON.stringify(table)})`);
}

async function populate(connection: Database) {
	const rows: Record<string, Record<string, unknown>> = {
		folders: { id: 'folder', title: 'Historical folder', created_time: 100, updated_time: 200 },
		notes: { id: 'note', parent_id: 'folder', title: 'Historical \'title\'', body: 'historical searchable text', created_time: 100, updated_time: 200, order: 3 },
		tags: { id: 'tag', title: 'Historical tag', created_time: 100, updated_time: 200 },
		note_tags: { id: 'association', note_id: 'note', tag_id: 'tag', created_time: 100, updated_time: 200 },
		resources: { id: 'resource', title: 'Historical resource', mime: 'text/plain', created_time: 100, updated_time: 200 },
		settings: { key: 'sync.context', value: '{"cursor":"historical"}', type: 1 },
		conflict_note_states: { note_id: 'note', base_title: 'Discarded by migration 53' },
	};
	for (const [table, values] of Object.entries(rows)) {
		const fields = await columns(connection, table);
		if (!fields.length) continue;
		const available = new Set(fields.map(field => field.name));
		const row = Object.fromEntries(Object.entries(values).filter(([name]) => available.has(name)));
		await connection.exec(compile(db.insertInto(table).values(row)));
	}
}

function normalizeDefault(value: string | null) {
	return value === null ? null : String(value).replace(/^\((.*)\)$/, '$1').replace(/^["'](.*)["']$/, '$1');
}

async function snapshot(connection: Database) {
	const objects = await connection.selectAll<{ name: string; type: string; tbl_name: string }>(
		'SELECT name, type, tbl_name FROM sqlite_master WHERE name NOT LIKE \'sqlite_%\' ORDER BY type, name');
	const tables: Record<string, unknown> = {};
	for (const object of objects.filter(object => object.type === 'table')) {
		const fields = await columns(connection, object.name);
		const indexes = await connection.selectAll(`PRAGMA index_list(${JSON.stringify(object.name)})`);
		const indexDetails = [];
		for (const index of indexes) {
			const indexedColumns = await connection.selectAll(`PRAGMA index_xinfo(${JSON.stringify(index.name)})`);
			indexDetails.push({ name: index.name, unique: index.unique, origin: index.origin, partial: index.partial, columns: indexedColumns });
		}
		tables[object.name] = {
			columns: fields.map(field => ({ ...field, type: field.type.toUpperCase(), dflt_value: normalizeDefault(field.dflt_value) })),
			indexes: indexDetails.sort((a, b) => a.name.localeCompare(b.name)),
		};
	}
	const data: Record<string, unknown> = {};
	for (const table of ['notes', 'folders', 'tags', 'note_tags', 'resources', 'settings', 'conflict_note_states', 'version', 'migrations']) {
		if (!objects.some(object => object.name === table)) continue;
		const rows = await connection.selectAll(`SELECT * FROM "${table}"`);
		if (table === 'migrations') {
			data[table] = rows.map(row => row.number).sort((a, b) => a - b);
		} else {
			data[table] = rows;
		}
	}
	return { objects, tables, data };
}

async function verifySearchAndViews(connection: Database) {
	const tags = await connection.selectAll('SELECT * FROM tags_with_note_count');
	expect(tags).toEqual([expect.objectContaining({ id: 'tag', note_count: 1, todo_completed_count: 0 })]);
	// Trigger behavior proves the rewritten trigger bodies, beyond object names.
	await connection.exec(db.insertInto('items_normalized').values({ item_id: 'trigger-note', item_type: 1, title: 'searchable', body: 'body' }));
	expect(await connection.selectAll('SELECT item_id FROM items_fts WHERE items_fts MATCH \'searchable\''))
		.toEqual([{ item_id: 'trigger-note' }]);
	await connection.exec(db.updateTable('items_normalized').set({ title: 'replacement' }).where('item_id', '=', 'trigger-note'));
	expect(await connection.selectAll('SELECT item_id FROM items_fts WHERE items_fts MATCH \'searchable\'')).toEqual([]);
	expect(await connection.selectAll('SELECT item_id FROM items_fts WHERE items_fts MATCH \'replacement\''))
		.toEqual([{ item_id: 'trigger-note' }]);
	await connection.exec(db.deleteFrom('items_normalized').where('item_id', '=', 'trigger-note'));
	expect(await connection.selectAll('SELECT item_id FROM items_fts WHERE items_fts MATCH \'replacement\'')).toEqual([]);
	await connection.exec(db.insertInto('conflict_note_states').values({ note_id: 'unique-note' }));
	await expect(connection.exec(db.insertInto('conflict_note_states').values({ note_id: 'unique-note' })))
		.rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT' });
}

describe('Historical database upgrades', () => {
	jest.setTimeout(60000);

	it('rolls back ordinary migration failures without advancing the version', async () => {
		const driver = new DatabaseDriverNode();
		await driver.open({ name: ':memory:' });
		const connection = new JoplinDatabase(driver);
		try {
			await replay(connection, 0, 52);
			await populate(connection);
			const before = await snapshot(connection);
			const execute = driver.exec.bind(driver);
			const failure = jest.spyOn(driver, 'exec').mockImplementation(async (statement, parameters) => {
				if (/create table[\s\S]*conflict_note_states/i.test(statement)) throw new Error('Injected ordinary migration failure');
				return execute(statement, parameters);
			});
			await expect(connection.upgradeDatabase(52)).rejects.toThrow('Injected ordinary migration failure');
			failure.mockRestore();
			expect(await snapshot(connection)).toEqual(before);
			await connection.upgradeDatabase(52);
			expect(await connection.selectAll('SELECT * FROM conflict_note_states')).toEqual([]);
		} finally {
			await driver.close();
		}
	});

	it('records failed full text upgrades before continuing with the fallback', async () => {
		const driver = new DatabaseDriverNode();
		await driver.open({ name: ':memory:' });
		const connection = new JoplinDatabase(driver);
		try {
			await replay(connection, 0, 14);
			await populate(connection);
			const execute = driver.exec.bind(driver);
			let failed = false;
			let recordedFailureVersion = false;
			const failure = jest.spyOn(driver, 'exec').mockImplementation(async (statement, parameters) => {
				if (!failed && /create virtual table[\s\S]*notes_fts/i.test(statement)) {
					failed = true;
					throw new Error('Injected full text migration failure');
				}
				if (failed && /update[\s\S]*version[\s\S]*set[\s\S]*version/i.test(statement) && parameters?.[0] === 15) recordedFailureVersion = true;
				return execute(statement, parameters);
			});
			expect(await connection.upgradeDatabase(14)).toBe(53);
			failure.mockRestore();
			expect(failed).toBe(true);
			expect(recordedFailureVersion).toBe(true);
			expect(await connection.selectOne('SELECT version FROM version')).toEqual({ version: 53 });
			expect(await connection.selectOne('SELECT title FROM notes WHERE id = ?', ['note']))
				.toEqual({ title: 'Historical \'title\'' });
		} finally {
			await driver.close();
		}
	});

	it.each(Array.from({ length: 54 }, (_, version) => version))('preserves populated profile version %i', async startingVersion => {
		const expectedDriver = new DatabaseDriverNode();
		const actualDriver = new DatabaseDriverNode();
		await expectedDriver.open({ name: ':memory:' });
		await actualDriver.open({ name: ':memory:' });
		const expected = new Database(expectedDriver);
		const actual = new JoplinDatabase(actualDriver);
		try {
			await replay(expected, 0, startingVersion);
			await replay(actual, 0, startingVersion);
			if (startingVersion) {
				await populate(expected);
				await populate(actual);
			}
			await replay(expected, startingVersion, 53);
			await actual.upgradeDatabase(startingVersion);
			expect(await snapshot(actual)).toEqual(await snapshot(expected));
			if (startingVersion) await verifySearchAndViews(actual);
			expect(await actual.upgradeDatabase(53)).toBe(53);
			await expect(actual.upgradeDatabase(54)).rejects.toThrow('Unknown profile version');
		} finally {
			await expectedDriver.close();
			await actualDriver.close();
		}
	});
});
