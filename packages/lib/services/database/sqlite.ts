import type { ColumnDefinitionBuilder, CreateTableBuilder } from 'kysely';
import { db, sql, compile } from './kysely';

// Historical column declarations are fixed migration definitions, never user
// input. Keep SQLite's original declared types and default spelling intact.
export function columnDefinition(definition: string) {
	const match = /^(TEXT|INTEGER|INT|NUMERIC|BLOB)\b(.*)$/i.exec(definition.trim());
	if (!match) throw new Error(`Unsupported historical column definition: ${definition}`);
	return {
		type: sql.raw(match[1]),
		configure: (column: ColumnDefinitionBuilder) => {
			if (/PRIMARY KEY/i.test(match[2])) column = column.primaryKey();
			if (/AUTOINCREMENT/i.test(match[2])) column = column.autoIncrement();
			if (/NOT NULL/i.test(match[2])) column = column.notNull();
			if (/UNIQUE/i.test(match[2])) column = column.unique();
			const defaultValue = /DEFAULT\s+(.+)$/i.exec(match[2]);
			if (defaultValue) column = column.defaultTo(sql.raw(defaultValue[1]));
			return column;
		},
	};
}

export function createTable(name: string, columns: Record<string, string>, temporary = false) {
	let table: CreateTableBuilder<string, string> = db.schema.createTable(name);
	if (temporary) table = table.temporary();
	for (const [name, definition] of Object.entries(columns)) {
		const column = columnDefinition(definition);
		table = table.addColumn(name, column.type, column.configure);
	}
	return table;
}

export function addColumn(table: string, name: string, definition: string) {
	const column = columnDefinition(definition);
	return db.schema.alterTable(table).addColumn(name, column.type, column.configure);
}

// SQLite has no Kysely builder for PRAGMA introspection, virtual tables or
// triggers. Their fixed syntax is kept here and compiled through Kysely.
export function tableInfo(table: string) {
	return compile(sql`pragma table_info(${sql.id(table)})`.compile(db));
}

export function dropTrigger(name: string, ifExists = true) {
	return compile(sql`drop trigger ${ifExists ? sql`if exists` : sql``} ${sql.id(name)}`.compile(db));
}

export function transactionCommand(command: 'begin' | 'commit' | 'rollback') {
	const commands = { begin: 'begin transaction', commit: 'commit', rollback: 'rollback' };
	return compile(sql.raw(commands[command]).compile(db));
}

export function ftsTable(name: string, content: string, columns: string[], notIndexed: string[] = []) {
	const definitions = [
		sql`content=${sql.lit(content)}`,
		...notIndexed.map(column => sql`notindexed=${sql.lit(column)}`),
		...columns.map(column => sql.id(column)),
	];
	return compile(sql`create virtual table ${sql.id(name)} using fts4(${sql.join(definitions)})`.compile(db));
}

export function spellfixTable(name: string) {
	return compile(sql`create virtual table ${sql.id(name)} using spellfix1`.compile(db));
}

export function vectorTable(name: string, dimension: number) {
	if (!Number.isSafeInteger(dimension) || dimension <= 0) throw new Error(`Invalid vector dimension: ${dimension}`);
	return compile(sql`create virtual table if not exists ${sql.id(name)} using vec0(embedding float[${sql.lit(dimension)}])`.compile(db));
}

export function createTrigger(name: string, timing: 'before' | 'after', event: 'insert' | 'update' | 'delete', table: string, statements: import('./kysely').BuilderQuery[]) {
	const body = statements.map(statement => {
		const query = compile(statement);
		if (query.params.length) throw new Error('SQLite trigger statements cannot bind parameters');
		return sql.raw(query.sql);
	});
	return compile(sql`create trigger ${sql.id(name)} ${sql.raw(timing)} ${sql.raw(event)} on ${sql.id(table)} begin ${sql.join(body, sql`; `)}; end`.compile(db));
}

export function ftsAuxTable(name: string, content: string) {
	return compile(sql`create virtual table ${sql.id(name)} using fts4aux(${sql.id(content)})`.compile(db));
}

export function ftsMatch(column: string, value: string) {
	return sql<import('kysely').SqlBool>`${sql.ref(column)} match ${value}`;
}

export function ftsOffsets(table: string) {
	return sql<string>`offsets(${sql.id(table)})`;
}

export function ftsMatchInfo(table: string) {
	return sql<Buffer>`matchinfo(${sql.id(table)}, ${sql.lit('pcnalx')})`;
}

export function vectorMatch(column: string, value: string) {
	return sql<import('kysely').SqlBool>`${sql.ref(column)} match ${value}`;
}

export function vectorK(column: string, k: number) {
	if (!Number.isSafeInteger(k) || k <= 0) throw new Error(`Invalid vector result count: ${k}`);
	return sql<import('kysely').SqlBool>`${sql.ref(column)} = ${sql.lit(k)}`;
}
