import migration from './20';
import Resource from '../models/Resource';
import Setting from '../models/Setting';
import shim from '../shim';
import { setupDatabaseAndSynchronizer, switchClient } from '../testing/test-utils';

describe('migration 20 resource sizes', () => {
	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	it('updates sizes from files while preserving timestamps and skipping encrypted files', async () => {
		const resource = await Resource.save({ title: 'plain', mime: 'text/plain', file_extension: 'txt', size: -1 });
		const encryptedResource = await Resource.save({ title: 'encrypted', mime: 'text/plain', file_extension: 'txt', size: -1 });
		await shim.fsDriver().writeFile(Resource.fullPath(resource), 'plain text', 'utf8');
		await shim.fsDriver().writeFile(`${Setting.value('resourceDir')}/${encryptedResource.id}.crypted`, 'encrypted text', 'utf8');

		expect(await shim.fsDriver().exists(Resource.fullPath(encryptedResource))).toBe(false);

		await migration.exec();

		const updated = await Resource.load(resource.id);
		expect(updated.size).toBe(10);
		expect(updated.updated_time).toBe(resource.updated_time);
		expect(updated.user_updated_time).toBe(resource.user_updated_time);
		expect(updated.blob_updated_time).toBe(resource.blob_updated_time);
		expect((await Resource.load(encryptedResource.id)).size).toBe(-1);
	});
});
