# Database migration to Kysely 0.29.6

## Objective and approval boundary

Replace hand-written application SQL in `packages/lib` with Kysely while preserving the current SQLite database format and application behaviour. This includes fresh database creation, every existing upgrade step, model queries, services, full-text search, and vector search. Existing profiles must remain readable by the same application versions as before.

This document is the only change made during planning. Implementation starts after you approve the plan and resolve the decisions below. No commits, pushes, or other git history changes are planned.

## What the codebase currently does

- `database.ts` owns query execution, retrying busy/I/O errors, logging, profiling, error conversion, insert/update SQL helpers, and a mutex that prevents overlapping batch transactions. Empty batches do nothing; one-query batches run without an explicit transaction. Drivers do not consistently return write metadata.
- `JoplinDatabase.ts` contains the original schema and upgrades through version 41. `services/database/migrations/42.ts` through `53.ts` contain subsequent upgrades. Startup also discovers table columns, records defaults in `table_fields`, and loads optional SQLite extensions. Some search-related upgrades have special error recovery and version-recording behaviour.
- `BaseModel.ts` assembles common queries and applies model defaults, timestamps, IDs, and application events. Individual models contain additional joins, filters, counts, and batches. Some callers supply a SQL `where` string through public model options.
- `services/search/queryBuilder.ts` constructs both full-text and basic search. It uses recursive notebook queries and set operations (union, intersection, and exclusion). `SearchEngine.ts` maintains the index and processes ranking/highlight data from SQLite's full-text functions. Resources have their own search path.
- `models/NoteEmbedding.ts` stores metadata and lazily creates a `vec0` virtual table. It reads `last_insert_rowid()` on the same connection, stores binary vectors, and has extension-specific nearest-neighbour queries. Its current numeric `k` is deliberately inserted as a SQL literal.
- SQL also appears in settings, key/value storage, reporting, resource and revision services, synchronization helpers, debug cleanup, test setup, and deferred data migrations such as `migrations/20.ts`. These are part of the scope.
- The shared layer runs on asynchronous Node SQLite, React Native SQLite, and browser SQLite/WASM drivers. Kysely's built-in SQLite driver expects a synchronous prepared-statement API, so it cannot simply replace these drivers.
- The installed package is Kysely **0.29.6**, declares **Node >=22**, and is **ESM-only**. The repository compiles TypeScript to **CommonJS**, and Jest discovers `*.test.js`. The execution host currently has Node 22.22.1, but that alone does not prove Jest or every app can load Kysely.

## Decisions needed from you

### A. How should SQLite features without a dedicated Kysely builder be represented?

Kysely has builders for normal reads/writes, tables, indexes, views, joins, recursive queries, and set operations. Its installed schema API has no dedicated builders for SQLite virtual tables, triggers, or PRAGMA commands. These are needed to preserve search and schema inspection. This is a limit of the convenience API, not a reason to omit these features.

**Recommended:** use Kysely builders wherever supported, plus small, named SQLite helpers built with Kysely's `sql` template tag for unsupported syntax. All operations still compile through Kysely and execute through the existing database layer. Values are parameters; identifiers use identifier helpers; only validated numbers or fixed, reviewed syntax become literal SQL. Full-text `MATCH`, `matchinfo`, `offsets`, special index commands, collation, and vector functions may need short expressions inside otherwise normal builder queries. Whole ordinary queries must not just be wrapped in raw SQL and called migrated.

**Alternative:** implement custom Kysely operation nodes/compiler support for virtual tables, triggers, and PRAGMAs, so application call sites contain no SQL syntax. This is possible but adds a larger custom component to maintain and test; it still generates the same SQLite SQL underneath.

**Please choose:** are narrowly scoped Kysely `sql` helpers acceptable, or do you require custom builders for every unsupported feature? Under the recommended approach, “complete migration” means no hand-built ordinary queries remain, with every exceptional fragment listed and tested.

