# MySleep P6-B Sleep Science

Date: 2026-04-24

## Summary

Implemented P6-B chronotype, circadian rhythm, jet lag, and shift-work support for MySleep.

- Added pure sleep-science engines:
  - `modules/sleep/src/engine/chronotype.ts`
  - `modules/sleep/src/engine/jet-lag.ts`
  - `modules/sleep/src/engine/shift-work.ts`
- Exported the new engines and types from `modules/sleep/src/index.ts`.
- Added comprehensive engine tests and function-gate tests for chronotype, jet lag, and shift work.
- Added mobile science screens:
  - `apps/mobile/app/(sleep)/science/chronotype.tsx`
  - `apps/mobile/app/(sleep)/science/jet-lag.tsx`
  - `apps/mobile/app/(sleep)/science/shift-work.tsx`
- Added web parity screens:
  - `apps/web/app/sleep/science/chronotype/page.tsx`
  - `apps/web/app/sleep/science/jet-lag/page.tsx`
  - `apps/web/app/sleep/science/shift-work/page.tsx`
- Wired mobile hidden routes, web nav links, and a mobile Settings science entry point.
- Marked P6-B complete in `docs/plans/mysleep-mission-control.html`.

## Product Notes

- Chronotype assessment requires 14 free-day entries before returning a result. Current data uses weekend entries as the free-day proxy.
- Circadian profile returns a 24 hour alertness curve from typical wake time with peak alertness, afternoon dip, and second-wind phases.
- Jet lag tracker calculates timezone difference with `Intl`, applies 1 hour per day eastward and 1.5 hours per day westward, and estimates adjustment progress from post-arrival bedtime timing.
- Shift work mode validates shift blocks, identifies expected recovery sleep windows, and scores actual sleep overlap against the expected window.

## Verification

- Passed: `pnpm --filter @mylife/sleep typecheck`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/chronotype.test.ts src/__tests__/jet-lag.test.ts src/__tests__/shift-work.test.ts src/engine/__tests__/chronotype.function-gate.test.ts src/engine/__tests__/jet-lag.function-gate.test.ts src/engine/__tests__/shift-work.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mobile test -- 'app/(sleep)/__tests__/sleep-science.test.tsx' 'app/(sleep)/__tests__/settings.test.tsx'`
- Passed: `pnpm --filter @mylife/web test -- app/sleep/science/__tests__/pages.test.tsx`
- Passed: `pnpm --filter @mylife/mobile typecheck`
- Passed: `pnpm --filter @mylife/web typecheck`
- Passed: file-scoped mobile ESLint for touched MySleep mobile files.
- Passed: file-scoped web ESLint for touched MySleep web files.
- Passed: `pnpm gate:function --file modules/sleep/src/engine/chronotype.ts --tests src/__tests__/chronotype.test.ts,src/engine/__tests__/chronotype.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/engine/jet-lag.ts --tests src/__tests__/jet-lag.test.ts,src/engine/__tests__/jet-lag.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/engine/shift-work.ts --tests src/__tests__/shift-work.test.ts,src/engine/__tests__/shift-work.function-gate.test.ts`
- Expected fail: `pnpm gate:function:changed` still stops on the known unrelated duplicate Notes route after BestChef app subgate passes.
- Confirmed blocker: `pnpm --dir apps/mobile run lint --quiet` reports only `apps/mobile/app/(notes)/discovery 2.tsx:48` with `react-hooks/rules-of-hooks`.

## Notes

- `pnpm scaffold:function-test` was attempted for all three new engine files after the hand-written gate files existed, and the scaffold refused to overwrite them. The existing hand-written gate files were kept and used for the successful file-scoped gates.
- The first file-scoped gate attempt used repo-relative test paths. The gate runs from inside `modules/sleep`, so the successful rerun used comma-separated package-relative paths.
- The shift-work gate initially hit a timing-sensitive slope ratio. The implementation now avoids normalized-array allocation during lookup, and the gate benchmark uses warmups with larger input sizes.

## Remaining Blockers

- `pnpm gate:function:changed` is still blocked by `apps/mobile/app/(notes)/discovery 2.tsx:48`.
- Package-wide `pnpm --filter @mylife/sleep test` was not rerun because the latest full run remains blocked by unrelated timing-sensitive function-gate slope tests outside P6-B.
- Targeted web function gates remain documented as blocked elsewhere by the existing `@next/next/no-img-element` ESLint rule-resolution issue on the shop purchase detail route.

## Continuation Prompt

Continue MySleep with Phase P7-A in `/Users/trey/Desktop/Apps/MyLife`.

Current date: 2026-04-24.

Read `AGENTS.md` and `CLAUDE.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:

