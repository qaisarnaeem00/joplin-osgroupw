# Kysely migration validation

The migration keeps the existing SQLite drivers, connection, retries, logging, and batch transaction mutex. Kysely builds and compiles queries; it does not execute them or manage a second connection. The database format and profile version remain unchanged (version 53).

## Stage checks

Every test command in the stage table ran from `packages/lib`, after a successful `yarn tsc`. Full suites used `yarn test --maxWorkers=4` (the foundation run used two workers). The worker limit controls resource use; it does not select fewer tests.

| Completed stage | Full-suite result |
| --- | --- |
| Compiler compatibility and execution bridge (1–2) | 1,642 passed, 3 skipped; 171 suites passed |
| Shared models and pagination (3) | 1,645 passed, 3 skipped; 172 suites passed |
| Model-specific queries (4) | 1,647 passed, 3 skipped; 172 suites passed |
| Services and deferred migrations (5) | 1,648 passed, 3 skipped; 173 suites passed |
| Schema and all historical upgrades (6) | 1,710 passed, 3 skipped; 175 suites passed |
| Search (7) | 1,726 passed, 3 skipped; 176 suites passed |
| Vectors (8) | 1,728 passed, 3 skipped; 176 suites passed |
| Final audit (9) | 1,729 passed, 3 skipped; 176 suites passed |

The original passing tests remain in place. New tests increase the count from the user-supplied baseline of 1,637 passed and 3 skipped. An early test run was invalidated by concurrent compilation and is excluded from these results. The original suite was not independently completed before bridge implementation; the supplied baseline is the reference.

The regression checks cover quoted IDs, large ID lists, defaults, nulls, binary data, no-row results, rollback, concurrent batches, empty/single-query batches, case-insensitive lookup, and pagination ties. Service checks exercise the deferred resource-size migration and its encrypted-file exclusion.

Schema checks compare populated databases starting at every version from 0 through 53 against SQL captured before migration. They compare data, column types/defaults/nullability/primary keys, indexes, object names, and view results. Separate checks exercise FTS insert/update/delete triggers, reopening, newer-version rejection, ordinary upgrade rollback, and optional-extension fallback version writes. The original SQL fixtures are used only by tests; production contains explicit builders and no SQL parser.

Search checks compare 16 filter combinations against captured original SQL, including basic/full-text search, multiple tag/resource filters, negation, dates, and notebook/any combinations. The existing search suites continue to check normalization, ranking, highlights, and language-specific behavior.

## SQLite syntax that still needs small expressions

These exceptions are deliberate, as approved in the plan. Ordinary reads, writes, schema changes, joins, subqueries, and set operations use builders.

| Exception | Reason and handling |
| --- | --- |
| Virtual tables (`fts4`, `fts4aux`, `spellfix1`, `vec0`) | Kysely has no virtual-table builder. Named SQLite helpers compile fixed extension syntax; identifiers are escaped and vector dimensions are validated. |
| Triggers | Kysely has no trigger builder. The helper embeds a body compiled from an ordinary builder and rejects parameter bindings, which SQLite does not allow in trigger definitions. |
| `PRAGMA table_info` | Kysely has no PRAGMA builder. The helper escapes the table identifier and compiles the command with Kysely. |
| Historical type and string-default spelling | SQLite distinguishes `INTEGER` from `INT` for primary keys; existing default metadata also depends on double-quoted strings. Small fixed type/default expressions preserve the original declarations. |
| FTS/vector `MATCH` and FTS highlight/ranking functions | SQLite extension syntax is represented by short expressions inside builder queries. User search text and vectors remain bound values. |
| `COLLATE NOCASE` | A short expression preserves lookup/sort behavior, including the original multi-field lookup's final-equality collation. |
| Literal ID lists and vector `k` | Escaped Kysely literals preserve large-list behavior without exceeding SQLite binding limits. The vector extension needs its validated numeric `k` as a literal. |
| Transaction control | The original mutex and execution layer retain their existing BEGIN/COMMIT/ROLLBACK sequence. Kysely's transaction API would replace the driver/connection management, so these fixed commands compile through Kysely while execution remains at the existing boundary. |

## Compatibility boundaries

The public raw-query execution API and public SQL predicate/sorting helpers remain available for app/plugin callers. Internal queries use builder expressions. `legacyCondition` binds ordinary, named, repeated, and numbered predicates through a quote/comment-aware compatibility boundary (including omitted bindings as NULL) rather than attempting to translate arbitrary externally supplied SQL.

Current-schema types exclude model-only metadata such as `type_`. Dynamic model tables and historical schemas use a deliberately dynamic builder. Concrete alarm, migration, resource-state, conflict-state, and migration-registration queries use the current-schema types. A small typed insert helper compensates for this repository's disabled `strictNullChecks`, so generated/default columns can be omitted without changing project-wide compiler settings.

Jest transforms only Kysely's ESM files to CommonJS and preserves its normal Babel transformer (including mock hoisting). Worker recycling limits memory growth from loading the dependency in separate test environments. Package versions, runtime requirements, drivers, and migration tracking are unchanged.

## Platform checks and limits

- The CLI starts with an isolated temporary profile on Node 22 and reports profile version 53.
- The desktop main and renderer bundles build with the repository's actual bundling function, redirecting output to a temporary directory.
- Node/browser compiler bundles execute representative queries; the browser check disables `Array.toSorted`.
- Mobile/browser contract tests exercise the actual adapter source against stubbed native SQLite/worker APIs and verify SQL and parameter forwarding.
- React Native’s actual Babel preset transforms all 303 Kysely JavaScript modules. A Metro bundle attempt hit a file-watching SHA-1 error for Metro’s own runtime file before reaching the library; a filesystem-crawler retry hit the same runtime-file error. Full Metro bundling remains unverified; the Babel transformation, compiler bundles, and adapter contracts pass.

These checks do not run an Android/iOS device, Electron UI, or browser OPFS storage. Native sqlite-vec loads on this host; actual vector integration checks pass, including vector round-trips, scoped cursor export, nearest-neighbor ordering, and extension absence. The obsolete table-rebuild and SQL-splitting helpers are removed. No commits, pushes, or git-history changes are made.

## Final audit

Execution calls, SQL keywords, fragments, `.sql`/`.params`, model options, migration arrays, JavaScript-only consumers, and app callers were inspected. Ordinary production queries use Kysely builders. Raw SQL fixtures and direct test setup are independent verification; HTTP `.exec()` calls are unrelated to database execution. Public SQL formatting helpers remain as compatibility APIs and have no internal query-construction callers.

The existing database-type generator still reads the same SQLite schema/profile through the CLI. The schema comparison covers its underlying column/type/default inputs; the generator was inspected without rewriting generated entity files.

All changed/new TypeScript files pass the repository's ESLint rules. The existing query defaults, schema/profile version, destructive migration 53 behavior, transaction sequencing, and optional-extension driver lifecycle remain intact. Package manifests, lockfile, app drivers, and git history are unchanged. The final compile passed, followed by all 176 test suites: 1,729 passed, 0 failed, 3 skipped (1,732 total).
