// Entry point for the local CommonJS compatibility bundle. Only compiler and
// query builder functionality is exported; database connections stay in Joplin.
export { Kysely, DummyDriver, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler, sql } from 'kysely';
