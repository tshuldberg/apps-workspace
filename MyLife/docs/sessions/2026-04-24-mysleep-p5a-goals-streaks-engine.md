# MySleep P5-A Goals And Streaks Engine

Date: 2026-04-24

## Scope

Implemented the MySleep goals, streaks, and weekly progress engine for Phase P5-A.

## Files Changed

- `modules/sleep/src/models/goal-schemas.ts`
- `modules/sleep/src/db/crud/goals.ts`
- `modules/sleep/src/db/crud/streaks.ts`
- `modules/sleep/src/engine/progress.ts`
- `modules/sleep/src/db/schema.ts`
- `modules/sleep/src/db/migrations/003_streak_history.sql`
- `modules/sleep/src/definition.ts`
- `modules/sleep/src/db/index.ts`
- `modules/sleep/src/db/crud/index.ts`
- `modules/sleep/src/index.ts`
- `modules/sleep/src/__tests__/goals-crud.test.ts`
- `modules/sleep/src/__tests__/streaks.test.ts`
- `modules/sleep/src/__tests__/progress.test.ts`
- `modules/sleep/src/__tests__/schema.test.ts`
- `modules/sleep/src/engine/__tests__/progress.function-gate.test.ts`
- `modules/sleep/src/db/crud/__tests__/goals.function-gate.test.ts`
- `modules/sleep/src/db/crud/__tests__/streaks.function-gate.test.ts`
- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Implementation Notes

- Added typed schemas for goal types, streak types, goal progress, streak rows, and streak history rows.
- Added goal CRUD:
  - `createGoal`
  - `getGoal`
  - `getActiveGoals`
  - `updateGoal`
  - `deactivateGoal`
  - `checkGoalProgress`
- Added streak state helpers:
  - `getStreaks`
  - `updateStreak`
  - `resetStreak`
  - `getStreakHistory`
- Added pure progress helpers:
  - `evaluateEntry`
  - `getWeeklySummary`
  - `generateAccountabilityMessage`
  - `evaluateStreakType`
- Added schema version 3 with `sl_streak_history` so P5-B can render streak charts or heatmaps without guessing from the current streak row.
- Kept accountability copy gentle and avoided punitive language.

## Verification

- `pnpm scaffold:function-test --file modules/sleep/src/engine/progress.ts --function evaluateEntry` created the progress function-gate scaffold.
- `pnpm scaffold:function-test --file modules/sleep/src/db/crud/goals.ts --function createGoal` created the goals function-gate scaffold.
- `pnpm scaffold:function-test --file modules/sleep/src/db/crud/streaks.ts --function updateStreak` created the streaks function-gate scaffold.
- `pnpm --filter @mylife/sleep typecheck` passed.
- `pnpm --filter @mylife/sleep test -- --run src/__tests__/goals-crud.test.ts src/__tests__/streaks.test.ts src/__tests__/progress.test.ts src/__tests__/schema.test.ts src/engine/__tests__/progress.function-gate.test.ts src/db/crud/__tests__/goals.function-gate.test.ts src/db/crud/__tests__/streaks.function-gate.test.ts` passed.
- `pnpm gate:function --file modules/sleep/src/engine/progress.ts --tests src/__tests__/progress.test.ts src/engine/__tests__/progress.function-gate.test.ts` passed.
- `pnpm gate:function --file modules/sleep/src/db/crud/goals.ts --tests src/__tests__/goals-crud.test.ts src/db/crud/__tests__/goals.function-gate.test.ts` passed.
- `pnpm gate:function --file modules/sleep/src/db/crud/streaks.ts --tests src/__tests__/streaks.test.ts src/db/crud/__tests__/streaks.function-gate.test.ts` passed.
- `pnpm gate:function --file modules/sleep/src/models/goal-schemas.ts --tests src/__tests__/goals-crud.test.ts src/__tests__/streaks.test.ts src/__tests__/progress.test.ts` passed.
- `pnpm --filter @mylife/sleep test` remains blocked outside P5-A by existing timing-sensitive function-gate checks. Latest full package run had 170/172 tests pass and failed on `src/engine/__tests__/analytics.function-gate.test.ts` (`getTrendData daily` ratio `4.57`, budget `4.20`) and `src/engine/__tests__/optimal-window.function-gate.test.ts` (`findOptimalBedtime` memory delta `13034368`, budget `8388608`).
- `pnpm gate:function:changed` remains blocked outside MySleep by the known duplicate Notes route lint blocker after the BestChef app subgate passed.
- `pnpm --filter @mylife/mobile typecheck` and `pnpm --filter @mylife/web typecheck` are blocked by unrelated Payments profile drift at `modules/payments/src/wallet/settings.ts:152`.

## Issues Resolved

- Fixed the existing `modules/sleep/src/db/crud/goals.ts:132` `string | number` to `string` assignment drift by preserving the normalized string target value on updates.
- Fixed the new streak function-gate fixture so performance dates stay before the current date.
- Made the active-goals CRUD test order-independent because multiple rows can share the same created timestamp.

## Status

P5-A is complete and marked done in `docs/plans/mysleep-mission-control.html`. Next MySleep phase is `P5-B` goals + streaks UI + bedtime reminder.
