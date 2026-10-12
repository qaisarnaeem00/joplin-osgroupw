import type { KyselySchema } from './kyselySchema';
import type { Compilable, CompiledQuery, Kysely as KyselyType, RawBuilder } from 'kysely';
import type { SqlParams, SqlQuery } from './types';

// This local compiler-only bundle preserves synchronous CommonJS loading in
// Jest and app runtimes. It never creates a connection or executes a query.
const runtime: typeof import('kysely') = require('./vendor/kysely.cjs');
export const sql = runtime.sql;

// Dynamic tables are needed by shared models and historical upgrades. Concrete
// current table row types live separately in kyselySchema.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Historical schemas and shared models select tables dynamically.
export type DynamicDatabase = Record<string, Record<string, any>>;
export const db: KyselyType<DynamicDatabase> = new runtime.Kysely<DynamicDatabase>({
	dialect: {
		createAdapter: () => new runtime.SqliteAdapter(),
		createDriver: () => new runtime.DummyDriver(),
		createIntrospector: database => new runtime.SqliteIntrospector(database),
		createQueryCompiler: () => new runtime.SqliteQueryCompiler(),
	},
});
export const queryBuilder = db;
// Concrete current schema for consumers with a fixed table; dynamic shared
// models and historical migrations use the narrowly scoped dynamic builder.
export const currentDatabase = db as unknown as KyselyType<KyselySchema>;
export type BuilderQuery = Compilable<unknown> | CompiledQuery<unknown>;

export function compile(query: BuilderQuery): SqlQuery & { params: SqlParams } {
	const compiled = 'compile' in query ? query.compile() : query;
	return { sql: compiled.sql, params: [...compiled.parameters] as SqlParams };
}

// Public compatibility boundary for SQL conditions supplied by external callers.
// Internal callers must use expressions. Parameters remain bound, never quoted.
export function legacyCondition(condition: string, parameters: SqlParams = []): RawBuilder<boolean> {
	if (!parameters?.length) return sql.raw<boolean>(condition);
	const fragments = [];
	let start = 0;
	let nextParameter = 0;
	let quote = '';
	let comment = '';
	for (let index = 0; index < condition.length; index++) {
		const character = condition[index];
		const next = condition[index + 1];
		if (comment === 'line') {
			if (character === '\n') comment = '';
			continue;
		}
		if (comment === 'block') {
			if (character === '*' && next === '/') { comment = ''; index++; }
			continue;
		}
		if (quote) {
			if (character === quote) {
				if (next === quote && quote !== ']') index++;
				else quote = '';
			}
			continue;
		}
		if (character === '-' && next === '-') { comment = 'line'; index++; continue; }
		if (character === '/' && next === '*') { comment = 'block'; index++; continue; }
		if (['\'', '"', '`', '['].includes(character)) { quote = character === '[' ? ']' : character; continue; }
		if (character !== '?') continue;
		const numbered = /^\d+/.exec(condition.slice(index + 1));
		const parameterIndex = numbered ? Number(numbered[0]) - 1 : nextParameter;
		if (parameterIndex < 0 || parameterIndex >= parameters.length) throw new Error('SQL condition parameter count does not match');
		fragments.push(sql.raw(condition.slice(start, index)), sql.val(parameters[parameterIndex]));
		if (numbered) index += numbered[0].length;
		start = index + 1;
		nextParameter = Math.max(nextParameter, parameterIndex + 1);
	}
	if (nextParameter !== parameters.length) throw new Error('SQL condition parameter count does not match');
	fragments.push(sql.raw(condition.slice(start)));
	return sql.join(fragments, sql.raw('')) as RawBuilder<boolean>;
}

export function collateNoCase(column: string) {
	return sql`${sql.ref(column)} collate nocase`;
}
