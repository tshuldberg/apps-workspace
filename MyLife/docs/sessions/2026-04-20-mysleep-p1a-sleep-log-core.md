# MySleep P1-A: sleep log core

Date: 2026-04-20

## Summary

Built the first real MySleep data layer after the hidden P0 foundation:

- Zod-backed schemas for sleep entries, naps, and list filters
- duration and sleep-latency engine with same-date overnight handling
- `sl_sleep_entries` CRUD with derived `date`, `duration_minutes`, and latency
- nap CRUD with filtered queries
- module-local function-gate tests and helper utilities that stay inside the package `rootDir`

This completes P1-A in the mission control and leaves the module ready for the P1-B morning log UI.

## Files changed

Core implementation:

- `modules/sleep/src/models/schemas.ts`
- `modules/sleep/src/engine/duration.ts`
- `modules/sleep/src/db/crud/entries.ts`
- `modules/sleep/src/db/crud/naps.ts`
- `modules/sleep/src/db/crud/index.ts`
- `modules/sleep/src/db/index.ts`
- `modules/sleep/src/index.ts`
- `modules/sleep/src/test/function-quality.ts`

Tests:

- `modules/sleep/src/__tests__/duration.test.ts`
- `modules/sleep/src/__tests__/entries-crud.test.ts`
- `modules/sleep/src/__tests__/naps-crud.test.ts`
- `modules/sleep/src/engine/__tests__/duration.function-gate.test.ts`
- `modules/sleep/src/db/crud/__tests__/entries.function-gate.test.ts`
- `modules/sleep/src/db/crud/__tests__/naps.function-gate.test.ts`

Tracking:

- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Notes

- `createEntry` and `updateEntry` derive the sleep-entry `date` from `wake_time`, keeping sleep-log grouping aligned to the morning log flow.
- If `sleep_onset_time` exists, latency is derived from the engine; otherwise the optional manual `sleep_latency_minutes` value is preserved.
- Generated function-gate tests could not safely import the repo-level helper because `modules/sleep/tsconfig.json` uses `rootDir: "src"`, so I added `modules/sleep/src/test/function-quality.ts` and pointed the gate tests there.

## Verification

Passed:

- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm gate:function --file modules/sleep/src/db/crud/entries.ts --tests src/__tests__/entries-crud.test.ts,src/db/crud/__tests__/entries.function-gate.test.ts`
- `pnpm gate:function --file modules/sleep/src/db/crud/naps.ts --tests src/__tests__/naps-crud.test.ts,src/db/crud/__tests__/naps.function-gate.test.ts`
- `pnpm gate:function --file modules/sleep/src/engine/duration.ts --tests src/__tests__/duration.test.ts,src/engine/__tests__/duration.function-gate.test.ts`

Blocked outside MySleep:

- `pnpm gate:function:changed`

The shared changed-file gate still fails in unrelated mobile lint due to:

- `apps/mobile/app/(notes)/discovery 2.tsx:48`
- `react-hooks/rules-of-hooks`
- `React Hook "useMemo" is called conditionally`

## Next step

P1-B can now build the morning log UI directly on top of the CRUD layer without revisiting data-model or validation contracts.
