# 2026-04-27 BestChef Vote Proof-of-Cook P1

## Summary

BCVOTE-P1 is complete locally. BestChef now has the local draft/cache layer and typed helper surface needed for the proof-of-cook capture flow, while keeping public vote-proof data out of mesh sync and out of local public transport paths.

Public voting remains launch-blocked until BCVOTE-P2 through BCVOTE-P5 are complete, deployed, and verified.

## Shipped

- Bumped BestChef local schema to v18 and added `rc_local_vote_proofs` for offline proof drafts with `draft`, `uploading`, `committing`, `committed`, `failed`, and `expired` states.
- Added a BestChef sync policy rule that caps local vote-proof drafts to `device_local` and strips `local_image_uri`, `content_hash`, and `failure_reason`.
- Added `modules/bestchef/src/social/vote-proof.ts` with:
  - `prepareProof`
  - JPEG EXIF segment stripping
  - SHA-256 content hashing on processed bytes
  - 2 MB proof size enforcement
  - local draft CRUD helpers
  - typed `bc_cast_vote` result/error mapping
  - `drainPendingProofs`
- Added `modules/bestchef/src/cloud/vote-proof.ts` with signed upload and finalize helpers that call server Edge Functions instead of exposing service-role behavior to the Expo bundle.
- Extended shared media upload policy so `owner_kind = 'vote_proof'` is accepted and capped at 2 MB.
- Added unit coverage for deterministic proof hashing, EXIF stripping, draft state transitions, TTL expiration, retry behavior, RPC error mapping, cloud helper invocation, v18 schema, and sync caps.

## Files

- `modules/bestchef/src/db/schema.ts`
- `modules/bestchef/src/definition.ts`
- `modules/bestchef/src/index.ts`
- `modules/bestchef/src/social/vote-proof.ts`
- `modules/bestchef/src/cloud/vote-proof.ts`
- `modules/bestchef/src/__tests__/vote-proof.test.ts`
- `modules/bestchef/src/__tests__/sync-policy.test.ts`
- `modules/bestchef/src/social/__tests__/follower-updates.test.ts`
- `modules/bestchef/src/db/__tests__/nutrition.test.ts`
- `modules/bestchef/src/db/__tests__/pantry.test.ts`
- `supabase/functions/_shared/media.ts`
- `supabase/functions/bestchef-media-upload/__tests__/index.test.ts`
- `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
- `memory.md`
- `errors_log.md`

## Verification

- `pnpm --filter @mylife/bestchef test -- src/__tests__/vote-proof.test.ts ../../supabase/functions/bestchef-media-upload/__tests__/index.test.ts` passed, 19 tests.
- Focused P1 regression set passed, 87 tests.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed, 57 files and 768 tests.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed, 24 tests.
- `pnpm --filter @mylife/bestchef-app test` passed, 106 tests.
- `pnpm gate:function --file modules/bestchef/src/social/vote-proof.ts` passed.
- `pnpm gate:function --file modules/bestchef/src/cloud/vote-proof.ts` passed.
- `pnpm gate:function:changed` passed on rerun across the current dirty worktree.
- `pnpm check:parity --quiet` passed with existing standalone parity warnings.
- `pnpm check:generated-artifacts` passed.

## Verification Notes

- `pnpm gate:function --file supabase/functions/_shared/media.ts` failed because the gate maps the Supabase shared file to the root package and root lint currently trips unrelated missing ESLint config in `@mylife/admin-ui` and `@mylife/restaurant-saas`. P1 behavior is covered by Edge Function media-upload tests, package tests, and the full changed-function gate rerun.
- The first `pnpm gate:function:changed` run hit a transient timing slope failure in `modules/health/src/integrations/__tests__/sleep-link.function-gate.test.ts`. The focused Health test passed, and the full changed-function gate passed on rerun.

## Deviations

- `prepareProof` includes built-in JPEG EXIF stripping and hashing, and accepts a platform `processImage` hook for Expo compression. P2 must supply the native image processing/upload wiring from the capture screen.
- `drainPendingProofs` uses injected upload and cast operations. This keeps server upload and RPC orchestration testable without putting service-role behavior into the app bundle.

## Next Phase

BCVOTE-P2 starts the app UX: `app/(root)/submission/[id]/vote.tsx`, `CookProofCapture`, `CookProofGallery`, submission-detail vote navigation, profile "My Cooks", all five required flow states, accessibility labels, reduced-motion gallery behavior, and UIUX interaction-contract tests.
