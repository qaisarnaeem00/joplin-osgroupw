import { BuildableQuery, compileExpression, compileQuery, sql } from './kysely';

// Keep the historical default spelling because table_fields reads PRAGMA's
// default representation and treats double-quoted strings specially.
export const sqliteStringDefault = (value: string) => sql.raw(`"${value.replace(/"/g, '""')}"`);

export function tableInfo(name: string) {
	return compileExpression(sql`PRAGMA table_info(${sql.id(name)})`);
}

// SQLite extensions define their own option grammars. Options here are fixed
// schema declarations, never search text or other user-provided SQL.
export function virtualTable(name: string, module: 'fts4' | 'fts4aux' | 'spellfix1', options: string = null) {
	const suffix = options === null ? sql`` : sql`(${sql.raw(options)})`;
	return compileExpression(sql`CREATE VIRTUAL TABLE ${sql.id(name)} USING ${sql.raw(module)}${suffix}`);
}

export function vectorTable(dimension: number) {
	if (!Number.isSafeInteger(dimension) || dimension <= 0) throw new Error('Invalid vector dimension');
	return compileExpression(sql`CREATE VIRTUAL TABLE IF NOT EXISTS ${sql.id('note_embeddings_vec')} USING vec0(embedding FLOAT[${sql.lit(dimension)}])`);
}

export function dropTrigger(name: string, ifExists = false) {
	return compileExpression(sql`DROP TRIGGER ${ifExists ? sql`IF EXISTS ` : sql``}${sql.id(name)}`);
}

export function trigger(name: string, timing: 'BEFORE' | 'AFTER', event: 'UPDATE' | 'DELETE' | 'INSERT', table: string, body: BuildableQuery) {
	const compiled = compileQuery(body);
	if (compiled.params.length) throw new Error('SQLite trigger bodies must not contain bindings');
	return compileExpression(sql`CREATE TRIGGER ${sql.id(name)} ${sql.raw(timing)} ${sql.raw(event)} ON ${sql.id(table)} BEGIN ${sql.raw(compiled.sql)}; END`);
}

// Keep transaction execution in Database's existing mutex and connection.
export function transactionCommand(command: 'BEGIN TRANSACTION' | 'COMMIT' | 'ROLLBACK') {
	const commands = { 'BEGIN TRANSACTION': sql`BEGIN TRANSACTION`, COMMIT: sql`COMMIT`, ROLLBACK: sql`ROLLBACK` };
	if (!commands[command]) throw new Error('Unknown transaction command');
	return compileExpression(commands[command]);
}
