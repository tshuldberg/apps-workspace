# MySleep P7-B Nap Tracking And Hygiene

Date: 2026-04-24

## Summary

Implemented P7-B nap tracking and sleep hygiene for MySleep.

- Added shared nap insight helpers:
  - `modules/sleep/src/engine/naps.ts`
  - `getNapSummary()`, `getNapDurationTrend()`, and `getNapImpactInsight()`
- Added shared hygiene checklist helpers:
  - `modules/sleep/src/engine/hygiene.ts`
  - factor auto-fill, manual override support, weekly adherence, configurable practices, and quality correlation
- Added persisted hygiene check-offs:
  - `modules/sleep/src/models/hygiene-schemas.ts`
  - `modules/sleep/src/db/crud/hygiene.ts`
  - sleep schema v4 with `sl_hygiene_checks`
- Added mobile parity:
  - `apps/mobile/app/(sleep)/nap/log.tsx`
  - `apps/mobile/app/(sleep)/nap/history.tsx`
  - `apps/mobile/app/(sleep)/hygiene.tsx`
- Added web parity:
  - `apps/web/app/sleep/naps/page.tsx`
  - `apps/web/app/sleep/naps/log/page.tsx`
  - `apps/web/app/sleep/hygiene/page.tsx`
- Added nav/entry points from mobile sleep home and web sleep layout.
- Marked P7-B complete in `docs/plans/mysleep-mission-control.html`.

## Product Notes

- Nap logging supports "I just napped" and "I'm about to nap" modes, duration presets, editable start time, intentional vs accidental flag, optional quality, and notes.
- Nap history separates naps from overnight sleep and compares next-night quality after nap days against non-nap nights once there are enough samples.
- Hygiene auto-fill uses existing factor fields for caffeine, screen cutoff, target bedtime consistency, room conditions, alcohol, exercise timing, relaxation routines, and meal timing.
- Daily hygiene check-offs can be manually overridden and persisted per date/practice.
- Configured hygiene practices are persisted in `sl_settings` under `sleep.hygiene.enabledPractices`.
- The new hygiene table is personal-replica scoped in the MySleep sync policy alongside naps and factors.

## Verification

- Passed: `pnpm scaffold:function-test --file modules/sleep/src/engine/hygiene.ts --function getSleepHygieneDashboard`
- Passed: `pnpm scaffold:function-test --file modules/sleep/src/engine/naps.ts --function getNapSummary`
- Passed: `pnpm --filter @mylife/sleep typecheck`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/hygiene.test.ts src/__tests__/nap-insights.test.ts src/__tests__/naps-crud.test.ts src/__tests__/schema.test.ts src/__tests__/definition.test.ts`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/hygiene.test.ts src/__tests__/nap-insights.test.ts src/engine/__tests__/hygiene.function-gate.test.ts src/engine/__tests__/naps.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/engine/hygiene.ts --tests src/__tests__/hygiene.test.ts,src/engine/__tests__/hygiene.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/engine/naps.ts --tests src/__tests__/nap-insights.test.ts,src/engine/__tests__/naps.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mobile test -- 'app/(sleep)/__tests__/nap-hygiene.test.tsx'`
- Passed: `pnpm --filter @mylife/web test -- app/sleep/naps/__tests__/pages.test.tsx`
- Passed: `pnpm --filter @mylife/mobile typecheck`
- Passed: `pnpm --filter @mylife/web typecheck`
- Passed: file-scoped mobile ESLint for touched MySleep nap/hygiene files.
- Passed: file-scoped web ESLint for touched MySleep nap/hygiene files.
- Passed: `pnpm gate:function:changed`

## Notes

- The first generated P7-B function-gate test run failed because the hygiene contract fixture used a reference date outside its seeded week, and the nap complexity test compared a 5x input jump against the default 2.8x linear budget. Both were corrected, then the focused tests and file-scoped function gates passed.
- The mobile nap/hygiene focused test initially used single-element text queries for labels that intentionally appear in both the checklist and configuration sections. The test now asserts with `getAllByText`.
- Full package `pnpm --filter @mylife/sleep test` was not rerun because historical package-wide timing-sensitive function-gate failures remain tracked separately; P7-B ran focused package tests and file-scoped gates.

## Continuation Prompt

Continue MySleep with Phase P8-A in `/Users/trey/Desktop/Apps/MyLife`.

Current date: 2026-04-24.

Read `AGENTS.md` and `CLAUDE.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:

- P0-A through P7-B are complete.
- P7-B shipped shared nap summaries, nap impact insight, hygiene auto-fill/checklist logic, schema v4 `sl_hygiene_checks`, mobile nap log/history/hygiene routes, web nap log/history/hygiene pages, and focused tests.
- `pnpm --filter @mylife/mobile typecheck` and `pnpm --filter @mylife/web typecheck` passed on 2026-04-24.
- `pnpm gate:function:changed` passed on 2026-04-24.
- Full package `pnpm --filter @mylife/sleep test` was not rerun; existing package-wide timing-sensitive function-gate history remains tracked in `errors_log.md`.

Next task from `docs/plans/mysleep-mission-control.html`:

P8-A - Mood integration: sleep quality vs mood correlation.

Files to create:

- `modules/sleep/src/integrations/mood.ts`
  - `getSleepMoodCorrelation(dateRange): { correlation: number, insight: string, sampleSize: number }`
  - Reads mood entries for the same date range and correlates sleep quality with mood rating
  - Example insight: `Your mood averages 4.2/5 after nights with quality 4+, vs 2.8/5 after poor sleep`
- `modules/mood/src/integrations/sleep-link.ts`
  - `getLastNightSleep()`: summary of last night for mood context
  - Display in mood insights: `Sleep context: 7h, quality 4/5`

Integration pattern:

- Use cross-module query via `@mylife/db` shared connection.
- Both modules must be enabled for correlation to appear.
- Gracefully degrade if either module is disabled: no errors and no correlation card.

Acceptance:

- Correlation appears in both modules' insights when both modules are enabled.
- No errors when one module is disabled.
- Minimum 7 paired data points before showing correlation.
- Insight text is accurate and clear.
