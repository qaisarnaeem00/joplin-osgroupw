# Parallel database migration plan

The approved migration uses Kysely 0.29.6 builders and the narrowly scoped SQLite helpers described in MIGRATION_PLAN.md. Existing connections, transactions, schema and public compatibility interfaces remain in place. No git history changes are authorised. The user's wave testing rules replace the original per-stage full-suite rule.

## Ownership and execution rules

Only the lead runs `yarn tsc`, tests, lint and spelling checks. Helpers may run `npx tsc --noEmit -p tsconfig.json`. Each file has one owner per wave. Helpers report shared changes to the lead and never edit another owner's files. All helpers use the lead's model. The lead integrates shared changes between waves and repairs failures before the next wave.

## Wave 0: Compatibility and baseline (stage 1)

- Lead: PARALLEL_PLAN.md, compatibility loading boundary, package and test configuration if demonstrated necessary; baseline compilation and full tests; inspect app builds.
- Helper foundation: services/database/kyselyCompatibility.test.ts and database bridge regression tests; inspect runtime and driver contracts, report findings.
- Other helpers remain idle until compatibility is established.

All paths below are under packages/lib unless stated otherwise.

## Wave 1: Shared foundation (stages 2 and 3, sequential dependency)

- Lead: database.ts, database-driver.ts, services/database/types.ts, services/database/kysely.ts, services/database/kyselySchema.ts and shared SQLite helpers.
- Helper foundation: BaseModel.ts, BaseModel.test.ts, models/utils/types.ts, models/utils/paginationToSql.ts, models/utils/paginatedFeed.ts. Starts once the bridge contract is available.
- Lead compiles and runs the full suite after the foundation is complete.

## Wave 2: Model queries (stage 4)

