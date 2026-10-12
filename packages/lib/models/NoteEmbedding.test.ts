import { currentDatabase as queryBuilder } from '../services/database/kysely';
import { setupDatabaseAndSynchronizer, switchClient, db } from '../testing/test-utils';
import NoteEmbedding from './NoteEmbedding';
import JoplinDatabase from '../JoplinDatabase';
import { DatabaseDriverNode } from '../database-driver-node';

// These tests exercise the storage layer end-to-end against a real database with
// sqlite-vec loaded. Vectors are hand-crafted unit vectors so KNN ordering is
// deterministic — no embedding model required.

describe('NoteEmbedding', () => {

	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	const skipIfNoVec = () => {
		if (!db(1).sqliteVecAvailable()) {
			// eslint-disable-next-line no-console
			console.warn('Skipping NoteEmbedding vector test: sqlite-vec unavailable');
			return true;
		}
		return false;
	};

	it('reports zero counts on an empty index', async () => {
		expect(await NoteEmbedding.distinctNoteIdCount()).toBe(0);
		expect(await NoteEmbedding.countByNoteId('note-1')).toBe(0);
		expect(await NoteEmbedding.byNoteId('note-1')).toEqual([]);
	});

	it('similaritySearch returns [] on a fresh profile (vec table not yet created)', async () => {
		if (skipIfNoVec()) return;
		// saveChunks creates the vec table lazily. Calling similaritySearch
		// before any save must not crash with "no such table".
		const results = await NoteEmbedding.similaritySearch([1, 0, 0, 0], { k: 5 });
		expect(results).toEqual([]);
	});

	it('clearAll is a no-op on a fresh profile (vec table not yet created)', async () => {
		if (skipIfNoVec()) return;
		await expect(NoteEmbedding.clearAll()).resolves.toBeUndefined();
	});

	it('saves and reads back chunks for a note', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'test-model-v1', [
			{ chunkIndex: 0, chunkText: 'first chunk', vector: [1, 0, 0, 0] },
			{ chunkIndex: 1, chunkText: 'second chunk', vector: [0, 1, 0, 0] },
		]);

		const rows = await NoteEmbedding.byNoteId('note-1');
		expect(rows.length).toBe(2);
		expect(rows[0].chunk_index).toBe(0);
		expect(rows[0].chunk_text).toBe('first chunk');
		expect(rows[0].model_id).toBe('test-model-v1');
		expect(rows[1].chunk_index).toBe(1);
		expect(rows[1].chunk_text).toBe('second chunk');

		expect(await NoteEmbedding.distinctNoteIdCount()).toBe(1);
		expect(await NoteEmbedding.countByNoteId('note-1')).toBe(2);
	});

	it('replaces existing chunks on subsequent saveChunks for the same note', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'old', vector: [1, 0, 0, 0] },
			{ chunkIndex: 1, chunkText: 'old', vector: [0, 1, 0, 0] },
		]);
		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'new', vector: [0, 0, 1, 0] },
		]);

		const rows = await NoteEmbedding.byNoteId('note-1');
		expect(rows.length).toBe(1);
		expect(rows[0].chunk_text).toBe('new');
	});

	it('similaritySearch returns chunks in distance order', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'aligned-with-x', vector: [1, 0, 0, 0] },
			{ chunkIndex: 1, chunkText: 'aligned-with-y', vector: [0, 1, 0, 0] },
			{ chunkIndex: 2, chunkText: 'aligned-with-z', vector: [0, 0, 1, 0] },
		]);

		const results = await NoteEmbedding.similaritySearch([0.9, 0.1, 0, 0], { k: 3 });
		expect(results.length).toBe(3);
		expect(results[0].chunkText).toBe('aligned-with-x');
		expect(results[1].chunkText).toBe('aligned-with-y');
		expect(results[2].chunkText).toBe('aligned-with-z');
		expect(results[0].distance).toBeLessThan(results[1].distance);
		expect(results[1].distance).toBeLessThan(results[2].distance);
	});

	it('similaritySearch respects the noteIds scope filter', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'note-1 chunk', vector: [1, 0, 0, 0] },
		]);
		await NoteEmbedding.saveChunks('note-2', 'm', [
			{ chunkIndex: 0, chunkText: 'note-2 chunk', vector: [0.95, 0.05, 0, 0] },
		]);

		const all = await NoteEmbedding.similaritySearch([1, 0, 0, 0], { k: 10 });
		expect(all.map(r => r.noteId).sort()).toEqual(['note-1', 'note-2']);

		const scoped = await NoteEmbedding.similaritySearch([1, 0, 0, 0], { k: 10, noteIds: ['note-2'] });
		expect(scoped.length).toBe(1);
		expect(scoped[0].noteId).toBe('note-2');
	});

	it('similaritySearch returns [] when noteIds is an explicit empty array', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'something', vector: [1, 0, 0, 0] },
		]);

		// An empty noteIds means "search within zero notes" — not "no filter".
		const results = await NoteEmbedding.similaritySearch([1, 0, 0, 0], { k: 10, noteIds: [] });
		expect(results).toEqual([]);
	});

	it('deleteByNoteId removes only that note\'s chunks from both tables', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'one', vector: [1, 0, 0, 0] },
		]);
		await NoteEmbedding.saveChunks('note-2', 'm', [
			{ chunkIndex: 0, chunkText: 'two', vector: [0, 1, 0, 0] },
		]);

		await NoteEmbedding.deleteByNoteId('note-1');

		expect(await NoteEmbedding.countByNoteId('note-1')).toBe(0);
		expect(await NoteEmbedding.countByNoteId('note-2')).toBe(1);

		// And the vec table is in sync: a search returns only note-2's chunk.
		const results = await NoteEmbedding.similaritySearch([1, 0, 0, 0], { k: 10 });
		expect(results.length).toBe(1);
		expect(results[0].noteId).toBe('note-2');
	});

	it('clearAll wipes everything from both tables', async () => {
		if (skipIfNoVec()) return;

		await NoteEmbedding.saveChunks('note-1', 'm', [
			{ chunkIndex: 0, chunkText: 'a', vector: [1, 0, 0, 0] },
		]);
		await NoteEmbedding.saveChunks('note-2', 'm', [
			{ chunkIndex: 0, chunkText: 'b', vector: [0, 1, 0, 0] },
		]);

		await NoteEmbedding.clearAll();

		expect(await NoteEmbedding.distinctNoteIdCount()).toBe(0);
		const results = await NoteEmbedding.similaritySearch([1, 0, 0, 0], { k: 10 });
		expect(results.length).toBe(0);
	});

	it('rejects mismatched vector dimensions', async () => {
		if (skipIfNoVec()) return;

		await expect(
			NoteEmbedding.saveChunks('note-1', 'm', [
				{ chunkIndex: 0, chunkText: 'a', vector: [1, 0, 0, 0] },
				{ chunkIndex: 1, chunkText: 'b', vector: [1, 0, 0] },
			]),
		).rejects.toThrow(/dimension/);
	});
	it('keeps vector row IDs linked to metadata and pages through vector round trips', async () => {
		if (skipIfNoVec()) return;
		const chunks = [
			{ chunkIndex: 0, chunkText: 'first', vector: [1, 0, 0, 0] },
			{ chunkIndex: 1, chunkText: 'second', vector: [0, 1, 0, 0] },
		];
		await NoteEmbedding.saveChunks('note-page', 'page-model', chunks);
		const metadata = await NoteEmbedding.byNoteId('note-page');
		const firstPage = await NoteEmbedding.chunksPage({ limit: 1 });
		expect(firstPage).toEqual([{
			rowid: metadata[0].id, noteId: 'note-page', modelId: 'page-model',
			chunkIndex: 0, chunkText: 'first', vector: chunks[0].vector,
		}]);
		const secondPage = await NoteEmbedding.chunksPage({ afterRowid: firstPage[0].rowid, noteIds: ['note-page'], limit: 1 });
		expect(secondPage[0].rowid).toBe(metadata[1].id);
		expect(secondPage[0].vector).toEqual(chunks[1].vector);
		expect(await NoteEmbedding.vectorsByNoteId('note-page')).toEqual(chunks.map(chunk => chunk.vector));
		expect(await NoteEmbedding.chunksPage({ noteIds: [], limit: 1 })).toEqual([]);
		expect((await NoteEmbedding.similaritySearch(chunks[0].vector, { k: 1.9 })).length).toBe(1);
	});

	it('allows metadata operations on a real connection without the vector extension', async () => {
		const driver = new DatabaseDriverNode();
		await driver.open({ name: ':memory:' });
		const connection = new JoplinDatabase(driver);
		const modelDatabase = jest.spyOn(NoteEmbedding, 'db').mockReturnValue(connection);
		try {
			await connection.upgradeDatabase(0);
			await expect(connection.selectOne(queryBuilder.selectNoFrom(eb => eb.fn<string>('vec_version', []).as('version'))))
				.rejects.toThrow('no such function');
			await connection.exec(queryBuilder.insertInto('note_embeddings_meta').values({
				id: undefined, note_id: 'metadata-only', chunk_index: 0, model_id: 'model', chunk_text: 'text', created_time: Date.now(),
			}));
			expect(NoteEmbedding.vectorSearchAvailable()).toBe(false);
			expect(await NoteEmbedding.countByNoteId('metadata-only')).toBe(1);
			await expect(NoteEmbedding.similaritySearch([1, 0], { k: 1 })).rejects.toThrow('unavailable');
			await NoteEmbedding.deleteByNoteId('metadata-only');
			expect(await NoteEmbedding.countByNoteId('metadata-only')).toBe(0);
			await NoteEmbedding.clearAll();
		} finally {
			modelDatabase.mockRestore();
			await driver.close();
		}
	});

});
