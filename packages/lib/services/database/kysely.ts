import { DummyDriver, Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler, sql, RawBuilder, expressionBuilder, SelectQueryBuilder } from 'kysely';
import { SqlQuery } from './types';
import type { KyselyDatabaseSchema } from './kyselySchema';
import type { ColumnType, InsertObject, SelectType } from 'kysely';

// This instance only builds/compiles queries. Database.tryCall owns execution,
// connections, retries, and transaction locking on every supported platform.
// Dynamic model names and historical schemas are deliberately confined here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const queryBuilder = new Kysely<Record<string, Record<string, any>>>({
	dialect: {
		createDriver: () => new DummyDriver(),
		createAdapter: () => new SqliteAdapter(),
		createIntrospector: db => new SqliteIntrospector(db),
		createQueryCompiler: () => new SqliteQueryCompiler(),
	},
});

// Concrete consumers may opt into current-schema column checks. Dynamic model
// and historical migration boundaries use the builder above deliberately.
export const typedQueryBuilder = queryBuilder as unknown as Kysely<KyselyDatabaseSchema>;

type InsertRow<Row> = {
	[Key in keyof Row as Row[Key] extends ColumnType<unknown, unknown, unknown> ? never : Key]: SelectType<Row[Key]>;
} & {
	[Key in keyof Row as Row[Key] extends ColumnType<unknown, unknown, unknown> ? Key : never]?: SelectType<Row[Key]>;
};

// Kysely's optional generated-column inference requires strictNullChecks,
// which this repository doesn't enable. Keep that adjustment at this boundary
// while checking the table, column names, and values against the row schema.
export function insertRow<Table extends keyof KyselyDatabaseSchema>(table: Table, values: InsertRow<KyselyDatabaseSchema[Table]>) {
	return typedQueryBuilder.insertInto(table).values(values as unknown as InsertObject<KyselyDatabaseSchema, Table>);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const eb = expressionBuilder<Record<string, Record<string, any>>, string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectColumns(query: SelectQueryBuilder<any, any, any>, fields: string | string[]) {
	return fields === '*' ? query.selectAll() : query.select(fields as string[]);
}

// Match the existing literal ID lists without SQLite's bound-variable limit.
// sql.lit escapes each value; never concatenate caller-provided strings.
export function literalList(values: readonly string[]) {
	return values.map(value => sql.lit(value));
}

export interface BuildableQuery {
	compile(): { sql: string; parameters: readonly unknown[] };
}

export function compileQuery(query: BuildableQuery): SqlQuery & { params: unknown[] } {
	const compiled = query.compile();
	return { sql: compiled.sql, params: [...compiled.parameters] };
}

export function compileExpression(query: RawBuilder<unknown>): SqlQuery {
	const compiled = query.compile(queryBuilder);
	return { sql: compiled.sql, params: [...compiled.parameters] };
}

// Compatibility for public model options accepting a SQL predicate. Internal
// queries should use structured expressions instead. Tokenize SQLite quotes and
// comments so a '?' inside a literal is never mistaken for a binding.
export function legacyCondition(condition: string, params: readonly unknown[] = []): RawBuilder<boolean> {
	const tokens = condition.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\/|\?[0-9]*|\$[\w\u0080-\uffff]+(?:::[\w\u0080-\uffff]*)*(?:\([^)]*\))?|[:@][\w\u0080-\uffff]+|[^'"`[?/$:@-]+|[\s\S]/g) || [];
	let highestIndex = 0;
	const names = new Map<string, number>();
	const fragments = tokens.map(token => {
		let index: number;
		if (/^\?[0-9]*$/.test(token)) {
			index = token.length > 1 ? Number(token.slice(1)) : highestIndex + 1;
			if (!Number.isSafeInteger(index) || index < 1) throw new Error('Invalid SQLite parameter index');
		} else if (/^[:@$][\w\u0080-\uffff]/.test(token)) {
			index = names.get(token) || highestIndex + 1;
			names.set(token, index);
		} else {
			return sql.raw(token);
		}
		highestIndex = Math.max(highestIndex, index);
		// SQLite leaves omitted bindings NULL. Repeated named/numbered markers
		// refer to their original index, even alongside ordinary question marks.
		return sql`${params[index - 1] === undefined ? null : params[index - 1]}`;
	});
	if (params.length > highestIndex) throw new Error('SQL condition parameter count does not match');
	return sql<boolean>`${sql.join(fragments, sql.raw(''))}`;
}

export { sql };
