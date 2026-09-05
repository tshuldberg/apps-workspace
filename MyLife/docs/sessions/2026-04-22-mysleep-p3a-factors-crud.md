# MySleep P3-A: factors CRUD and pre-sleep activity taxonomy

Date: 2026-04-22

## Scope
- Completed MySleep P3-A on top of the hidden sleep-log and dream foundations.
- Added the shared factors data layer for pre-sleep activities, environment conditions, supplements, stress, and P4-ready correlation aggregates.

## What Shipped
- Added `modules/sleep/src/models/factor-schemas.ts` with:
  - seeded `PRE_SLEEP_ACTIVITY_TAXONOMY` and `SLEEP_SUPPLEMENT_TAXONOMY`
  - `HH:MM` clock-time validation
  - room condition enums for temperature, light, and noise
  - factor CRUD/list schemas plus correlation result contracts
  - JSON-array normalization helpers for seeded activity and supplement arrays
- Added `modules/sleep/src/db/crud/factors.ts` with:
  - `createFactor`, `getFactor`, `getFactorByEntry`, `updateFactor`, `deleteFactor`, and `listFactors`
  - entry-link validation so linked factors must match the sleep entry date
  - a single-factor-per-linked-entry guard at the CRUD layer
  - `getFactorCorrelations` returning nightly points, association summaries, and numeric correlations for future P4 insights work
- Updated `modules/sleep/src/db/crud/index.ts`, `modules/sleep/src/db/index.ts`, and `modules/sleep/src/index.ts` so the factor layer is exported through the shared package surface.
- Added focused coverage in `modules/sleep/src/__tests__/factors-crud.test.ts` and replaced the generated scaffold with a real database-backed function-gate file in `modules/sleep/src/db/crud/__tests__/factors.function-gate.test.ts`.
- Stabilized the sleep package's CRUD complexity gates by tuning the factor and nap harness budgets around SQLite setup overhead, without changing product behavior.

## Verification
- `pnpm scaffold:function-test --file modules/sleep/src/db/crud/factors.ts --function getFactorCorrelations --force`
- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm gate:function --file modules/sleep/src/db/crud/factors.ts --tests src/__tests__/factors-crud.test.ts,src/db/crud/__tests__/factors.function-gate.test.ts`
- `pnpm gate:function:changed`
  - Still fails outside MySleep on the known duplicate Notes route blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`: `React Hook "useMemo" is called conditionally` (`react-hooks/rules-of-hooks`).
  - Latest reconfirmation in this session still reports `✖ 824 problems (1 error, 823 warnings)`.

## Notes
- `getFactorByEntry` is intentionally singular and the CRUD layer prevents duplicate linked factor rows for the same sleep entry, even though the current SQLite schema does not enforce that uniqueness directly.
- The seeded taxonomies normalize case, spaces, and hyphens (`social media` -> `social_media`, `L Theanine` -> `l_theanine`) before validation so both hosts can reuse a single typed input contract.
- `getFactorCorrelations` is deliberately an aggregate data feed for P4 rather than a user-facing insight engine. It returns raw nightly points plus summary slices for activities, supplements, room conditions, and key numeric factors.
