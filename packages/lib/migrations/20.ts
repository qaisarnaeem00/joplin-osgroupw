import { compileQuery, queryBuilder, sql } from '../services/database/queryBuilder';
import Resource from '../models/Resource';
import Setting from '../models/Setting';
import shim from '../shim';
import { reg } from '../registry';
import { fileExtension } from '../path-utils';
import { SqlQuery } from '../services/database/types';

interface Script {
	exec: ()=> Promise<void>;
}

const script: Script = <Script>{};

script.exec = async () => {
	const stats = await shim.fsDriver().readDirStats(Setting.value('resourceDir'));

	let queries: SqlQuery[] = [];
	for (const stat of stats) {
		if (fileExtension(stat.path) === 'crypted') continue;
		const resourceId = Resource.pathToId(stat.path);
		if (!resourceId) continue;

		queries.push(compileQuery(
			queryBuilder
				.updateTable('resources')
				.set({ size: sql.val(stat.size) })
				.where((eb) => eb(sql.ref('id'), '=', sql.val(resourceId))),
		));

		if (queries.length >= 1000) {
			await reg.db().transactionExecBatch(queries);
			queries = [];
		}
	}

	await reg.db().transactionExecBatch(queries);
};

export default script;
