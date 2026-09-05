# MySleep P8-A Mood Integration

Date: 2026-04-25

## Summary

Implemented P8-A mood integration for MySleep.

- Added the shared Sleep-side mood bridge:
  - `modules/sleep/src/integrations/mood.ts`
  - `getSleepMoodCorrelation(db, dateRange?)`
  - 7-paired-point minimum, disabled-module fallback, insufficient-data status, no-variance status, and reportable Pearson correlation output
- Added the Mood-side sleep context bridge:
  - `modules/mood/src/integrations/sleep-link.ts`
  - `getLastNightSleep(db, options?)`
  - Last-night duration, quality, wake date, and context copy for Mood insights
- Exported both integration surfaces from the module barrels.
- Added focused Sleep and Mood package tests plus function-gate tests.
- Wired the bridge into Sleep insights on mobile and web.
- Wired the bridge into Mood insights on mobile and web.
- Marked P8-A complete in `docs/plans/mysleep-mission-control.html`.

## Product Notes

- The bridge only appears when both `sleep` and `mood` are enabled in `hub_enabled_modules`.
- Sleep remains the canonical owner of `sl_` data and Mood remains the canonical owner of `mo_` data. The bridge reads both through the shared DB adapter without creating shared tables.
- Sleep insights show a Mood Bridge card once there are at least 7 paired sleep and mood days.
- Mood insights show a Sleep and Mood card plus a Last Night context card when bridge data is available.
- Disabled modules and query failures degrade silently to no card rather than surfacing runtime errors.

## Verification

- Passed: `pnpm scaffold:function-test --file modules/sleep/src/integrations/mood.ts --function getSleepMoodCorrelation`
- Passed: `pnpm scaffold:function-test --file modules/mood/src/integrations/sleep-link.ts --function getLastNightSleep`
- Passed: `pnpm --filter @mylife/sleep typecheck`
- Passed: `pnpm --filter @mylife/mood typecheck`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/mood-integration.test.ts src/integrations/__tests__/mood.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mood test -- src/__tests__/sleep-link.test.ts src/integrations/__tests__/sleep-link.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/integrations/mood.ts --tests src/__tests__/mood-integration.test.ts,src/integrations/__tests__/mood.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/mood/src/integrations/sleep-link.ts --tests src/__tests__/sleep-link.test.ts,src/integrations/__tests__/sleep-link.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mobile test -- 'app/(sleep)/__tests__/insights.test.tsx'`
- Passed: `pnpm --filter @mylife/web test -- app/sleep/insights/__tests__/page.test.tsx app/mood/insights/__tests__/page.test.tsx`
- Passed: `pnpm --filter @mylife/mobile typecheck`
- Passed: `pnpm --filter @mylife/web typecheck`
- Passed: file-scoped mobile ESLint for touched Sleep and Mood insights files.
- Passed: file-scoped web ESLint for touched Sleep and Mood insights files.
- Passed: `pnpm gate:function:changed`
- Passed: `pnpm check:parity --quiet`

## Notes

- The generated P8-A function-gate tests initially imported the repo-level function-quality helper outside package `rootDir`. Sleep now uses its local helper and Mood has a matching local helper.
- The fake DB adapters in the function-gate tests now expose typed `query<T>()` returns so package typechecks stay strict.
- The web Mood insights test initially pulled the `@mylife/mood` barrel through React Native UI exports and hit Flow syntax in Vitest. The test now mocks the runtime Mood package import and verifies the bridge UI directly.
- Full package `pnpm --filter @mylife/sleep test` was not rerun because historical package-wide timing-sensitive function-gate failures remain tracked separately; P8-A ran focused package tests, host tests, host typechecks, and file-scoped gates.

## Continuation Prompt

Continue MySleep with Phase P8-B in `/Users/trey/Desktop/Apps/MyLife`.

Current date: 2026-04-25.

Read `AGENTS.md` and `CLAUDE.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:

- P0-A through P8-A are complete.
- P8-A shipped:
  - `modules/sleep/src/integrations/mood.ts`
  - `getSleepMoodCorrelation(db, dateRange?)`
  - `modules/mood/src/integrations/sleep-link.ts`
  - `getLastNightSleep(db, options?)`
  - Sleep and Mood insight cards on mobile and web
  - focused package, function-gate, mobile, and web tests
- `pnpm gate:function:changed` passed on 2026-04-25.
- Full package `pnpm --filter @mylife/sleep test` was not rerun; existing package-wide timing-sensitive function-gate history remains tracked in `errors_log.md`.

Next task from `docs/plans/mysleep-mission-control.html`:

P8-B - Habits integration: bedtime routine + adherence context.

Files to create:

- `modules/sleep/src/integrations/habits.ts`
  - `getSleepHabitAdherence(dateRange)`: bedtime-routine adherence summary and insight copy
  - `suggestSleepHabits()`: starter habits such as `Wind down routine`, `No screens before bed`, and `Consistent bedtime`
  - `buildHabitCompletionHints(entryId)`: optional completion hints from sleep-factor data without silently mutating habits
- `modules/habits/src/integrations/sleep-link.ts`
  - `getSleepRoutineContext(date)`: Habits-side sleep routine context

Integration pattern:

- Both modules keep their own source-of-truth data.
- No implicit habit creation or auto-completion without explicit user confirmation.
- Integration only appears when both modules are enabled.
- Fallback is silent when Habits is disabled.

Acceptance:

- Sleep can suggest and summarize routine habits without taking ownership of Habits data.
- Habits can display sleep context without reading or writing `sl_` tables directly outside the bridge.
- No errors when Habits is disabled.
