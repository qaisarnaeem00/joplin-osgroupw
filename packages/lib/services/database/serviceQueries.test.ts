import migration20 from '../../migrations/20';
import shim from '../../shim';
import Resource from '../../models/Resource';
import { db, setupDatabaseAndSynchronizer } from '../../testing/test-utils';

describe('deferred resource size migration', () => {
	beforeEach(async () => setupDatabaseAndSynchronizer(1));

	it('updates plain-file sizes and ignores encrypted files', async () => {
		const plain = await Resource.save({ title: 'plain', mime: 'text/plain', size: 1 });
		const encrypted = await Resource.save({ title: 'encrypted', mime: 'text/plain', size: 2 });
		const directory = jest.spyOn(shim.fsDriver(), 'readDirStats').mockResolvedValue([
			{ path: `${plain.id}.txt`, size: 123, isDirectory: () => false, birthtime: new Date(1), mtime: new Date(1) },
			{ path: `${encrypted.id}.crypted`, size: 456, isDirectory: () => false, birthtime: new Date(1), mtime: new Date(1) },
		]);
		try {
			await migration20.exec();
			expect(await db().selectOne('SELECT size FROM resources WHERE id = ?', [plain.id])).toEqual({ size: 123 });
			expect(await db().selectOne('SELECT size FROM resources WHERE id = ?', [encrypted.id])).toEqual({ size: 2 });
		} finally { directory.mockRestore(); }
	});
});