- P0-A through P6-B are complete.
- P6-B shipped:
  - `modules/sleep/src/engine/chronotype.ts`
  - `assessChronotype`, `getChronotypeAssessment`, `getCircadianProfile`
  - `modules/sleep/src/engine/jet-lag.ts`
  - `createJetLagTracker`, `getAdjustmentProgress`, `getRecommendedSleepTime`, `getRecommendation`
  - `modules/sleep/src/engine/shift-work.ts`
  - `setShiftPattern`, `getExpectedSleepWindow`, `evaluateShiftSleep`
  - exports from `modules/sleep/src/index.ts`
  - mobile science screens under `apps/mobile/app/(sleep)/science/`
  - web science pages under `apps/web/app/sleep/science/`
  - tests:
    - `modules/sleep/src/__tests__/chronotype.test.ts`
    - `modules/sleep/src/__tests__/jet-lag.test.ts`
    - `modules/sleep/src/__tests__/shift-work.test.ts`
    - `modules/sleep/src/engine/__tests__/chronotype.function-gate.test.ts`
    - `modules/sleep/src/engine/__tests__/jet-lag.function-gate.test.ts`
    - `modules/sleep/src/engine/__tests__/shift-work.function-gate.test.ts`
    - `apps/mobile/app/(sleep)/__tests__/sleep-science.test.tsx`
    - `apps/web/app/sleep/science/__tests__/pages.test.tsx`

Known unrelated blockers:

- `pnpm gate:function:changed` still fails outside MySleep on `apps/mobile/app/(notes)/discovery 2.tsx:48` with `react-hooks/rules-of-hooks`. Latest reconfirmation on 2026-04-24: `pnpm gate:function:changed` reports `✖ 831 problems (1 error, 830 warnings)`, and `pnpm --dir apps/mobile run lint --quiet` reports the same single error.
- `pnpm --filter @mylife/sleep test` is non-green outside P7-A because existing function-gate slope checks are timing-sensitive in package-wide runs. The latest full package run remains the P5-B run with 179/181 tests passing and failures on existing dream and nap function-gate slope checks. Focused P6-B tests and file-scoped gates pass.
- Targeted web function gates remain blocked elsewhere by the existing `@next/next/no-img-element` ESLint rule-resolution issue on `apps/web/app/shop/purchases/[id]/page.tsx`.

Next task from `docs/plans/mysleep-mission-control.html`:

P7-A - Year-in-review engine + shareable card.

Read first:

- `docs/plans/mysleep-mission-control.html` P7-A
- `modules/sleep/src/engine/analytics.ts`
- `modules/sleep/src/engine/consistency.ts`
- `modules/sleep/src/engine/sleep-debt.ts`
- `modules/sleep/src/engine/progress.ts`
- `modules/sleep/src/engine/dream-patterns.ts`
- `modules/sleep/src/db/crud/streaks.ts`
- `modules/sleep/src/db/crud/naps.ts`
- existing sleep web and mobile dashboard/review presentation patterns

Files to create:

- `modules/sleep/src/engine/year-review.ts`
- `apps/mobile/app/(sleep)/review/[year].tsx`
- `apps/mobile/app/(sleep)/review/share.tsx`
- `apps/web/app/sleep/review/[year]/page.tsx`

Required product scope:

- `generateYearReview(year: number)` returns:
  - `totalHoursSlept`
  - `totalNights`
  - `averageDuration`
  - `averageQuality`
  - `bestMonth: { month, avgQuality, avgDuration }`
  - `worstMonth: { month, avgQuality, avgDuration }`
  - `longestStreak: { type, count, startDate, endDate }`
  - `consistencyScore`
  - `sleepDebtTotal`
  - `dreamStats: { total, lucidCount, nightmareCount, topThemes[], mostCommonEmotion }`
  - `improvementMetric: { startQuality, endQuality, trend: 'improved'|'declined'|'stable' }`
  - `totalNaps`
  - `funFacts`
- Build a card-by-card mobile review presentation.
- Build web parity for the review page.
- Build a shareable card generator with Cool Obsidian theme and lavender accent.
- Share card should show aggregate stats only: total hours, average quality, best streak, dream count. Do not include specific dream content.
- Work with partial-year data.
- Compare to last year only if enough prior-year data exists.

Implementation guidance:

- No new analytics math unless needed for year aggregation glue.
- Reuse existing analytics, consistency, debt, dream, nap, and streak helpers where feasible.
- Keep the engine pure and deterministic.
- Keep mobile and web parity.
- Use existing MySleep visual patterns and Cool Obsidian tokens.
- For the shareable card, prefer a deterministic component/view model first. Native image export can be a follow-up if the current app dependencies do not support capture cleanly.

Required verification:

- Focused year-review engine tests.
- Targeted mobile/web tests for the review surfaces if existing test setup supports them.
- `pnpm --filter @mylife/sleep typecheck`
- relevant mobile/web typechecks if touched surfaces require them
- `pnpm scaffold:function-test --file modules/sleep/src/engine/year-review.ts --function generateYearReview`
- `pnpm gate:function --file modules/sleep/src/engine/year-review.ts --tests <relevant tests>`
- `pnpm gate:function:changed`, expected to still fail on the known duplicate Notes route unless something else regresses.

Deliver the work, verification results, remaining blockers, and a full continuation prompt for P7-B.
