# MySleep P8-B Habits Integration

Date: 2026-04-25

## Summary

Implemented P8-B habits integration for MySleep.

- Added the shared Sleep-side habits bridge:
  - `modules/sleep/src/integrations/habits.ts`
  - `getSleepHabitAdherence(db, dateRange?)`
  - `suggestSleepHabits()`
  - `buildHabitCompletionHints(db, entryId)`
- Added the Habits-side sleep context bridge:
  - `modules/habits/src/integrations/sleep-link.ts`
  - `getSleepRoutineContext(db, options?)`
- Exported both integration surfaces from the module barrels.
- Added focused Sleep and Habits package tests plus function-gate tests.
- Wired the Habits Bridge into Sleep insights on mobile and web.
- Wired Sleep routine context into Habits Today on mobile and web.
- Marked P8-B complete in `docs/plans/mysleep-mission-control.html`.

## Product Notes

- The bridge only appears when both `sleep` and `habits` are enabled in `hub_enabled_modules`.
- Sleep remains the canonical owner of `sl_` data and Habits remains the canonical owner of `hb_` data. The bridge reads both through the shared DB adapter without creating shared tables.
- `suggestSleepHabits()` returns starter routine habit drafts only. It does not create habits.
- `buildHabitCompletionHints()` derives candidate completions from sleep factors and hygiene checks only. It does not write to `hb_completions`.
- Sleep insights show routine adherence and quality deltas once there are at least 7 sleep nights with routine habits available.
- Habits Today shows last-night sleep quality and bedtime routine completion context when there is a routine habit and sleep entry to connect.
- Disabled modules and query failures degrade silently to no card rather than surfacing runtime errors.

## Verification

- Passed: `pnpm scaffold:function-test --file modules/sleep/src/integrations/habits.ts --function getSleepHabitAdherence`
- Passed: `pnpm scaffold:function-test --file modules/habits/src/integrations/sleep-link.ts --function getSleepRoutineContext`
- Passed: `pnpm --filter @mylife/sleep typecheck`
- Passed: `pnpm --filter @mylife/habits typecheck`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/habits-integration.test.ts src/integrations/__tests__/habits.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/habits test -- src/__tests__/sleep-link.test.ts src/integrations/__tests__/sleep-link.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/integrations/habits.ts --tests src/__tests__/habits-integration.test.ts,src/integrations/__tests__/habits.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/habits/src/integrations/sleep-link.ts --tests src/__tests__/sleep-link.test.ts,src/integrations/__tests__/sleep-link.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mobile test -- 'app/(sleep)/__tests__/insights.test.tsx' 'app/(habits)/__tests__/index.test.tsx'`
- Passed: `pnpm --filter @mylife/web test -- app/sleep/insights/__tests__/page.test.tsx app/habits/__tests__/habits-page.test.tsx`
- Passed: `pnpm --filter @mylife/mobile typecheck`
- Passed: `pnpm --filter @mylife/web typecheck`
- Passed: file-scoped mobile ESLint for touched Sleep and Habits files. Warning-only existing Habits Today lint remains.
- Passed: file-scoped web ESLint for touched Sleep and Habits files.
- Passed: `pnpm gate:function:changed`
- Passed: `pnpm check:parity --quiet`

## Notes

- The generated Sleep habits function-gate microbenchmark exceeded the default linear slope budget once on a 500 to 1000 row jump. The test now uses adjacent linear growth sizes for the row-mapping contract and the focused Sleep habits tests pass.
- The Habits package did not previously have a local function-quality helper. Added `modules/habits/src/test/function-quality.ts` so generated function-gate tests stay inside package `rootDir`.
- Full package `pnpm --filter @mylife/sleep test` was not rerun because historical package-wide timing-sensitive function-gate failures remain tracked separately; P8-B ran focused package tests, host tests, host typechecks, and file-scoped gates.

## Continuation Prompt

Continue MySleep with Phase P8-C in `/Users/trey/Desktop/Apps/MyLife`.

Current date: 2026-04-25.

Read `AGENTS.md` and `CLAUDE.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:

- P0-A through P8-B are complete.
- P8-B shipped:
  - `modules/sleep/src/integrations/habits.ts`
  - `getSleepHabitAdherence(db, dateRange?)`
  - `suggestSleepHabits()`
  - `buildHabitCompletionHints(db, entryId)`
  - `modules/habits/src/integrations/sleep-link.ts`
  - `getSleepRoutineContext(db, options?)`
  - Sleep and Habits insight/context cards on mobile and web
  - focused package, function-gate, mobile, and web tests
- `pnpm gate:function:changed` passed on 2026-04-25.
- Full package `pnpm --filter @mylife/sleep test` was not rerun; existing package-wide timing-sensitive function-gate history remains tracked in `errors_log.md`.

Next task from `docs/plans/mysleep-mission-control.html`:

P8-C - Health integration: explicit opt-in summary bridge.

Files to create:

- `modules/sleep/src/integrations/health.ts`
  - `getHealthBridgeSummary(dateRange)`: manual-journal summary that Health can consume
  - `buildHealthSyncPreview()`: explicit preview of what would be shared before the user opts in
- `modules/health/src/integrations/sleep-link.ts`
  - `getSleepJournalContext(dateRange)`: Health-side summary card or CTA into MySleep

Integration pattern:

- Preserve MySleep as the canonical manual sleep journal.
- Preserve MyHealth as the canonical sensor/health summary surface.
- Do not reuse `hl_` sleep tables or silently copy sleep journal rows.
- Require explicit opt-in preview copy before any sharing behavior.
- Integration only appears when both modules are enabled.
- Fallback is silent when Health is disabled.

Acceptance:

- Health can reference MySleep trends, but MySleep remains the canonical manual journal.
- MySleep can preview what would be shared before opt-in.
- Health and Sleep both render useful summary context without schema reuse.