Kysely documents both [raw SQL expressions](https://kysely.dev/docs/recipes/raw-sql) and [custom expressions/helpers](https://kysely.dev/docs/recipes/extending-kysely). Feature availability and module packaging were also checked against the locally installed 0.29.6 files.

### B. What if the installed version needs runtime/test configuration changes?

First prove 0.29.6 loads in compiled library tests and the application build paths. Prefer a small, compatible loading boundary within `packages/lib`; do not pre-emptively convert the repository to ESM or swap SQLite drivers. If a local boundary is insufficient, present the actual failing case and a concrete proposal before changing shared build configuration or package versions.

**Please choose:** may this migration include narrowly scoped Jest/build configuration changes if required for 0.29.6, or should implementation pause for a separate approval at that point? Keeping 0.29.6 is the default; changing the version or raising supported app runtime requirements needs your decision.

## Testing rule for every stage

Run these commands in `packages/lib`, in this order:

```sh
yarn tsc
yarn test
```

Always compile before running tests, including any focused test run. A compile failure stops testing; stale JavaScript must not be used as evidence. The user-supplied baseline is **1,637 passed, 0 failed, 3 skipped (1,640 total)**, with no failing test files. It was not rerun during planning because compiling writes generated files. Stage 1 records a fresh baseline after approval.

Each stage must pass the full suite before proceeding. Added regression tests can increase the total; none of the original passing tests may become skipped or be removed to meet the gate. Existing tests check many behaviours, but do not establish every historical upgrade or mobile/browser behaviour; add the specific coverage below and distinguish real platform checks from mocks. Edit TypeScript sources and let compilation produce JavaScript/maps according to repository conventions.

## Numbered stages

### 1. Establish compatibility and behaviour checks

**Goal:** prove the installed Kysely can be used in this repository, and capture behaviours most likely to change.

**Files involved:** `packages/lib/package.json`, `tsconfig.json`, `jest.config.js` (inspect first; changes subject to decision B); root `tsconfig.json` and `jest.config.base.js` (inspect); `packages/lib/database.test.ts`, `BaseModel.test.ts`, `testing/test-utils.ts`; proposed `services/database/kyselyCompatibility.test.ts` and upgrade regression tests. Inspect desktop/CLI build configuration and mobile bundling configuration without changing them by default.

**Depends on:** plan approval and decisions A/B.

**Work:** run the supplied baseline commands, then add a compiled-JavaScript smoke test that actually imports Kysely and compiles a SQLite query. Establish checks for rollback, concurrent batches, one-query batches, empty lists, missing rows, default/null handling, and binary values. Capture representative old-profile schemas/data before replacing upgrade code. Avoid tests that only assert SQL formatting.

**Done when:** `yarn tsc` then `yarn test` preserve the baseline and pass the compatibility/regression checks. The loading approach is demonstrated against the relevant app build paths; any unresolved runtime limitation is reported before query migration proceeds.

### 2. Introduce Kysely compilation behind the existing execution layer

**Goal:** build queries with Kysely while retaining the working connections and transaction behaviour.

**Files involved:** `database.ts`, `database-driver.ts`, `services/database/types.ts`; proposed `services/database/kysely.ts`, `kyselySchema.ts`, and bridge tests. Inspect `database-driver-node.ts`, `database-driver-better-sqlite.ts`, and `packages/app-mobile/utils/database-driver-react-native.ts` / `.web.ts` as driver contracts.

**Depends on:** stage 1.

**Work:** introduce a SQLite query compiler using Kysely's supported split between building and execution. Compile builders to SQL plus parameters, then pass them through `Database.tryCall` using the existing read/write method. Do not open a second connection or introduce a second transaction manager. Allow compiled queries in batch helpers while legacy callers migrate. Define database row types separately from optional model entities: omit `type_` and other application-only fields; represent generated IDs, defaults, nullable columns, views, and explicit `rowid` references accurately. Older migrations use the columns available at their historical version rather than pretending the latest schema existed then.

**Done when:** bridge integration tests verify reads, writes, batches/rollback, error conversion, and binary parameters on the actual Node driver; contract tests verify mobile/browser argument forwarding. All existing tests pass. Public no-row and write return behaviour is unchanged; no unsupported insert metadata or `RETURNING` support is assumed.

### 3. Migrate shared model operations and pagination

**Goal:** remove the SQL assembled by the common model layer so individual models can reuse builder queries.

**Files involved:** `BaseModel.ts`, `database.ts` insert/update helpers, `models/utils/types.ts`, `models/utils/paginationToSql.ts`, `models/utils/paginatedFeed.ts`, `BaseModel.test.ts`; relevant call sites in `packages/lib`.

**Depends on:** stage 2.

**Work:** convert load/count/save/delete operations, selection lists, sorting, limits, and cursor pagination. Preserve trailing-underscore field filtering, timestamps, model defaults, events, case-insensitive lookup, and empty-list behaviour. Introduce structured conditions for internal callers. Retain a documented compatibility boundary for SQL conditions supplied by external consumers; an arbitrary SQL string cannot safely be automatically translated into a typed condition. Audit those consumers before removing any public option.

**Done when:** `BaseModel.test.ts` and model tests pass, with regression checks for partial updates, defaults, nulls, quotes in IDs, empty ID lists, case-insensitive comparisons, and pagination with tied sort values. The full suite passes; application callers of existing model APIs still compile.

### 4. Migrate model-specific queries

**Goal:** express each model's additional queries through builders without changing model semantics.

**Files involved:** `models/{BaseItem,Note,Folder,Tag,NoteTag,NoteResource,Resource,ResourceLocalState,Alarm,ItemChange,Revision,Setting,ConflictNoteState}.ts`; audit the remaining `models/*.ts`, including `Migration.ts`, for database operations. Vector-specific work follows in stage 8.

**Depends on:** stage 3.

**Work:** migrate joins, subqueries, aggregate counts, settings persistence, synchronization bookkeeping, conflict snapshots, deletion/restore rules, and queued writes. Preserve ordering, duplicate handling, deleted/locked/encrypted item visibility, and transaction boundaries. Convert internal raw `where` callers rather than hiding them behind a generic raw wrapper.

**Done when:** existing model tests, `Setting.test.ts`, and synchronization/conflict tests pass. Add behaviour coverage for a changed model query only where the existing tests leave a material gap. The full suite passes.

### 5. Migrate service queries and deferred data migrations

**Goal:** cover database users outside the models and search engine.

**Files involved:** `services/{KvStore,ReportService,ResourceService,RevisionService,MigrationService}.ts`, `services/synchronizer/{syncInfoUtils,tools}.ts`, `migrations/20.ts`, `debug/DebugService.ts`; audit `BaseApplication.ts`, `services/debug/populateDatabase.ts`, `services/share`, `services/interop`, and `testing/test-utils.ts` for actual database calls.

**Depends on:** stage 4.

**Work:** migrate direct reads and writes, data migration batches, diagnostic cleanup (including sequence resets), reports, and test database cleanup. Search by execution APIs and query helpers as well as SQL keywords, and distinguish unrelated HTTP `.exec()` calls. Other deferred migration scripts using model methods are covered through the model changes.

**Done when:** key/value, report, resource, revision, interop, sharing, and synchronization tests pass. Verify deferred resource-size updates and cleanup against a real temporary database if not covered already. The full suite passes.

### 6. Migrate schema creation and all historical upgrades

**Goal:** create exactly the same database and perform exactly the same upgrades through Kysely.

**Files involved:** `JoplinDatabase.ts`, `database.ts` table-rebuild helper, `services/database/migrations/{42..53}.ts`, `services/database/migrations/index.ts`, `services/database/{types,addMigrationFile,sqlStringToLines}.ts`; proposed schema/SQLite helpers and upgrade tests.

**Depends on:** stages 2–5 and decision A.

**Work:** replace the version-1 schema and versions 2–41 with schema/data builders; migrate files 42–53. Keep the existing upgrade runner, version numbers, no-op versions, deferred migration registration, and version-write/rollback/error-recovery rules. Do not adopt Kysely's migration tracking tables. Rebuild columns using the same copy/drop/recreate sequence where currently required. Cover tables, indexes, views, FTS4 virtual tables, triggers, introspection PRAGMAs, `table_fields`, and startup/cleanup SQL. Use the approved SQLite helpers for unsupported syntax. Preserve the current destructive behaviour of migration 53 rather than silently redesigning it.

**Done when:** tests create a fresh database and upgrade populated fixtures from every supported historical starting version to 53. Compare data, columns/types/defaults, primary keys, constraints, indexes, views, triggers, version records, and application-visible search behaviour. Test unsupported-newer profiles, reopening an already-upgraded profile, failed upgrades, and the existing full-text fallback paths. The full suite passes. The tests compare schema meaning rather than quoting/whitespace in stored SQL.

### 7. Migrate full-text and basic search

**Goal:** preserve query meaning, indexing, ranking, highlights, and fallback behaviour for notes and resources.

**Files involved:** `services/search/{queryBuilder,SearchEngine,SearchEngineUtils,SearchFilter}.ts` where applicable; `SearchEngine.test.ts`, `SearchEngine.resources.test.ts`, `SearchFilter.test.ts`, `SearchEngineUtils.test.ts`; inspect `models/Search.ts`, `services/rest/routes/search.ts`, and search consumers.

**Depends on:** stages 4–6 and decision A.

**Work:** express query structure with builders: recursive notebook traversal, joins, subqueries, union/intersection/exclusion, dates, tag/resource filters, and ordering. Keep the parser and text normalization semantics. Encapsulate SQLite full-text operators/functions as needed. Preserve FTS4, normalized tables, index cursors, resource matches, ranking calculations, offsets, and error-driven basic-search fallback. No switch to FTS5 or different ranking algorithm.

**Done when:** all existing search/filter tests pass for full-text and basic search, including negation/AND/OR combinations, nested notebooks, accents, Asian languages, wildcard/phrase searches, deleted/locked/encrypted notes, resource association, ranking, and highlights. Add cases only for uncovered rewritten combinations or fallback branches. The full suite passes.

### 8. Migrate vector search and optional extension operations

**Goal:** cover semantic search while preserving behaviour when the vector extension is absent.

**Files involved:** `models/NoteEmbedding.ts`, `JoplinDatabase.ts` extension lifecycle, `services/ai/{SearchService,EmbeddingIndexer}.ts` as consumers; `models/NoteEmbedding.test.ts`, `services/ai/{SqliteVec,SearchService,EmbeddingIndexer}.test.ts`.

**Depends on:** stages 6–7 and decision A.

**Work:** migrate metadata CRUD, vector inserts/deletes, nearest-neighbour joins, and vector export functions. Keep lazy virtual-table creation and extension availability gates. Preserve binary serialization, dimension validation, explicit delete/insert behaviour, distance ordering, scope filtering, and post-filtering. Keep `last_insert_rowid()` on the existing connection and current save sequencing. Preserve validated literal `k` where the extension requires it; parameterize user data. Loading a native extension remains a driver lifecycle call, since it is not a SQL query Kysely can replace.

**Done when:** actual sqlite-vec integration tests and metadata/search/indexer tests pass, including extension absence, row-ID linkage, vector round-trips, empty scopes, bounded results, and dimension errors. The full suite passes. Missing native-extension coverage is reported explicitly rather than replaced by a mock-only claim.

### 9. Audit completeness and remove internal legacy SQL assembly

**Goal:** verify that the migration covers the whole shared database layer and is ready for review.

**Files involved:** all `packages/lib` database consumers; obsolete internal SQL helpers; generated-type tooling in `packages/tools/generate-database-types.js` (inspect for compatibility); affected tests. Inspect app callers to ensure retained public interfaces work.

**Depends on:** stages 1–8.

**Work:** audit SQL keywords, query execution calls, fragments/options, migration arrays, dynamic table names, and `.sql`/`.params` usage. Remove unused internal concatenation helpers. Preserve externally required SQL interfaces in an explicitly documented compatibility boundary; do not break apps/plugins to make a text search look clean. Document each remaining SQLite helper and why a normal builder cannot express it. Keep raw SQL in tests only when it independently verifies schema/behaviour or exercises the supported compatibility API. Check generated type tooling against the unchanged database format.

**Done when:** every database operation is accounted for; no ordinary internal production query is assembled by hand; every approved exception has a reason and meaningful coverage. Final `yarn tsc` followed by `yarn test` reports zero failures and preserves all baseline passing tests and skip status. Relevant desktop/CLI/mobile/browser loading/build checks pass, and their limits are stated. Review the final diff for accidental schema, lockfile, dependency, or unrelated changes.

## Main risks and how they will be handled

| Risk | Handling |
| --- | --- |
| ESM-only Kysely fails under CommonJS/Jest or an app runtime | Make this the first implementation gate. Prove actual compiled import/build behaviour; seek the decision described in B before broader configuration/runtime changes. |
| Existing profiles lose data or upgrade differently | Preserve historical steps and tracking; test populated starting versions, rollback, reopening, and schema meaning. Never test migration development against a user's real profile. |
| Transactions, retries, logging, or connection-local IDs change | Compile through Kysely but retain `tryCall`, driver selection, connections, batch mutex, and single-query semantics. Test failures and concurrency. |
| SQLite version/platform differences | Keep current drivers and conservative SQLite syntax. Avoid relying on newer `RETURNING`/alter-column features. Verify platform contracts and relevant builds; Node tests alone are insufficient evidence for devices. |
| Types confuse database columns with model properties | Separate table types from entity types; preserve optional insert fields/defaults and binary/null values. Restrict historical/dynamic schema typing to small helpers. |
| Equivalent-looking filters change results | Test observable rows/order/counts, including nulls, empty lists, collation, ties, and logical grouping. Do not change established edge behaviour during this refactor. |
| Search results/ranking silently change | Preserve FTS4 and existing normalization/ranking. Use the current search suites plus missing recursive/set-operation/fallback cases. |
| Unsupported SQL is hidden rather than migrated | Use the explicit decision A; keep a finite exception inventory. Build ordinary query structure with Kysely even when a short SQLite expression is necessary. |
| External callers depend on raw SQL options | Audit app/plugin interfaces; retain a documented boundary while migrating internal callers. Removing a supported API is a separate decision. |
| Query plans become slower or exceed SQLite parameter limits | Preserve batching and query shape where practical; exercise realistic large ID lists and search data. Compare plans/timing for substantially rewritten expensive queries without flaky timing assertions. |
| Tests run stale generated JavaScript | Always run `yarn tsc` first and stop on compilation errors. Preserve baseline tests; do not weaken assertions to fit the new implementation. |

Approval can specify A (SQLite helpers or custom builders) and B (allow narrowly scoped loading configuration changes or request separate approval). No product behaviour or schema redesign is proposed.
