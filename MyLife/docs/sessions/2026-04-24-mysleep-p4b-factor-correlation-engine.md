# MySleep P4-B: factor correlation engine

Date: 2026-04-24

## Scope
- Completed MySleep P4-B with pure, deterministic factor correlation helpers.
- Kept this phase engine-only. No mobile or web chart UI was added.

## What Shipped
- Added `modules/sleep/src/engine/correlations.ts` for:
  - exercise versus no exercise quality comparison
  - early versus late caffeine cutoff comparison
  - no alcohol versus any alcohol comparison
  - low versus high stress comparison with direction
  - early versus late screen cutoff comparison with cross-midnight bedtime normalization
  - ranked top correlations
  - human-readable insight strings
- Added explicit non-reporting states:
  - `insufficient_data` when either comparison group has fewer than 7 rated nights
  - `not_significant` when average quality differs by less than 0.25 points
- Added confidence labels:
  - `low` for fewer than 15 total samples
  - `medium` for 15-29 total samples
  - `high` for 30 or more total samples
- Exported the correlation helpers and host-ready types from `modules/sleep/src/index.ts`.

## Tests Added
- `modules/sleep/src/__tests__/correlations.test.ts`
- `modules/sleep/src/engine/__tests__/correlations.function-gate.test.ts`

## Verification
- `pnpm --filter @mylife/sleep test -- src/__tests__/correlations.test.ts src/engine/__tests__/correlations.function-gate.test.ts`
  - Passed: 2 files, 9 tests.
- `pnpm --filter @mylife/sleep typecheck`
  - Passed.
- `pnpm gate:function --file modules/sleep/src/engine/correlations.ts --tests src/__tests__/correlations.test.ts,src/engine/__tests__/correlations.function-gate.test.ts`
  - Passed.
- `pnpm --filter @mylife/sleep test`
  - Failed outside P4-B on existing package-wide function-gate slope checks.
  - First run failed in `src/db/crud/__tests__/dreams.function-gate.test.ts` on `createDream repeated inserts` ratio `4.85`, budget `2.80`.
  - Isolated rerun of `src/db/crud/__tests__/dreams.function-gate.test.ts` passed.
  - Second full run failed in `src/engine/__tests__/factor-log.function-gate.test.ts` on `buildFactorCreateInput batched calls` ratio `4.52`, budget `4.20`.
  - Isolated rerun of `src/engine/__tests__/factor-log.function-gate.test.ts` passed.
- `pnpm gate:function:changed`
  - Still fails outside MySleep on the known duplicate Notes route blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`: `React Hook "useMemo" is called conditionally` (`react-hooks/rules-of-hooks`).
  - Latest quiet lint reconfirmation: `pnpm --dir apps/mobile run lint --quiet` reports 1 error at the same file and line.

## Notes
- The first file-scoped gate invocation used repo-root test paths and Vitest could not find the test file from the package directory. The corrected package-relative, comma-separated `--tests` value passed.
- P4-B joins entries to factors by `sleep_entry_id` first, then by sleep date, matching the existing analytics factor lookup pattern.
- Missing quality ratings and missing factor fields are skipped rather than counted as neutral data.
- Screen cutoff classification chooses a plausible pre-bed candidate within a 12-hour lookback window, which covers same-night and cross-midnight bedtimes without reporting after-bed cutoffs.
