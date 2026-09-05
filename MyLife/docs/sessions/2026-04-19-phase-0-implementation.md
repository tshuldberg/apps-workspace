# 2026-04-19 — Phase 0 Implementation

Executed Phase 0 of the consolidation proposal via an orchestrated agent team. Five stages: research → three parallel implementations → tests → review → parity validation.

## What shipped

### Fix 1 — Habits V8 migration (deprecated cycle tables removed)

- `modules/habits/src/db/schema.ts`: removed `CREATE_HB_PERIODS`, `CREATE_HB_PERIOD_SYMPTOMS`, `CREATE_HB_PREDICTIONS`, `CREATE_HB_CYCLE_SETTINGS` and their indexes; trimmed `ALL_V2_TABLES`; added `DROP_DEPRECATED_CYCLE_TABLES` constant used by V8.
- `modules/habits/src/definition.ts`: added `HABITS_MIGRATION_V8` that drops the four deprecated tables; bumped `schemaVersion` 7 → 8.
- `modules/habits/src/cycle/`: entire directory deleted (was orphan dead code after V8).
- `modules/habits/src/__tests__/habits.test.ts`: removed the `cycle tracking` describe block (11 tests) + updated expected schemaVersion.
- `modules/habits/src/__tests__/prediction.test.ts`: deleted (all 18 tests referenced removed tables).
- `modules/habits/CLAUDE.md`: updated schema version, table count (26), and note pointing to `@mylife/cycle`.

### Fix 2 — Garden migration (no-op, already fixed)

Verified all 105 garden tests pass. The `status` column exists in V1 schema. Memory.md description was stale.

### Fix 3 — SQLite backup end-to-end

- `apps/mobile/lib/backup-scheduler.ts` (new): `checkAndCreateAutoBackup` reads `hub_backup_config`, dedupes 24h window against last `type='auto'` row, delegates retention to existing `pruneBackups`.
- `apps/mobile/hooks/use-auto-backup.ts`: refactored to call the new scheduler.
- `apps/web/lib/backup-scheduler.ts` (new): server-only equivalent with `hub_preferences` debounce.
- `apps/web/app/layout.tsx`: fire-and-forget invocation at top of root layout.
- Hub schema already wired `BACKUP_TABLES` into `HUB_TABLES` — no change needed there.

### Fix 4 — 8 rules-of-hooks violations cleaned

Files refactored (hoisted hooks above early returns / renamed non-hook helper):

- `apps/mobile/app/(garden)/plant/[id].tsx` (5 violations)
- `apps/mobile/app/(notes)/discovery.tsx` (1)
- `apps/mobile/components/HamburgerMenu.tsx` (1)
- `apps/web/app/notes/actions.ts` + `apps/web/app/notes/templates/page.tsx` (rename `useTemplateAction` → `applyTemplateAction`)
- `packages/eslint-config/index.js`: flipped `react-hooks/rules-of-hooks` from `warn` to `error`.

### Parity fix (caught by validation agent)

`apps/mobile/app/(habits)/(tabs)/stats.tsx`: removed dead `SELECT ... FROM hb_cycle_periods` query and its "Cycle insights" render block. The table never existed (pre-existing latent bug masked by outer try/catch). Cleaned as part of the habits-cycle separation.

## Tests added

- `modules/habits/src/__tests__/migrations.test.ts` (new, 2 tests): V1→V8 fresh install, V7→V8 upgrade drops deprecated tables while preserving habit data.
- `modules/habits/src/__tests__/lint-config.test.ts` (new, 2 tests): snapshot locking in `'react-hooks/rules-of-hooks': 'error'`.
- `apps/mobile/lib/__tests__/backup-scheduler.test.ts` (new, 7 tests): dedupe, autoEnabled off, first-time, 24h skip, retention policy, error swallow, harness sanity.

## Verification

- `pnpm test --filter @mylife/habits` → 291/291 passing (22 test files)
- `pnpm test --filter @mylife/cycle` → 203/203 passing
- `pnpm test --filter @mylife/garden` → 105/105 passing
- `pnpm test --filter @mylife/db` → 143/143 passing
- `pnpm typecheck` → 88/88 tasks clean
- `pnpm lint | grep rules-of-hooks` → 0 matches (was 8)
- `pnpm check:parity --quiet` → pass
- `pnpm check:module-parity` → pass (21 expected "standalone not in repo" skips)
- `pnpm check:passthrough-parity` → 114 passed, 4 skipped
- `pnpm check:workouts-parity` → pass
- `pnpm check:generated-artifacts` → pass

## Review findings (all addressed or ruled non-blocking)

1. V8 DROP ordering — reviewer initially flagged P0; walked back to safe. Child tables dropped before parents.
2. Health `absorb.ts` reads `hb_periods` + `hb_cycle_settings` — P1 theoretical. Verified non-blocking: cycle module never imported from hb_ tables, so data was always orphan. V8 drops dead schema. Follow-up (Phase 0.1) to remove dead references in `absorb.ts`.
3. Backup scheduler cold-start race — both mobile and web have a narrow window where two concurrent launches could create duplicate auto-backups. Worst case is one extra backup file; pruning resolves on next run. Acceptable; SQLite-transaction belt-and-suspenders queued as optional follow-up.
4. `hb_cycle_periods` dead query in stats.tsx — caught by parity-checker. Removed (this session).

## Team composition used

| Stage | Agent(s) | Runtime |
|-------|---------|---------|
| Research | Explore agent | ~4 min |
| Implementation | 3× in parallel: module-dev (habits), hub-shell-dev (backup), module-dev (hooks) | ~55 min worst case |
| Tests | module-dev | ~2 min |
| Review | feature-dev:code-reviewer | ~2 min |
| Parity | parity-checker | ~3 min |

## Phase 0.1 follow-ups (completed in same session)

1. `modules/health/src/migration/absorb.ts` cleaned — removed `hb_periods` from `ABSORBED_TABLES`, dropped `hasCycleData` / `cycleCount` from `AbsorbedModuleData`, removed the `hb_cycle_settings` copy block.
2. `apps/mobile/app/(health)/migration-prompt.tsx` — removed cycle-detection branches and the "Cycle Tracker" data row that depended on the removed interface fields.
3. Stale `modules/habits/dist/` build artifacts purged.
4. Backup scheduler cold-start race left as-is. Worst-case outcome is one extra auto-backup file that the existing retention prune handles on the next run. Not worth a DB-transaction wrap.

## Status

Phase 0 + 0.1 complete. Habits 291/291, health 267/267, cycle 203/203 green. Typecheck clean. Zero hooks warnings. All 5 parity gates pass. Committed and pushed.
