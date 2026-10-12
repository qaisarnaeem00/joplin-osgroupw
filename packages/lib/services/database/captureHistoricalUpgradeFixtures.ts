import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, relative, resolve } from 'path';
import { ModuleKind, transpileModule } from 'typescript';
import Database from '../../database';
import type JoplinDatabase from '../../JoplinDatabase';
const savedFixtures: HistoricalUpgradeFixtures = require('./historicalUpgradeFixtures.json');
import { SqlQuery, StringOrSqlQuery } from './types';

export interface HistoricalUpgradeFixtures {
	baselineCommit: string;
	batches: { version: number; queries: SqlQuery[] }[];
}

// Capture only trusted, frozen repository source, including its original
// migration imports. Regenerating this oracle must never use migrated queries.
export default async function(outputPath = resolve(__dirname, 'historicalUpgradeFixtures.json')) {
	const repository = resolve(__dirname, '../../../..');
	const baselineCommit = savedFixtures.baselineCommit;
	const cache = new Map<string, { exports: Record<string, unknown> }>();
	const loadOriginal = (path: string): Record<string, unknown> => {
		if (cache.has(path)) return cache.get(path).exports;
		const source = execFileSync('git', ['show', `${baselineCommit}:${path}`], { cwd: repository, encoding: 'utf8' });
		const moduleOutput = { exports: {} as Record<string, unknown> };
		cache.set(path, moduleOutput);
		const originalRequire = createRequire(resolve(repository, path.replace(/\.ts$/, '.js')));
		const requireOriginal = (name: string) => {
			const dependency = relative(repository, resolve(repository, dirname(path), name));
			if (name.startsWith('.') && (
				dependency === 'packages/lib/database' ||
				dependency === 'packages/lib/services/database/addMigrationFile' ||
				dependency === 'packages/lib/services/database/sqlStringToLines' ||
				dependency.startsWith('packages/lib/services/database/migrations')
			)) {
				const sourcePath = dependency.endsWith('/migrations') ? `${dependency}/index.ts` : `${dependency}.ts`;
				return loadOriginal(sourcePath);
			}
			return originalRequire(name);
		};
		const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
		// eslint-disable-next-line no-new-func -- Evaluate trusted original sources to retain independent historical queries.
		new Function('require', 'module', 'exports', compiled)(requireOriginal, moduleOutput, moduleOutput.exports);
		return moduleOutput.exports;
	};
	const originalDatabase = loadOriginal('packages/lib/database.ts').default as typeof Database;
	const OriginalJoplinDatabase = loadOriginal('packages/lib/JoplinDatabase.ts').default as typeof JoplinDatabase;
	const fixtures: HistoricalUpgradeFixtures = { baselineCommit, batches: [] };
	class RecordingDatabase extends OriginalJoplinDatabase {
		public alterColumnQueries(tableName: string, fields: Record<string, string>) {
			return originalDatabase.prototype.alterColumnQueries.call(this, tableName, fields);
		}
		public async transactionExecBatch(queries: StringOrSqlQuery[]) {
			const wrapped = this.wrapQueries(queries);
			const version = Number(wrapped[wrapped.length - 1].params[0]);
			fixtures.batches.push({ version, queries: wrapped });
		}
	}
	const originalNow = Date.now;
	Date.now = () => 1700000000000;
	try {
		await new RecordingDatabase({}).upgradeDatabase(0);
	} finally {
		Date.now = originalNow;
	}
	if (fixtures.batches.length !== 53) throw new Error(`Expected 53 historical upgrades, received ${fixtures.batches.length}`);
	writeFileSync(outputPath, `${JSON.stringify(fixtures, null, '\t')}\n`);
	return outputPath;
}
