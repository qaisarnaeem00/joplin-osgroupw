import BaseModel from './BaseModel';
import Note from './models/Note';
import { setupDatabaseAndSynchronizer, switchClient } from './testing/test-utils';
import paginatedFeed from './models/utils/paginatedFeed';
import { PaginationOrderDir } from './models/utils/types';

describe('BaseModel', () => {
	test.each([
		[0, 0],
		[4, 10],
		[10, 4],
		[5, 5],
	])('should filter items by IDs (itemCount: %d, idCount: %d)', (itemCount, idCount) => {
		const items = [];
		const ids = [];

		const expectedMatchingItems = [];
		for (let i = 0; i < idCount; i++) {
			const id = `matching-${i}`;
			ids.push(id);

			if (items.length < itemCount) {
				const item = { id };
				items.push(item);
				expectedMatchingItems.push(item);
			}
		}

		while (items.length < itemCount) {
			items.push({ id: `non-matching-${items.length}` });
		}

		expect(BaseModel.modelsByIds(items, ids)).toMatchObject(expectedMatchingItems);
	});

	test.each([
		[0, false],
		[12, false],
		[4096, false],
		[4097, true],
		[100000, true],
	])('userSideValidation should reject overly long titles (length: %d)', (length, shouldThrow) => {
		const run = () => BaseModel.userSideValidation({ title: 'x'.repeat(length) });
		if (shouldThrow) {
			expect(run).toThrow(/title must be 4096 characters or less/);
		} else {
			expect(run).not.toThrow();
		}
	});

	const nul = String.fromCharCode(0);
	test.each([
		[{ title: 'fine', body: 'fine' }, false],
		[{ title: `bad${nul}title`, body: 'fine' }, true],
		[{ title: 'fine', body: `bad${nul}body` }, true],
		[{ source_url: `https://example.com/${nul}` }, true],
		[{ title: 'fine' }, false],
		[{ body: 'fine' }, false],
	])('userSideValidation should reject any string field containing a null byte (input: %j)', (input, shouldThrow) => {
		const run = () => BaseModel.userSideValidation(input);
		if (shouldThrow) {
			expect(run).toThrow(/null byte/);
		} else {
			expect(run).not.toThrow();
		}
	});

	describe('database queries', () => {
		beforeEach(async () => {
			await setupDatabaseAndSynchronizer(1);
			await switchClient(1);
		});

		it('preserves quoted IDs, partial updates, defaults and empty ID lists', async () => {
			const id = 'note\'with quotes';
			await Note.save({ id, title: 'Original', body: 'Preserved body' }, { isNew: true });
			await Note.save({ id, title: 'Updated' });
			expect(await Note.load(id)).toMatchObject({ title: 'Updated', body: 'Preserved body', is_todo: 0 });
			expect(await Note.byIds([id])).toHaveLength(1);
			expect(await Note.byIds([])).toEqual([]);
			await Note.batchDelete([]);
			expect(await Note.load(id)).toBeTruthy();
			await Note.batchDelete([id]);
			expect(await Note.load(id)).toBeFalsy();
		});

		it('supports structured filters and case insensitive lookup', async () => {
			await Note.save({ title: 'Mixed Case' });
			await Note.save({ title: 'Other' });
			expect(await Note.loadByField('title', 'mixed case', { caseInsensitive: true })).toMatchObject({ title: 'Mixed Case' });
			expect(await Note.count({ whereBuilder: eb => eb('title', '=', 'Other') })).toBe(1);
			expect(await Note.all({ whereBuilder: eb => eb('title', '=', 'Other') })).toHaveLength(1);
		});

		it('paginates tied sort values in a stable ID order', async () => {
			for (const id of ['c', 'a', 'b']) {
				await Note.save({ id, title: 'same title' }, { isNew: true });
			}
			const pagination = {
				limit: 2,
				page: 1,
				order: [{ by: 'title', dir: PaginationOrderDir.ASC, caseInsensitive: false }],
			};
			const first = await paginatedFeed(BaseModel.db(), 'notes', pagination);
			const second = await paginatedFeed(BaseModel.db(), 'notes', { ...pagination, page: 2 });
			expect(first.items.map(item => item.id)).toEqual(['a', 'b']);
			expect(second.items.map(item => item.id)).toEqual(['c']);
			expect(first.has_more).toBe(true);
			expect(second.has_more).toBe(false);
		});
	});
});
