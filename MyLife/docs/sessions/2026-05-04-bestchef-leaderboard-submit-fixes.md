# 2026-05-04 BestChef Leaderboard and Submit Fixes

## Summary

Fixed three issues from iPhone testing:

- Submit crashed immediately after continuing from the Mise en place ingredients step.
- Leaderboard active filter chips could stretch into very tall tiles after choosing filters like `This week`.
- Leaderboard seed content was not appearing because the cloud leaderboard load could run before the BestChef cloud client was initialized and then leave the screen stuck in loading.

## Changes

- `apps/bestchef/app/(root)/components/submit/steps/VideoStep.tsx`
  - Replaced the invalid `HERO_GRADIENT as unknown as [string, string]` gradient value with `[HERO_GRADIENT.from, HERO_GRADIENT.to]`.
  - This fixes the native crash when the video step renders after the ingredients step.
- `apps/bestchef/app/(root)/hooks/useLeaderboardEntries.ts`
  - Waits for `BestChefCloudProvider` readiness before calling `getLeaderboardSubmissions`.
  - Catches query and initialization errors so the screen exits loading instead of pinning the spinner.
  - Uses request ids to ignore stale async loads.
- `apps/bestchef/app/(root)/(tabs)/leaderboard.tsx`
  - Adds an explicit error state for failed leaderboard loads.
  - Constrains the active filter summary `ScrollView` height and chip alignment to prevent stretched filter tiles.
- `apps/bestchef/app/(root)/__tests__/leaderboard-filters.test.ts`
  - Added static regression coverage for the cloud readiness guard and active filter chip layout.
- `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts`
  - Added a regression check that the submit video progress gradient uses concrete colors.

## Data Verification

Queried the configured BestChef staging Supabase project with the app anon config:

- Approved submissions visible while unauthenticated: 48.
- Approved submissions visible after anonymous sign-in: 48.
- `cheftom` profile visible as `ChefTom`.
- Current time-window counts: `today` 0, `week` 28, `month` 48.

No reseed was needed. The seed data exists and RLS allows reads; the app was failing before the query could complete reliably.

## Verification

- `pnpm --filter @mylife/bestchef-app test -- "app/(root)/__tests__/leaderboard-filters.test.ts" "app/(root)/__tests__/uiux-interaction-contract.test.ts"`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm gate:function:changed`

The changed-function gate also included pre-existing dirty recipe-import files from the worktree and passed those tests.

## Notes

- Existing uncommitted work in recipe import, investor docs, `app.json`, and a module swap file was not modified.
- Hub-side parity changes were not needed because these fixes are standalone BestChef social/submit UI behavior and app-level cloud readiness, not shared module contract changes.
