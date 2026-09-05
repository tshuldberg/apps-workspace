# BestChef Vote Proof-of-Cook P0

Date: 2026-04-27

## Summary

Implemented BCVOTE-P0 locally: server schema, RLS, RPCs, schema mirror, and SQL tests for Proof-of-Cook voting. Public voting now has a server-side proof gate in the local migration path, but the feature is not launch-ready until BCVOTE-P1 through BCVOTE-P5 are complete.

## Completed

- Added `supabase/migrations/20260427000008_bc_vote_proofs.sql`.
  - Creates `bc_vote_proofs` with one proof per vote, unique `(submission_id, content_hash)`, moderation status, capture/review timestamps, and public/private RLS.
  - Adds `bc_votes.status` values `active`, `proof_pending`, `proof_rejected`, and `deleted`.
  - Adds a named one-vote constraint on `(voter_profile_id, submission_id)` while preserving the existing `bc_votes.voter_profile_id` column name.
  - Extends `bc_media_assets.owner_kind` to include `vote_proof`.
  - Adds `bc_moderation_queue` and `bc_moderation_decisions` for the vote-proof moderation path.
  - Replaces scoring so only `bc_votes.status = 'active'` counts.
- Added `bc_cast_vote(p_submission_id uuid, p_tier text, p_media_asset_id uuid)`.
  - Rejects unauthenticated calls, missing profiles, missing approved submissions, invalid tiers, invalid proof assets, self-votes, duplicate votes, and duplicate proof hashes.
  - Creates `proof_pending` votes and pending proof rows, then queues moderation.
- Added `bc_delete_vote(p_submission_id uuid)`.
  - Deletes the caller's vote and cascades the proof row.
- Added `bc_apply_vote_proof_decision(p_proof_id uuid, p_decision text, p_reason text)`.
  - Admin/service-only decision path.
  - Approval promotes the proof, vote, and media to public active state.
  - Rejection keeps the proof/media non-public and the vote inactive.
- Replaced legacy `bc_submit_vote` with a proof-required failure and revoked it from public client roles.
- Mirrored the migration contract in `modules/bestchef/src/cloud/schema.sql`.
- Expanded `modules/bestchef/src/cloud/__tests__/schema.test.ts` to assert the P0 schema/RPC contract.
- Added `supabase/tests/bc_vote_proofs.sql` with pgTAP coverage for every P0 reject path, happy path, moderation decisions, delete cascade, and score exclusion.
- Updated:
  - `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
  - `docs/runbooks/bestchef-public-data-policy-runbook.md`

## Deviations

- Kept the existing `bc_votes.voter_profile_id` column instead of renaming it to `profile_id`, because current migrations, RLS, triggers, and app/module callers already depend on that name. The migration adds the required one-vote constraint against `(voter_profile_id, submission_id)`.
- Did not add an alt-text or caption column in P0. The future accessibility reservation is documented in the public data policy runbook, matching the session instruction.
- Did not implement app capture UX, local v18 draft storage, or the moderation Edge Function in this phase.

## Verification

- `claude mcp list` - Open Brain, Context7, and Perplexity connected.
- `pnpm install` - pass, lockfile already up to date.
- Baseline before edits:
  - `pnpm --filter @mylife/bestchef-app typecheck` - pass.
  - `pnpm --filter @mylife/bestchef typecheck` - pass.
- Local Supabase:
  - `supabase start` - pass, migration `20260427000008_bc_vote_proofs.sql` applied.
  - `supabase test db supabase/tests/bc_vote_proofs.sql --local` - pass, 37 tests.
- Focused contract:
  - `pnpm --filter @mylife/bestchef test -- src/cloud/__tests__/schema.test.ts` - pass, 5 tests.
- Phase gates:
  - `pnpm --filter @mylife/bestchef typecheck` - pass.
  - `pnpm --filter @mylife/bestchef test` - pass, 56 files / 754 tests.
  - `pnpm --filter @mylife/bestchef-app typecheck` - pass.
  - `pnpm --filter @mylife/bestchef-app test` - pass on rerun, 16 files / 106 tests. The first run hit a noisy existing auth-link function-gate timing slope and the immediate rerun passed.
  - `pnpm --filter @mylife/bestchef-app test:uiux` - pass, 24 tests.
  - `pnpm gate:function:changed` - pass. Existing mobile/web lint warnings remain warning-only.
  - `pnpm check:parity --quiet` - pass with existing standalone tracking warnings.
  - `pnpm check:generated-artifacts` - pass.

## Not Done

- BCVOTE-P1 local schema v18, proof preparation, upload helpers, RPC wrapper, draft store, and retry drain.
- BCVOTE-P2 capture screen, CookProof gallery, profile "My Cooks", and interaction-contract coverage.
- BCVOTE-P3 moderation Edge Function and provider classifier interface.
- BCVOTE-P4 gallery/profile integration details, delete swipe action, and account-deletion proof purge test.
- BCVOTE-P5 simulator QA matrix and staging/production deployment evidence.

## Next Phase

Start BCVOTE-P1 in `@mylife/bestchef`: local v18 `rc_local_vote_proofs`, deterministic proof preparation, server media asset helper, typed `bc_cast_vote` wrapper, and pending-proof drain state machine.
