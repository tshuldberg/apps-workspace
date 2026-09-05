# 2026-04-27 - BestChef F-007 Feed Video Likes

## Scope

Completed `apps/bestchef/Tickets/F-007-feed-like-videos.md`.

## Changes

- Added server-backed submission likes with `bc_submissions.like_count`, `bc_submission_likes`, one like per profile, count refresh triggers, RLS policies, and read/write RPCs.
- Added local `rc_bestchef_submission_likes` and `rc_bestchef_submission_like_queue` tables for optimistic state, offline survival, relaunch persistence, and pending cloud sync.
- Wired the feed heart button to real optimistic like/unlike behavior with cloud-truth count reconciliation.
- Added out-of-order response protection so rapid taps do not let stale cloud responses delete the newest queued desired state.
- Added submission-detail heart/count state that shares the same local/cloud target as the feed video.
- Added account-deletion local wipe coverage for cached likes and pending like queue rows.
- Bumped the BestChef module schema to v21 and capped local like cache/queue tables to `device_local` sync scope.
- Marked F-007 success criteria complete.

## Files

- `apps/bestchef/app/(root)/feed.tsx`
- `apps/bestchef/app/(root)/recipe/[id].tsx`
- `apps/bestchef/app/(root)/data/feed-likes.ts`
- `apps/bestchef/app/(root)/data/__tests__/feed-likes.test.ts`
- `apps/bestchef/app/(root)/data/account.ts`
- `apps/bestchef/app/(root)/data/cloud-submissions.ts`
- `apps/bestchef/app/(root)/data/demo.ts`
- `apps/bestchef/app/(root)/data/demo-videos.ts`
- `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts`
- `modules/bestchef/src/cloud/submission-likes.ts`
- `modules/bestchef/src/cloud/__tests__/submission-likes.test.ts`
- `modules/bestchef/src/cloud/schema.sql`
- `modules/bestchef/src/cloud/types.ts`
- `modules/bestchef/src/cloud/submission.ts`
- `modules/bestchef/src/cloud/account-lifecycle.ts`
- `modules/bestchef/src/db/schema.ts`
- `modules/bestchef/src/definition.ts`
- `modules/bestchef/src/index.ts`
- `supabase/migrations/20260427000012_bestchef_submission_likes.sql`
- `supabase/tests/bc_submission_likes.sql`
- `apps/bestchef/Tickets/F-007-feed-like-videos.md`

## Verification

Passed:

- `pnpm --filter @mylife/bestchef-app exec vitest run 'app/(root)/data/__tests__/feed-likes.test.ts' 'app/(root)/__tests__/uiux-interaction-contract.test.ts'`
- `pnpm --filter @mylife/bestchef-app exec tsc --noEmit --pretty false`
- `pnpm --filter @mylife/bestchef exec vitest run src/cloud/__tests__/submission-likes.test.ts src/cloud/__tests__/schema.test.ts src/cloud/__tests__/account-lifecycle.test.ts src/__tests__/sync-policy.test.ts src/db/__tests__/cooking.test.ts src/db/__tests__/nutrition.test.ts src/db/__tests__/pantry.test.ts src/__tests__/vote-proof.test.ts src/social/__tests__/follower-updates.test.ts`
- `pnpm --filter @mylife/bestchef exec tsc --noEmit --pretty false`
- `supabase migration up --local`
- `docker exec -i supabase_db_bestchef-staging psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260427000012_bestchef_submission_likes.sql`
- `supabase test db supabase/tests/bc_submission_likes.sql --local`
- `pnpm gate:function:changed`
- `pnpm check:parity --quiet`

## Resolved During Verification

- The first pgTAP run failed because the local Supabase database had not applied `20260427000012`.
- After applying it, pgTAP exposed an ambiguous `ON CONFLICT (submission_id, profile_id)` reference inside `bc_set_submission_like`. The migration and schema mirror now use `on conflict on constraint bc_submission_likes_unique`.

## Next

Feature-ticket continuation should move to `Tickets/F-008-feed-comment-on-videos.md`.
