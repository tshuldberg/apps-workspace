# MyTrails Phase 2

## Summary
- Completed Phase 2 of the MyTrails UIUX mission control plan by rebuilding `apps/mobile/app/(trails)/discover.tsx` into a global discovery hub.
- Added discovery selectors to `@mylife/trails` so the screen can load featured regions, trending trails, curated collections, and personalized recommendations from the existing trail database.
- Marked `P2-A` done in `docs/plans/mytrails-uiux-mission-control.html` and updated `memory.md`.

## Why
- The old discover screen was a flat searchable list and did not match the Phase 2 design brief.
- The trails module already had the underlying trail-database data, but it lacked selector helpers for discovery-specific groupings and ranking.

## Files Changed
- `apps/mobile/app/(trails)/discover.tsx`
- `docs/plans/mytrails-uiux-mission-control.html`
- `memory.md`
- `modules/trails/src/__tests__/discovery.test.ts`
- `modules/trails/src/db/crud.ts`
- `modules/trails/src/discovery.ts`
- `modules/trails/src/index.ts`

## Implementation Notes
- Added `modules/trails/src/discovery.ts` with:
  - `searchTrailDatabase`
  - `getFeaturedRegions`
  - `getTrendingTrails`
  - `getCollections`
  - `getRecommendedTrails`
- Kept the mobile discovery screen fully local-data/offline-first by reading from the existing SQLite-backed trail database.
- Used the existing MyTrails glass/tokens stack instead of adding `react-native-maps`, which is not currently installed in this repo.
- Preserved save-to-library behavior so discovered database entries can still be promoted into user trails.
- Fixed a pre-existing duplicate `TrailPhoto` type import in `modules/trails/src/db/crud.ts` because it blocked package-local typecheck.

## Verification
- `pnpm --filter @mylife/trails exec vitest run src/__tests__/discovery.test.ts src/__tests__/trail-database.test.ts`
- `pnpm --filter @mylife/trails exec tsc --noEmit`
- `pnpm --filter @mylife/mobile exec tsc --noEmit --pretty false 2>&1 | rg "app/\\(trails\\)/discover.tsx|modules/trails/src/(discovery|index|db/crud)\\.ts" || true`

## Gate Results
- `pnpm scaffold:function-test --file modules/trails/src/discovery.ts --function getFeaturedRegions`
  - The scaffold command succeeded, but the generated gate test imported the shared helper outside the package `rootDir`, so the scaffold artifact was removed after inspection.
- `pnpm gate:function --file modules/trails/src/discovery.ts --tests modules/trails/src/__tests__/discovery.test.ts`
  - The gate expanded to the full `@mylife/trails` package test suite and failed on an unrelated existing assertion in `src/__tests__/navigation.test.ts`.
- `pnpm gate:function:changed`
  - The changed-file gate expanded into the large dirty mobile worktree and failed on unrelated existing mobile typecheck issues in Nutrition and Trails weather screens, not on the new discover screen.

## Remaining Notes
- The discover map hero is a stylized synthetic map surface built from the existing trail coordinates. Native map embedding can be added later if `react-native-maps` becomes a repo dependency.
