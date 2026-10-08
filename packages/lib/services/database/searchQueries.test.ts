import JoplinDatabase from '../../JoplinDatabase';
import { DatabaseDriverNode } from '../../database-driver-node';
import buildQuery from '../search/queryBuilder';

interface LegacySearch {
	terms: { name: string; value: string; negated: boolean }[];
	useFts: boolean;
	query: string;
	params: string[];
}
const legacy: LegacySearch[] = require('./fixtures/legacy-search.json');

describe('search query behaviour against the original SQL', () => {
	let db: JoplinDatabase;
	beforeAll(async () => {
		db = new JoplinDatabase(new DatabaseDriverNode());
		await db.open({ name: ':memory:' });
		for (const [id, title, parent] of [['root', 'Root', ''], ['child', 'Child', 'root'], ['other', 'Other', '']]) {
			await db.exec('INSERT INTO folders (id, title, parent_id, created_time, updated_time) VALUES (?, ?, ?, 1, 2)', [id, title, parent]);
		}
		for (const [id, title, body, parent] of [
			['note-a', 'alpha', 'visible text', 'root'], ['note-b', 'alpha', 'hidden text', 'child'],
			['note-c', 'beta', 'other text', 'other'], ['note-d', 'alpha', 'visible text', 'root'],
		]) {
			await db.exec('INSERT INTO notes (id, title, body, parent_id, created_time, updated_time, is_todo, todo_due) VALUES (?, ?, ?, ?, 1, 2, 1, 1700000000000)', [id, title, body, parent]);
			await db.exec('INSERT INTO notes_normalized (id, title, body, parent_id, is_todo, todo_due) VALUES (?, ?, ?, ?, 1, 1700000000000)', [id, title, body, parent]);
		}
		for (const tag of ['red', 'blue']) {
			await db.exec('INSERT INTO tags (id, title, created_time, updated_time) VALUES (?, ?, 1, 2)', [tag, tag]);
		}
		for (const [note, tag] of [['note-a', 'red'], ['note-a', 'blue'], ['note-b', 'blue'], ['note-c', 'red']]) {
			await db.exec('INSERT INTO note_tags (id, note_id, tag_id, created_time, updated_time) VALUES (?, ?, ?, 1, 2)', [`${note}-${tag}`, note, tag]);
		}
		for (const [id, mime, note, associated] of [['image', 'image/png', 'note-a', 1], ['pdf', 'application/pdf', 'note-b', 1], ['unassociated', 'image/jpeg', 'note-c', 0]]) {
			await db.exec('INSERT INTO resources (id, mime, created_time, updated_time) VALUES (?, ?, 1, 2)', [id, mime]);
			await db.exec('INSERT INTO note_resources (note_id, resource_id, is_associated, last_seen_time) VALUES (?, ?, ?, 0)', [note, id, associated]);
		}
	});
	afterAll(async () => db.close());

	test.each(legacy.map((example, index) => [index, example] as const))('preserves filter combination %i', async (_index, example) => {
		const actual = buildQuery(example.terms, example.useFts);
		let expected;
		try { expected = await db.selectAll(example.query, example.params); } catch (error) {
			// Keep the same failure that tells SearchEngine to use basic search.
			expect(error.message).toContain('unable to use function MATCH');
			await expect(db.selectAll(actual.query, actual.params)).rejects.toThrow('unable to use function MATCH');
			return;
		}
		const rows = await db.selectAll(actual.query, actual.params);
		const sorted = (items: typeof rows) => items.sort((a, b) => a.id.localeCompare(b.id));
		expect(sorted(rows)).toEqual(sorted(expected));
	});
});
