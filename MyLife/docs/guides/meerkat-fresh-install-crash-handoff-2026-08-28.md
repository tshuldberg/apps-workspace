# Handoff prompt: Meerkat fresh-install launch crash (2026-08-28)

Use this if TestFlight build 15 still crashes at first launch. Paste everything
between the lines into a new Claude Code session started in
`/Users/trey/Desktop/Apps/MyLife/apps/meerkat`.

---

We are debugging a **fresh-install launch crash in the Meerkat iOS app** (repo:
`/Users/trey/Desktop/Apps/MyLife`, app: `apps/meerkat`, sync core:
`packages/sync`, web twin: `apps/meerkat-web`, relay: `packages/meerkat-relay`).
Read `apps/meerkat/CLAUDE.md` (and the `AGENTS.md` it imports) in full first.
The honesty rules in it are binding: never fake transport/connectivity/counts,
and always distinguish implemented+tested vs dev-build-only vs founder-ops.

## The bug

On a **fresh install only** (a device with no existing `meerkat.db`), the app
crashes at launch into the ErrorBoundary screen with:

```
FunctionCallException: Calling the 'prepareSync' function has failed
  (ExpoModulesCore/SyncFunctionDefinition.swift:137)
→ Caused by: SQLiteErrorException: Error code 1: no such table: <TABLE>
  (ExpoSQLite/SQLiteModule.swift:382)
```

`<TABLE>` has moved as fixes landed: build 13 = `sync_communities`,
build 14 = `dm_conversations`. Report the CURRENT table name from the screenshot
before doing anything else; it identifies which reader is still winning the race.

## Root cause (established, do not re-derive)

Screens read SQLite during their **render phase** (e.g. the Feed's
`useState(() => listCommunities(db))` at `app/(root)/(tabs)/index.tsx:80`).
React runs child renders and child effects **before** a parent provider's effect,
so any table family whose DDL lives in a provider effect (`SyncProvider`'s
`ensureSyncSchema` at `providers/SyncProvider.tsx:844`) loses that race on a
brand-new database. Schema creation must therefore happen at the **database-open
choke point**, never in a provider effect.

## What has already been done (verify, do not redo)

1. `app/(root)/data/schema-boot.ts` (NEW) exports `ensureFullMeerkatSchema(db)`,
   which calls all four top-level ensure functions: `ensureMeerkatTables`
   (mk_ + call_ + share-intake + mk_pinned via `ensureMeerkatPinnedTables`),
   `ensureSyncSchema` (sync_ + mp_ + pi_ + cm_ via `ensureCommunityTables`),
   `ensureDmTables` (dm_), `ensurePersonIdentityTables`.
2. `app/(root)/data/meerkat-db.ts` `openActiveDatabase()` calls
   `ensureFullMeerkatSchema(directAdapter)` synchronously **before**
   `cachedNativeDb = db`, so no handle escapes without a full schema.
3. Regression suite `app/__tests__/fresh-install-boot.test.ts` (4 tests): the
   failure mode, the boot sequence, a **completeness guard** that enumerates every
   exported `ensure*Tables`/`ensure*Schema` in `data/` and fails if one is not
   wired into `ensureFullMeerkatSchema`, and a source guard on
   `openActiveDatabase`. The completeness guard was mutation-checked (deleting a
   call must fail it).
4. A full referenced-vs-created table diff across the data layer came back clean:
   every `mk_/mp_/cm_/dm_/pi_/sync_/call_` table referenced anywhere is created by
   something reachable from `ensureFullMeerkatSchema`.
5. App suite green: 1518/1518. Commits: `221b5d04` (first, too narrow),
   `62f82df2` (class-level fix).

## Therefore, if it STILL crashes, the remaining hypotheses are

Work these in order. Do NOT just wire one more table and rebuild; that loop has
already cost three build cycles.

