# MyTrails Phase 3

## Summary

Completed `P3-A` and `P3-B` from `docs/plans/mytrails-uiux-mission-control.html`:

1. Rebuilt `trail/[id].tsx` into an immersive detail surface with photo hero, stats, map/elevation cards, nearby trails, review preview, sticky actions, and one-tap offline download persistence.
2. Rebuilt `reviews.tsx` into a trail-specific review experience with trail selection, hero summary, histogram, filters, photo-backed review cards, helpful actions, and pagination.
3. Rebuilt `write-review.tsx` so reviews can be posted against a selected trail with star rating, multi-condition chips, and attachment selection from existing trail photos.

Phase 3 now puts the MyTrails detail/review loop on top of the Phase 0 lime/glass foundation instead of the earlier flat CRUD screens.

## Files Changed

### Mission control and session memory

- `docs/plans/mytrails-uiux-mission-control.html`
- `docs/sessions/2026-04-06-mytrails-phase-3.md`
- `memory.md`

### Trails mobile screens

- `apps/mobile/app/(trails)/_ui.tsx`
- `apps/mobile/app/(trails)/trail/[id].tsx`
- `apps/mobile/app/(trails)/reviews.tsx`
- `apps/mobile/app/(trails)/write-review.tsx`

### Trails module data layer

- `modules/trails/src/types.ts`
- `modules/trails/src/db/schema.ts`
- `modules/trails/src/db/crud.ts`
- `modules/trails/src/definition.ts`
- `modules/trails/src/index.ts`
- `modules/trails/src/ui/components/MaterialSymbol.tsx`
- `modules/trails/src/__tests__/reviews.test.ts`

## What Changed

### Detail surface

- Replaced the old flat trail detail screen with:
  - full-bleed photo carousel using `expo-image`
  - custom overlay header controls
  - glass title hero, 4-stat grid, activity/type chips, and expandable description
  - `MiniMapCard` + `ElevationMiniChart` previews
  - review preview card and nearby trail rail
  - sticky bottom actions for recording, offline download, and save
- Wired the start CTA to `/(trails)/record?trailId=<id>`.
- Implemented offline region persistence from the detail screen by generating a trail-scoped bounding box, creating a region record, and marking it ready in SQLite.

### Review flow

- Rebuilt `reviews.tsx` around a selected trail instead of the old global trail-review list.
- Added a rating histogram, filter chips (`All`, `5 Star`, `With Photos`, `Recent`), richer review cards, local helpful increments, and a paginated load-more flow.
- Added trail switching when the screen is opened without a specific `trailId`, so the route still works from global entry points.

### Review photo attachments

- Added review photo support to the trails module:
  - `photoUris` field on review schema/input
  - schema migration v11 for `tr_reviews.photo_uris`
  - CRUD read/write support
- Added `getTrailPhotos` to load photos linked directly to a trail or to recordings on that trail.
- Updated `write-review.tsx` to attach up to three existing trail photos from local memories.

### Helper surface

- Added `getNearbyTrails` to rank related trails by region, difficulty, and approximate proximity for the detail rail.
- Added a missing `share` icon mapping to the shared Trails Material Symbol wrapper.
- Tightened `TrailsScreen` refresh-control typing in `_ui.tsx` so Trails-local mobile type output is clean.

## Verification

Passed:

- `pnpm --filter @mylife/trails exec vitest run src/__tests__/reviews.test.ts`
- `pnpm --filter @mylife/trails exec vitest run src/__tests__/reviews.test.ts src/__tests__/ui.shared.test.tsx`
- `pnpm --filter @mylife/mobile exec eslint "app/(trails)/trail/[id].tsx" "app/(trails)/reviews.tsx" "app/(trails)/write-review.tsx" "app/(trails)/_ui.tsx"`
- `pnpm --filter @mylife/mobile exec tsc --noEmit --pretty false 2>&1 | rg "app/\\(trails\\)/(trail/\\[id\\]|reviews|write-review|_ui)\\.tsx"`
- `pnpm --filter @mylife/trails exec tsc --noEmit --pretty false 2>&1 | rg "src/(db/crud|types|definition|ui/components/MaterialSymbol|__tests__/reviews)"`

Repo-level / package-level blockers already present in the workspace:

- `pnpm --filter @mylife/trails test`
  - fails in pre-existing `src/__tests__/navigation.test.ts`
  - also still includes unrelated `discovery.function-gate` failures when run as the full suite
- `pnpm --filter @mylife/trails typecheck`
  - still fails on the pre-existing `src/__tests__/discovery.function-gate.test.ts` tsconfig/rootDir issue
- `pnpm --filter @mylife/mobile typecheck`
  - still fails on unrelated nutrition and pre-existing trails weather errors outside this phase

## Gate Status

- `pnpm gate:function --file modules/trails/src/db/crud.ts`
  - ran as required because module logic changed
  - failed on the pre-existing `modules/trails/src/__tests__/navigation.test.ts` expectation mismatch (`easy` returned where the test expects `moderate|hard|expert`)
- `pnpm gate:function:changed`
  - ran as required
  - lint completed with repo-wide warnings
  - the run then failed in the known dirty-worktree mobile typecheck sweep on unrelated nutrition files plus existing `apps/mobile/app/(trails)/weather.tsx` errors outside the Phase 3 files

## Notes

- The mission-control tracker was updated to mark `P3-A` and `P3-B` as done.
- Review attachments intentionally reuse existing trail photos rather than introducing a new photo picker dependency in this phase.
