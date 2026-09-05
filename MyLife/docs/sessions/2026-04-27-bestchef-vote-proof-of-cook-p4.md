# BestChef Vote Proof-of-Cook P4

Date: 2026-04-27

## Summary

Completed BCVOTE-P4 locally for profile and submission proof integration, owner deletion, and account-deletion cascade verification.

## Shipped

- Submission detail CookProof gallery now loads approved proof totals, shows the 12 most recent proofs by default, and exposes `View all (N)`.
- Proof taps carry `proofId` into the submission detail. The focused proof is included first and highlighted so taps from profile land with the voter proof in view.
- Profile `My Cooks` now renders approved proofs as a 3-up grid with proof image, submission title, tier, open action, and delete action.
- Deletion UI confirms before deleting and calls the authenticated `bc_delete_vote(p_submission_id uuid)` path only. No service-role behavior was added to the Expo bundle.
- Added `deleteVoteWithProof` typed helper in `@mylife/bestchef`.
- Added migration `20260427000009_bc_vote_proof_deletion_media.sql` so `bc_delete_vote` removes the vote/proof rows and marks linked proof media deleted/private while preserving Storage refs for server cleanup.
- Extended pgTAP coverage for vote deletion media state, account-deletion vote/proof cascade, and account-deletion worker media inventory.

## Files Changed

- `apps/bestchef/app/(root)/recipe/[id].tsx`
- `apps/bestchef/app/(root)/(tabs)/profile.tsx`
- `apps/bestchef/app/(root)/components/CookProofGallery.tsx`
- `apps/bestchef/app/(root)/data/cloud-vote-proofs.ts`
- `apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts`
- `modules/bestchef/src/social/vote-proof.ts`
- `modules/bestchef/src/index.ts`
- `modules/bestchef/src/__tests__/vote-proof.test.ts`
- `modules/bestchef/src/cloud/schema.sql`
- `modules/bestchef/src/cloud/__tests__/schema.test.ts`
- `supabase/migrations/20260427000009_bc_vote_proof_deletion_media.sql`
- `supabase/tests/bc_vote_proofs.sql`

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef-app test` passed, 17 files and 112 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed, 27 tests.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed, 58 files and 778 tests.
- `supabase test db supabase/tests/bc_vote_proofs.sql --local` passed, 42 tests, after applying the new local migration.
- `pnpm gate:function:changed` passed across the current dirty worktree.
- `pnpm check:parity --quiet` passed with existing module-parity warnings for missing standalone repos.
- `pnpm check:generated-artifacts` passed.

## Caveats

- There is still no dedicated hosted vote-deletion Storage purge worker in this repo. The P4 RPC hides and marks proof media as deleted/private with `metadata.storage_purge = 'pending_server_worker'`; a server worker still needs to purge those bytes outside the Expo client.
- The existing account-deletion worker does include owned vote-proof media in its owner-profile media inventory and deletes owned Storage objects before Auth deletion.
- Staging and production deployment evidence was not captured in this session because hosted Supabase credentials, function deploys, Storage buckets, and device QA access were not exercised.