- **H1: something opens a DIFFERENT database handle that bypasses
  `openActiveDatabase`.** PARTIALLY PRE-CHECKED on 2026-08-28: the only other
  openers are `providers/AppThemeProvider.tsx:159` (`withThemeDb`, which opens
  per-operation, calls `ensureThemeTables` itself, and swallows every error into
  a fallback so it cannot throw into render: RULED OUT as the crash source) and
  `data/local-restore.ts` / `data/local-snapshot.ts` (explicit maintenance paths,
  not boot). Re-grep `openDatabaseSync|openDatabaseAsync` anyway if a native
  module is suspected, but this hypothesis is mostly closed.
- **H2: the crash happens BEFORE `getMeerkatDatabase()` runs** (module-level
  side effect, a native module reading the db at startup, background-task
  registration, or a headless path). Check `data/background-sync.ts`,
  `data/background-task-registration.ts`, `data/push-wake-boot.ts`, and
  `data/local-restore-boot.ts` (which runs BEFORE the open, by design).
- **H3: `ensureFullMeerkatSchema` throws partway** on device (not in tests), so
  later families never get created and the error surfaces as the first missing
  table after the throw. A `PRAGMA foreign_keys=ON` interaction or a native-only
  SQL dialect difference would do this. Wrap each ensure call to identify which
  one throws, and surface the real error instead of the downstream symptom.
- **H4: a stale database from a previous build** (13/14) exists with a partial
  schema. Confirm the tester DELETED the app before installing. A migration path
  for partially-created databases may be needed since idempotent CREATE IF NOT
  EXISTS does not repair a db that was created by an older, incomplete boot.

## How to get evidence fast (do this instead of guessing)

The blind spot in this whole investigation has been that the crash only
reproduces on a device with no database, so each hypothesis costs a ~30 minute
TestFlight round trip. Prefer these:

- Reproduce **locally** first: run the app in a simulator/dev build after
  deleting the app (or the `meerkat.db` file) so you get a true fresh install.
  `npx expo run:ios` with the app deleted from the simulator is the fast loop.
- If a device build is unavoidable, add a defensive boot diagnostic FIRST (log
  which ensure* ran, catch and re-throw with the family name) so one build
  yields the answer instead of one more symptom.

## Build / deploy commands (all already working)

```bash
cd apps/meerkat
npx eas-cli build --profile testflight --platform ios --non-interactive
npx eas-cli submit --profile testflight --platform ios --latest --non-interactive
```

- Relay is LIVE: `wss://meerkat-relay-us.fly.dev` (Fly app `meerkat-relay-us`,
  `/healthz` returns `{"ok":true,"connections":0}`), baked into the `testflight`
  EAS profile as `MEERKAT_DEFAULT_RELAY_URL`.
- **Every new build shows "Missing Compliance" in TestFlight**: App Store Connect
  → TestFlight → build → Manage → "Standard encryption algorithms instead of, or
  in addition to, Apple's OS encryption" → France: **No**. This matches the saved
  app-level declaration. `ITSAppUsesNonExemptEncryption` is deliberately ABSENT
  from `app.json` (`true` without a compliance code is undeliverable, ITMS-90592
  killed build 12; `false` would dishonestly skip the questionnaire). A guard
  test asserts it stays absent.
- Internal test group is **B1** (instant). Group A1 is EXTERNAL and needs Beta
  App Review; do not use it for the pilot.
- IAP/RevenueCat is **deferred by founder decision**, so past the free paths the
  app stays honestly locked at the $4.99 gate. That is expected, not a bug.

## Repo conventions you must follow

- Run `pnpm --filter @mylife/meerkat-app test` and the changed-function gate
  before committing; Conventional Commits; update `memory.md` (Sessions row),
  `errors_log.md`, and a session log under `docs/sessions/` in the same flow.
- Capture a summary to Open Brain with context `"personal, mylife"`.
- No em dashes in any writing.

Start by telling me the current crashing table name and which of H1-H4 the
evidence supports, before changing any code.

---
