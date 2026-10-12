# Database query building

Kysely 0.29.6 builds and compiles queries. The existing Database execution layer owns connections, retries, logging, profiling, error conversion and batch locking. The compiler uses a DummyDriver and never executes queries or opens a connection. Builders and compiled queries both reach the selected existing driver as SQL and bound parameters.

## Runtime compatibility

The installed package is ESM-only. `kyselyRuntime.ts` supplies the compiler exports for the local CommonJS bundle `vendor/kysely.cjs`. Regenerate it with `node packages/lib/services/database/buildKysely.js` from the repository root. The bundle contains the package's MIT license, targets ES2017 and replaces three recent standard library methods with equivalent compiler-local operations. Runtime requirements and shared app configuration remain unchanged. Kysely type imports are erased by compilation.

The compiled compatibility tests load the bundle without Node globals or recent array helpers. The lead also checked desktop Node 20 and browser bundles, actual Android and web Metro builds using the mobile configuration, and CLI startup with a fresh temporary profile. These establish compiler loading; they do not establish behavior on physical mobile devices or replace actual platform database-driver testing.

## Approved SQLite fragments

Ordinary reads, writes, schema operations, joins, recursive queries and set operations use builders. SQLite features without dedicated builders use named helpers:

| Helper | Reason and validation |
| --- | --- |
| `tableInfo` | PRAGMA introspection; historical schema tests compare every column, default and primary key. |
| `ftsTable`, `ftsAuxTable`, `spellfixTable`, `vectorTable` | SQLite virtual-table module syntax; historical/search and real vector tests exercise the modules. Dimensions are positive safe integers. |
| `createTrigger`, `dropTrigger` | SQLite trigger syntax; bodies are compiled ordinary builders with no parameters. Historical tests verify insert/update/delete behavior. |
| `transactionCommand` | BEGIN/COMMIT/ROLLBACK through the existing transaction owner; rollback and concurrent batch tests cover behavior. |
| `columnDefinition` | Fixed historical declared types/defaults; normal column constraints use builders. Frozen original fixtures verify preserved meaning. |
| `ftsMatch`, `ftsOffsets`, `ftsMatchInfo` | SQLite FTS4 operators and ranking/highlight functions; existing search tests exercise full-text and basic modes. |
| `vectorMatch`, `vectorK` | Extension MATCH and planner-required literal result count; positive safe integer validation and real vector tests. |
| `collateNoCase` | SQLite collation expression; model lookup regression verifies case-insensitive comparison. |

Identifiers use identifier/reference helpers. User values remain bound parameters. Literal constants in stored views/triggers are fixed migration definitions, and trigger bodies reject parameterized statements. Connection-local `last_insert_rowid` and `vec_to_json` use Kysely function builders. Raw queries in historical fixtures/tests are independent behavior or schema oracles, not production query paths.

## Public compatibility boundary

Database still accepts strings and `{ sql, params }`, and public model options still accept external SQL conditions. `legacyCondition` binds supplied positional parameters while preserving quoted strings, identifiers and comments; internal callers use expression callbacks. Public formatting helpers in BaseModel, Note and pagination remain available to app/plugin consumers. Desktop ResourceScreen still supplies a condition through that supported API. These APIs are intentionally retained; internal ordinary queries do not use them.

## Historical oracle

`historicalUpgradeFixtures.json` records all 53 original migration batches from its named baseline commit. The capture utility reloads the original schema, database rebuild implementation and numbered migrations from that frozen commit, so regeneration cannot accidentally turn migrated queries into their own oracle. Historical tests upgrade populated profiles from every starting version 0–53, compare schema/data, test reopening/newer profiles, exercise trigger/view behavior, rollback and full-text fallback. Migration 53 retains its original destructive recreation.