- Helper models A: models/BaseItem.ts, models/Note.ts, models/Folder.ts, models/Tag.ts, models/NoteTag.ts and their existing tests.
- Helper models B: all remaining models/*.ts and existing model tests, excluding the files owned by models A and NoteEmbedding.ts/NoteEmbedding.test.ts.
- Lead: shared fixes requested by helpers, completeness audit and app consumer inspection.
- Lead compiles and runs related tests using compiled JavaScript paths.

## Wave 3: Services and deferred migrations (stage 5)

- Helper services: services/KvStore.ts, services/ReportService.ts, services/ResourceService.ts, services/RevisionService.ts, services/MigrationService.ts, services/synchronizer/syncInfoUtils.ts, services/synchronizer/tools.ts, migrations/20.ts and related tests.
- Helper cleanup: debug/DebugService.ts, BaseApplication.ts, services/debug/populateDatabase.ts, services/share/**, services/interop/**, testing/test-utils.ts and related tests, only where database calls need migration.
- Lead: shared fixes and audit of remaining service consumers.
- Lead compiles and runs related tests.

## Wave 4: Schema and upgrades (stage 6)

- Helper schema: JoplinDatabase.ts and new historical upgrade regression tests.
- Helper upgrades: services/database/migrations/**, services/database/addMigrationFile.ts, services/database/sqlStringToLines.ts and related tests.
- Lead: database.ts table rebuild implementation, shared SQLite helpers and shared fixes.
- Lead compiles and runs related database and upgrade tests.

## Wave 5: Search (stage 7)

- Helper search builder: services/search/queryBuilder.ts, services/search/SearchFilter.ts, services/search/SearchFilter.test.ts.
- Helper search engine: services/search/SearchEngine.ts, services/search/SearchEngineUtils.ts and their tests including resource search tests.
- Lead: search consumer audit, shared fixes and related compilation/tests.

## Wave 6: Vector and final audit (stages 8 and 9)

- Helper vector: models/NoteEmbedding.ts, models/NoteEmbedding.test.ts, services/ai/SearchService.ts, services/ai/EmbeddingIndexer.ts and their tests. Extension lifecycle requests go to the lead.
- Helper audit: read-only audit of all database consumers, approved exception inventory and generated type tooling; report changes to owners.
- Lead: all shared fixes, JoplinDatabase.ts extension lifecycle, final inventory/documentation and app loading checks.
- Lead compiles and runs the full suite, then root `yarn linter-ci <files>` and `yarn spellcheck <files>` for every changed/new file. Fix issues and recheck as needed.

## Completion evidence

Record baseline and final suite totals, focused wave results, real vector coverage, historical upgrade coverage, app loading evidence and any limits. Preserve all baseline passing tests and skips. No ordinary internal hand-built queries may remain; document approved SQLite fragments and external SQL compatibility boundaries.

## Recovery status

The laptop interruption preserved wave 1 source changes and regression tests. Runtime logs did not survive, so earlier baseline/test completion is unverified. On resumption the lead found and fixed two compilation type mismatches in migration batch types and compiled parameter typing, then restarted compilation and the full foundation suite. Model helpers were restored with their original disjoint ownership and remained read-only until this gate passed. A helper is preparing frozen historical migration batches before schema changes begin.

Foundation validation after recovery: `yarn tsc` passed. Full `yarn test --maxWorkers=2` passed 171 suites and 1,644 tests, with the original three skips retained (1,647 total). Jest reported a worker teardown warning. Wave 2 model helpers then began their original disjoint assignments. Wave 3 lead scope additionally includes services/rest/routes/{folders,notes,search}.ts, which the audit found constructing internal SQL conditions. Desktop ResourceScreen's external condition API remains supported.

Wave 2 reassignment: the original models A helper could not restart because the model service reported capacity twice, before any edits. The foundation helper took exclusive ownership of BaseItem.ts, Note.ts, Folder.ts, Tag.ts and NoteTag.ts for this wave. Models B retained its original ownership. No model was changed for helpers.

Wave 2 validation: compilation passed; 48 related suites and 568 tests passed, including populated fixtures from all 54 starting versions (0–53), rollback and FTS fallback checks. Wave 3 ownership: models B handles the planned service/deferred migration files; foundation handles diagnostic and test cleanup; lead handles REST route filters and shared fixes. The original models A helper recovered for read-only schema preparation and will own JoplinDatabase in wave 4.

Wave 3 validation initially passed 35 related suites; one new migration-20 test fixture omitted the required MIME field. The helper corrected the fixture. The lead added compatibility coverage for quoted SQL placeholders and for compiler operation without Node globals, Array.at, Array.toSorted and Object.hasOwn, using equivalent operations in the local generated bundle. Compilation and focused rechecks gate the schema wave.

Wave 3 rechecks passed after correcting the test fixture and compatibility assertion. Wave 4 completed: schema helper models A owns JoplinDatabase.ts; upgrades helper foundation owns versions 42–53 and obsolete SQL parser removal; lead owns historical fixtures/tests and shared helpers. The historical INTEGER parser bug was corrected before proceeding. Compilation and 11 related suites / 218 tests passed, including all historical starting versions and search behavior. The original fixture regenerates identically from frozen baseline sources.

Wave 5: models B owns queryBuilder.ts and SearchFilter.test.ts; foundation owns SearchEngine.ts, SearchEngineUtils.ts and their existing tests. SearchFilter.ts does not exist. Models A finished a read-only completeness and consumer audit. Following the latest user instruction, helpers no longer compile, including no-emit checks. The lead owns all compilation and testing.

Wave 5 compilation passed. The first focused run passed all existing tests; one new notebook/OR-text FTS assertion was invalid. Executing the original frozen query and the migrated query on the same real database confirmed both hit the same pre-existing SQLite MATCH restriction. The lead corrected only the new regression to verify preserved empty FTS results and scoped basic-search results; no baseline assertions were changed. The recheck gates wave 6.

Wave 5 gate complete: compilation passed; 12 related suites passed on the first run and the corrected filter suite passed all 81 tests on recheck. All 13 selected suites are clear (275 tests in aggregate). Wave 6 ownership: models B owns NoteEmbedding.ts/test and the AI search/indexer consumers/tests; lead owns shared vector helpers, platform contract tests and final documentation/validation. No raw AI consumer queries were found. Foundation and models A completed their assignments and read-only audit.

Loading checks passed: CLI startup created a temporary version-53 profile; desktop Node 20 and browser ES2017 compiler bundles loaded; actual mobile Metro configuration built the compiler for Android and web. These are compiler loading checks, not physical-device database tests.

Wave 6 implementation is complete. Compilation passed and five related vector/platform suites passed all 70 tests. Real sqlite-vec tests assert the native extension loaded. The lead strengthened the added extension-absence regression to use a real independent SQLite connection without the extension. Desktop and CLI app type checks passed. The production audit found no hand-built ordinary queries; approved helpers and public compatibility boundaries are documented in services/database/README.md. Root lint and spelling checks passed on all 76 changed/new existing files; final checks will include the completed record below.

## Stage and wave checklist

| Stage | Wave | Result |
| --- | --- | --- |
| 1: compatibility and behavior | 0 | Compatible local compiler bundle, platform forwarding tests and app loading checks complete. Original pre-interruption baseline completion cannot be recovered; recovered foundation full suite passed. |
| 2: execution bridge and row types | 1 | Complete, existing drivers/connections/batch manager retained. |
| 3: shared models and pagination | 1 | Complete, public SQL options retained and internal callers migrated. |
| 4: model queries | 2 | Complete, related model and synchronization tests passed. |
| 5: services and deferred migrations | 3 | Complete, focused tests and corrected new fixtures passed. |
| 6: schema and historical upgrades | 4 | Complete, fresh creation and all starting versions 0–53 passed. |
| 7: full-text/basic search | 5 | Complete, related search/resource/REST tests passed, existing FTS limitations preserved. |
| 8: vector queries | 6 | Complete, native vector, metadata, AI search/indexer and platform contract tests passed. |
| 9: completeness and cleanup | 6 | Complete; final compilation, full suite, all-file lint and spelling checks passed. |

## Final validation

- `yarn tsc` in packages/lib passed after the final source change.
- Full `yarn test --maxWorkers=4` passed: 175 suites, 1,712 tests passed, zero failures, three original skips retained (1,715 total), 343.097 seconds. No baseline test was removed or newly skipped.
- Root `yarn linter-ci <files>` and `yarn spellcheck <files>` passed with every changed/new existing file supplied (76 files), including plans, documentation, generated ignore lists, fixtures, runtime bundle and license. Checks use the repository's normal file filters. The final record is included in the last recheck.
- `git diff --check` passed. Package versions, the lockfile, app build configuration and database-driver implementations were not changed. Standard generated JavaScript ignore lists were refreshed; obsolete SQL parser source and emitted artifacts were removed.
- CLI and desktop no-emit app type checks passed. CLI startup on a fresh temporary profile, desktop/browser bundled compiler loading, and Android/web Metro compiler builds passed. Native vector tests and a real extension-free SQLite connection passed; actual platform driver methods were exercised with mocked native/WASM transports. Physical mobile device and browser database execution were not tested.
- Jest reported a worker teardown/timer warning after passing; no test or compilation failures remain. The existing notebook/OR-text FTS4 MATCH limitation was preserved and regression-tested against the original query.

Helper contributions: foundation migrated shared models/pagination, the reassigned model A files, diagnostic/test cleanup, upgrades 42–53, and SearchEngine/Utils. Models A migrated JoplinDatabase's original schema/upgrades 2–41 and performed the read-only completeness/consumer/tooling audit. Models B migrated the remaining models, services/synchronization/deferred migration 20, the search builder/filter regression, and vectors/AI consumer audit. The lead integrated the compiler bridge, shared SQLite helpers, row types, REST filters, frozen historical and platform tests, compatibility packaging, documentation and all validation/fixes. All helpers retained disjoint file ownership and the same model; only the lead ran yarn compilation and tests.

All nine stages and waves 0–6 are complete. No commit, push, reset, branch switch or git history change was performed.
