import Database from '../../database';
import JoplinDatabase from '../../JoplinDatabase';
import { DatabaseDriverNode } from '../../database-driver-node';
import { SqlQuery } from './types';

// Captured before the migration, with a fixed clock. This fixture is test-only;
// production never reads it or parses legacy SQL into a builder.
const legacy: SqlQuery[][] = require('./fixtures/legacy-upgrades.json');
const fallbackVersions = [15, 18, 33, 34];

async function legacyUpgrade(db: Database, from: number, to = 53) {
	for (let version = from + 1; version <= to; version++) {
		try { await db.transactionExecBatch(legacy[version - 1]); } catch (error) {
			if (!fallbackVersions.includes(version)) throw error;
			await db.exec('UPDATE version SET version = ?', [version]);
		}
	}
}

async function seed(db: Database, version: number) {
	if (!version) return;
	const rows = {
		folders: { id: 'folder', title: 'migration notebook', created_time: 10, updated_time: 20 },
		notes: { id: 'note', parent_id: 'folder', title: 'quoted \' " ? title', body: 'migration text', created_time: 10, updated_time: 20, order: 0.5 },
		resources: { id: 'resource', title: 'attachment', mime: 'text/plain', created_time: 10, updated_time: 20 },
		tags: { id: 'tag', title: 'migration tag', created_time: 10, updated_time: 20 },
		note_tags: { id: 'association', note_id: 'note', tag_id: 'tag', created_time: 10, updated_time: 20 },
		settings: { key: 'sync.context', value: 'legacy context', type: 2 },
	};
	for (const [table, row] of Object.entries(rows)) {
		const columns = (await db.selectAll(`PRAGMA table_info("${table}")`)).map(c => c.name);
		const values = Object.fromEntries(Object.entries(row).filter(([name]) => columns.includes(name)));
		// Independent SQL setup intentionally doesn't use the production builder.
		const names = Object.keys(values);
		await db.exec(`INSERT INTO "${table}" (${names.map(n => `"${n}"`).join(',')}) VALUES (${names.map(() => '?').join(',')})`, Object.values(values));
	}
}

async function snapshot(db: Database) {
	const objects = await db.selectAll('SELECT name, type, tbl_name FROM sqlite_master WHERE name NOT LIKE \'sqlite_%\' ORDER BY name');
	const tables = objects.filter(o => o.type === 'table' && !o.name.startsWith('notes_fts') && !o.name.startsWith('items_fts'));
	const definitions = [];
	for (const table of tables) {
		const columns = await db.selectAll(`PRAGMA table_info("${table.name}")`);
		const indexes = await db.selectAll(`PRAGMA index_list("${table.name}")`);
		const indexColumns = [];
		for (const index of indexes) indexColumns.push({ ...index, columns: await db.selectAll(`PRAGMA index_info("${index.name}")`) });
		definitions.push({ name: table.name, columns, indexes: indexColumns, rows: await db.selectAll(`SELECT * FROM "${table.name}" ORDER BY rowid`) });
	}
	return { objects, definitions, tags: await db.selectAll('SELECT * FROM tags_with_note_count ORDER BY id') };
}

describe('historical SQLite upgrades through Kysely', () => {
	test.each(Array.from({ length: 54 }, (_, index) => index))('preserves a populated profile starting at version %i', async version => {
		jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
		const reference = new Database(new DatabaseDriverNode());
		const actual = new JoplinDatabase(new DatabaseDriverNode());
		await reference.open({ name: ':memory:' });
		// Open only the underlying connection so the test controls the starting version.
		await Database.prototype.open.call(actual, { name: ':memory:' });
		try {
			await legacyUpgrade(reference, 0, version);
			await legacyUpgrade(actual, 0, version);
			await seed(reference, version);
			await seed(actual, version);
			await legacyUpgrade(reference, version);
			expect(await actual.upgradeDatabase(version)).toBe(53);
			expect(await snapshot(actual)).toEqual(await snapshot(reference));
			// Verify the rebuilt triggers, not just their names: insert, update, delete.
			for (const db of [reference, actual]) {
				await db.exec('INSERT INTO notes_normalized (id, title, body) VALUES (\'fts-test\', \'before\', \'indexed text\')');
				await db.exec('UPDATE notes_normalized SET title=\'after\' WHERE id=\'fts-test\'');
			}
			const query = 'SELECT id FROM notes_fts WHERE notes_fts MATCH ? ORDER BY id';
			expect(await actual.selectAll(query, ['after'])).toEqual(await reference.selectAll(query, ['after']));
			for (const db of [reference, actual]) await db.exec('DELETE FROM notes_normalized WHERE id=\'fts-test\'');
			expect(await actual.selectAll(query, ['after'])).toEqual([]);
			expect(await actual.upgradeDatabase(53)).toBe(53);
		} finally {
			await actual.close();
			await reference.close();
			jest.restoreAllMocks();
		}
	}, 60000);

	test.each(fallbackVersions)('records version %i when its optional SQLite extension is unavailable', async version => {
		const db = new JoplinDatabase(new DatabaseDriverNode());
		await Database.prototype.open.call(db, { name: ':memory:' });
		try {
			await legacyUpgrade(db, 0, version - 1);
			const exec = db.exec.bind(db);
			const batch = db.transactionExecBatch.bind(db);
			jest.spyOn(db, 'exec').mockImplementation(async (query, params) => {
				if (/CREATE VIRTUAL TABLE/i.test(db.wrapQuery(query).sql)) throw new Error('no such module: optional extension');
				return exec(query, params);
			});
			jest.spyOn(db, 'transactionExecBatch').mockImplementation(async queries => {
				if (queries.some(query => {
					const wrapped = db.wrapQuery(query);
					return /^UPDATE [`"]?version/i.test(wrapped.sql) && wrapped.params?.[0] === version + 1;
				})) throw new Error('stop after fallback');
				return batch(queries);
			});
			await expect(db.upgradeDatabase(version - 1)).rejects.toThrow('stop after fallback');
			expect(await db.selectOne('SELECT version FROM version')).toEqual({ version });
		} finally { jest.restoreAllMocks(); await db.close(); }
	});

	it('rejects newer profiles without writing to the database', async () => {
		const db = new JoplinDatabase(new DatabaseDriverNode());
		const write = jest.spyOn(db, 'transactionExecBatch');
		await expect(db.upgradeDatabase(54)).rejects.toThrow('Unknown profile version');
		expect(write).not.toHaveBeenCalled();
	});

	it('rolls back a failed ordinary upgrade and keeps its previous version', async () => {
		const db = new JoplinDatabase(new DatabaseDriverNode());
		await Database.prototype.open.call(db, { name: ':memory:' });
		try {
			await legacyUpgrade(db, 0, 48);
			const exec = db.exec.bind(db);
			jest.spyOn(db, 'exec').mockImplementation(async (query, params) => {
				const wrapped = db.wrapQuery(query);
				if (/remote_item_updated_time/i.test(wrapped.sql)) throw new Error('synthetic upgrade failure');
				return exec(query, params);
			});
			await expect(db.upgradeDatabase(48)).rejects.toThrow('synthetic upgrade failure');
			expect(await db.selectOne('SELECT version FROM version')).toEqual({ version: 48 });
		} finally { await db.close(); }
	});
});
