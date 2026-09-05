# MySleep P4-A: sleep analytics engine

Date: 2026-04-24

## Scope
- Completed MySleep P4-A with pure, deterministic analytics helpers.
- Kept this phase module-only. No mobile or web chart UI was added.

## What Shipped
- Added `modules/sleep/src/engine/analytics.ts` for:
  - weekly and monthly averages
  - day, week, and month trend buckets with explicit partial-range boundaries
  - best and worst night ranking with optional factor condition summaries
  - weekend versus weekday comparisons
- Added `modules/sleep/src/engine/consistency.ts` for:
  - bedtime and wake-time variance
  - cross-midnight bedtime normalization
  - a 0-100 consistency score using the planned variance formula
- Added `modules/sleep/src/engine/sleep-debt.ts` for:
  - daily debt with negative values for surplus sleep
  - cumulative sleep-debt trend data
  - recovery estimates based on nightly surplus
- Added `modules/sleep/src/engine/optimal-window.ts` for:
  - quality-weighted bedtime and duration windows
  - confidence labels based on sample size
  - chronotype estimates: `early_bird`, `night_owl`, or `intermediate`
- Exported the new helpers and host-ready types from `modules/sleep/src/index.ts`.

## Tests Added
- `modules/sleep/src/__tests__/analytics.test.ts`
- `modules/sleep/src/__tests__/consistency.test.ts`
- `modules/sleep/src/__tests__/sleep-debt.test.ts`
- `modules/sleep/src/__tests__/optimal-window.test.ts`
- `modules/sleep/src/engine/__tests__/analytics.function-gate.test.ts`
- `modules/sleep/src/engine/__tests__/consistency.function-gate.test.ts`
- `modules/sleep/src/engine/__tests__/sleep-debt.function-gate.test.ts`
- `modules/sleep/src/engine/__tests__/optimal-window.function-gate.test.ts`

## Verification
- `pnpm --filter @mylife/sleep test -- src/__tests__/analytics.test.ts src/__tests__/consistency.test.ts src/__tests__/sleep-debt.test.ts src/__tests__/optimal-window.test.ts src/engine/__tests__/analytics.function-gate.test.ts src/engine/__tests__/consistency.function-gate.test.ts src/engine/__tests__/sleep-debt.function-gate.test.ts src/engine/__tests__/optimal-window.function-gate.test.ts`
  - Passed: 8 files, 30 tests.
- `pnpm --filter @mylife/sleep typecheck`
  - Passed.
- `pnpm gate:function --file modules/sleep/src/engine/analytics.ts --tests src/__tests__/analytics.test.ts,src/__tests__/consistency.test.ts,src/__tests__/sleep-debt.test.ts,src/__tests__/optimal-window.test.ts,src/engine/__tests__/analytics.function-gate.test.ts,src/engine/__tests__/consistency.function-gate.test.ts,src/engine/__tests__/sleep-debt.function-gate.test.ts,src/engine/__tests__/optimal-window.function-gate.test.ts`
  - Passed.
- `pnpm gate:function --file modules/sleep/src/engine/consistency.ts --tests ...`
  - Passed.
- `pnpm gate:function --file modules/sleep/src/engine/sleep-debt.ts --tests ...`
  - Passed.
- `pnpm gate:function --file modules/sleep/src/engine/optimal-window.ts --tests ...`
  - Passed.
- `pnpm --filter @mylife/sleep test`
  - Fails outside P4-A on existing sleep function-gate budgets:
    - `modules/sleep/src/engine/__tests__/morning-log.function-gate.test.ts`: `getMorningLogSummary batched calls` ratio `5.00`, budget `4.20`
    - `modules/sleep/src/engine/__tests__/timeline.function-gate.test.ts`: `buildSleepTimelineSections` ratio `4.56`, budget `2.80`
- `pnpm gate:function:changed`
  - Still fails outside MySleep on the known duplicate Notes route blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`: `React Hook "useMemo" is called conditionally` (`react-hooks/rules-of-hooks`)
  - Latest reconfirmation: `✖ 831 problems (1 error, 830 warnings)`

## Notes
- P4-A helpers accept entry arrays and optional factor arrays so hosts can call them from SQLite-backed adapters without side effects.
- Missing quality ratings are skipped for quality averages and best/worst rankings, while duration and debt calculations still use the entry.
- Sleep-debt trends do not penalize unlogged dates; missing days keep the running debt unchanged.
