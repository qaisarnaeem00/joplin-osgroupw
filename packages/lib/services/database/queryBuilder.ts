import { Compilable, DummyDriver, Kysely, RawBuilder, sql, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely';
import { SqlParams, SqlQuery } from './types';

class CompileOnlyDriver extends DummyDriver {
	public async acquireConnection(): Promise<never> {
		throw new Error('Execute compiled Kysely queries through Database');
	}
}

// Compile with SQLite's dialect, then execute through Database. This preserves
// the existing Node, React Native and web drivers, retries and transaction mutex.
// Table and column names are dynamic in BaseModel and in historical migrations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic model tables share this builder
export const queryBuilder = new Kysely<Record<string, Record<string, any>>>({
	dialect: {
		createDriver: () => new CompileOnlyDriver(),
		createAdapter: () => new SqliteAdapter(),
		createQueryCompiler: () => new SqliteQueryCompiler(),
		createIntrospector: db => new SqliteIntrospector(db),
	},
});

export const compileQuery = (query: Compilable): SqlQuery & { params: SqlParams } => {
	const compiled = query.compile();
	return { sql: compiled.sql, params: [...compiled.parameters] };
};

export const selectQuery = (table: string, fields: string | string[] = '*') => {
	const query = queryBuilder.selectFrom(table);
	return fields === '*' ? query.selectAll() : query.select(typeof fields === 'string' ? [fields] : fields);
};

// These lists were historically SQL literals. Keep SQLite's parameter limit
// unchanged for large note/resource batches; Kysely escapes each string literal.
export const literalStrings = (values: string[]) => values.map(value => sql.lit(value));

// Compatibility for caller-supplied SQL predicates (LoadOptions.where and
// SearchOptions.conditions). Bind placeholders as values, never interpolate
// them into SQL. Quoted question marks and comments are not placeholders.
export const rawQuery = <T = unknown>(text: string, params: SqlParams = []): RawBuilder<T> => {
	const parts: RawBuilder<unknown>[] = [];
	let start = 0;
	let parameter = 0;
	let quote = '';
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quote) {
			if (c === quote) {
				if (text[i + 1] === quote) i++;
				else quote = '';
			}
		} else if (c === '\'' || c === '"' || c === '`') {
			quote = c;
		} else if (c === '[') {
			quote = ']';
		} else if (c === '-' && text[i + 1] === '-') {
			const end = text.indexOf('\n', i + 2);
			i = end < 0 ? text.length : end;
		} else if (c === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			i = end < 0 ? text.length : end + 1;
		} else if (c === '?') {
			parts.push(sql.raw(text.slice(start, i)), sql.val(params?.[parameter++]));
			start = i + 1;
		}
	}
	parts.push(sql.raw(text.slice(start)));
	return sql.join(parts, sql.raw('')) as RawBuilder<T>;
};

export { sql };
