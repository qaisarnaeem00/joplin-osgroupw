# Database queries

Build SQLite queries with `queryBuilder` (or `selectQuery` for dynamic model
fields) and pass them to `Database.selectOne`, `selectAll`, `exec`, or
`transactionExecBatch`. Use `compileQuery` when an existing API needs the
`{ sql, params }` shape, such as `SaveOptions.nextQueries` and schema migrations.

Kysely compiles the queries; `Database` executes them through the existing
platform driver. This keeps the Node, React Native, and web connections, retry
and error handling, query logging, and serialized batch transactions. The shared
builder deliberately rejects `.execute()` to prevent accidental execution on a
second connection or through a dummy driver.

SQLite virtual tables, triggers, PRAGMA statements, and transaction commands
still use their native SQL because Kysely has no corresponding builders.
`sql` expressions handle extension operators such as `MATCH`, collation, and
historical column definitions. Schema defaults retain their original quoting
because SQLite exposes that quoting through PRAGMA and Joplin's field cache.

Existing public APIs still accept SQL strings. `rawQuery` binds parameters in
legacy caller-supplied predicates such as `LoadOptions.where` and
`SearchOptions.conditions`; application queries should use native Kysely
predicates when possible. `literalStrings` preserves existing inline ID lists
without introducing SQLite parameter limits for large batches. Table names remain dynamic to support BaseModel and
historical profile schemas.
