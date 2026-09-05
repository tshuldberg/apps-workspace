# 2026-05-06 BestChef ChefTom Leaderboard And Feed Seed

## Summary

- Seeded the production BestChef Supabase project `zjxabnazbdocrqpyixgo` with 20 approved ChefTom recipe submissions.
- Set every ChefTom submission baseline to `vote_score = 1000`, `upvote_count = 1000`, `downvote_count = 0`, `reviewed_count = 1000`, `like_count = 1000`, and `rank = 1`.
- Verified with the production anon key that all 20 ChefTom recipes are visible to public/TestFlight clients in:
  - Vote feed, 20/20 rows.
  - All-time Top 100, 20/20 rows.
  - Dish leaderboards, 20/20 checked with ChefTom at #1 and 1000.
  - Cuisine Top 100 buckets: American, British, European, Italian.
  - Region Top 100 bucket: Editorial Seed.
  - Today, week, and month Top 100 ranges, 20/20 rows at current seed timestamps.

## App Fixes

- Fixed Vote feed public rendering so it loads public rows before a social profile exists, then refetches with the viewer profile when available.
- Kept tap voting profile-safe by continuing to require the BestChef social profile id for `castTapVote`.
- Updated cloud vote feed merge to over-fetch fresh and top rows before dedupe so overlapping queries still return 20 unique items.
- Updated leaderboard reads to use the configured Supabase client without requiring anonymous auth readiness.
- Joined leaderboard rows to social profiles, dishes, and recipe snapshots so Top 100 displays ChefTom dish/profile/cuisine/region labels.
- Kept leaderboard joins compatible with the deployed production schema by avoiding unsupported `bc_dishes` visual columns.
- Fixed Top 100 shortcut query params so `kind=dish`, `kind=cuisine`, and `kind=region` open the matching leaderboard and populate a default bucket.

## Simulator

- Booted iPhone 16e simulator `FEDE5E75-7F2E-4114-B5FC-037021EA50B0`.
- Rebuilt and launched BestChef with production public Supabase env.
- Verified Vote tab renders ChefTom with `#1 THIS WEEK`, `1.0k` likes, and `1.0k` reviewed count.
- Verified Top 100 renders ChefTom dish names and profile labels instead of generic entry names.

## Verification

- `pnpm --filter @mylife/bestchef-app test -- "app/(root)/__tests__/cheftom-seed.test.ts" "app/(root)/__tests__/leaderboard-filters.test.ts" "app/(root)/__tests__/uiux-interaction-contract.test.ts"`
- `pnpm --filter @mylife/bestchef-app test -- --run`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm --filter @mylife/bestchef-app build`
- `pnpm --filter @mylife/bestchef test -- src/cloud/__tests__/submission.test.ts src/cloud/__tests__/voting-engine.test.ts`
- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm gate:function:changed`
- `pnpm check:parity --quiet`
- `pnpm check:generated-artifacts`

## Notes

- The first full app test run hit a transient auth-link function-gate timing slope failure; rerunning the same full app suite passed 32 files and 258 tests.
- Production anon verification passed after seed and code fixes.

## Roast Chicken Detail Follow-Up

- Reproduced the user report that opening the production Roast Chicken Top 100 item could land on `Recipe not found`.
- Fixed the recipe detail route so direct cloud submission UUIDs load publicly from Supabase without waiting for a ready viewer social profile.
- Corrected the cloud UUID detector in `app/(root)/data/cloud-submissions.ts`; it was missing the standard UUID hyphen before the final 12-character segment.
- Added public chef profile mapping to recipe detail so ChefTom renders as `ChefTom` instead of the generic public fallback.
- Found production anon clients could read approved `bc_submissions` but not joined `bc_recipe_snapshots` because the RLS policy compared `s.recipe_snapshot_id = id` inside a subquery. Added and pushed `supabase/migrations/20260506000001_bestchef_public_recipe_snapshots.sql` to qualify `public.bc_recipe_snapshots.id`.
- Replaced the placeholder three-step ChefTom JSON snapshots with full editorial baseline recipes for all 20 dishes. Roast Chicken now has 13 ingredients and 7 detailed steps.
- Added retired `cheftom:` cleanup to `scripts/seed-cheftom-content.mjs`, then reseeded production and verified exactly 20 approved ChefTom rows, with no missing snapshots and no thin recipes.
- Rebuilt and reinstalled the BestChef iPhone 16e simulator app, deep-linked to production Roast Chicken submission `96c77ec8-1b13-4d98-8cdb-4b1a24390d0c`, and verified the screen renders `ChefTom Roast Chicken`.

## Follow-Up Verification

- `pnpm --filter @mylife/bestchef-app test -- "app/(root)/data/__tests__/cloud-submissions.test.ts" "app/(root)/__tests__/cheftom-seed.test.ts" "app/(root)/__tests__/uiux-interaction-contract.test.ts"`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm --filter @mylife/bestchef-app build`
- `pnpm --filter @mylife/bestchef test`
- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`
- `supabase db push --dry-run --workdir /Users/trey/Desktop/Apps/MyLife`
