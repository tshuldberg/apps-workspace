# BestChef Vote Proof-of-Cook P3

Date: 2026-04-27

## Summary

BCVOTE-P3 is complete locally. The server side now has a vote-proof moderation Edge Function that consumes `bc_moderation_queue`, evaluates proof images through provider interfaces, calls `bc_apply_vote_proof_decision`, and leaves proofs pending on provider outage instead of auto-approving.

Public voting is still launch-blocked until BCVOTE-P4 through BCVOTE-P5 are complete, deployed, and verified.

## Shipped

- Added `supabase/functions/moderate_vote_proof/index.ts`.
- Added worker-secret auth via `BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET` or `BESTCHEF_MODERATION_WORKER_SECRET`.
- Added NSFW and food-likeness classifier interfaces with local stub providers for development.
- Added optional face-blur provider interface and metadata recording on `bc_media_assets`.
- Added fail-closed provider outage handling: the queue item is marked failed, the proof remains pending, and no vote is approved.
- Added decision RPC integration through `bc_apply_vote_proof_decision`.
- Added focused worker tests in `supabase/functions/moderate_vote_proof/__tests__/index.test.ts`.

## Reconciliation

No hosted nightly cron is configured in this repo. The existing manual recompute helper is `bc_rebuild_rankings(p_dish_id uuid default null)`.

TODO before staging/public launch: configure a Supabase cron or scheduled server job to call `bc_rebuild_rankings` after moderation decisions.

## Provider TODO

Local development uses stub providers behind the live interfaces. Before staging launch, configure live NSFW, food-likeness, and optional image-transform/face-blur credentials in Supabase/server secret storage only.

## Verification

- `pnpm --dir apps/bestchef exec vitest run --root ../.. supabase/functions/moderate_vote_proof/__tests__/index.test.ts`: passed, 9 tests.
- `pnpm --dir apps/bestchef exec tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module ESNext --target ES2022 --lib ES2022,DOM ../../supabase/functions/moderate_vote_proof/index.ts`: passed.
- `pnpm --filter @mylife/bestchef-app typecheck`: passed.
- `pnpm --filter @mylife/bestchef-app test`: first run hit the existing timing-sensitive `public-data-policy.function-gate` slope check; rerun passed, 17 files and 112 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux`: passed, 27 tests.
- `pnpm --filter @mylife/bestchef typecheck`: passed.
- `pnpm --filter @mylife/bestchef test`: passed, 58 files and 777 tests, including `moderate_vote_proof`.
- `pnpm gate:function:changed`: passed.
- `pnpm check:parity --quiet`: passed with existing standalone warnings.
- `pnpm check:generated-artifacts`: passed.

## Tooling Notes

- `pnpm exec vitest run supabase/functions/moderate_vote_proof/__tests__/index.test.ts` does not work from the root because the root workspace does not expose a direct `vitest` binary.
- `pnpm exec tsc -p supabase/functions/tsconfig.json --noEmit` still fails because `vitest/globals` is not resolvable from the root Supabase functions context. The Edge Function source was typechecked directly through the BestChef app package context instead.
- `pnpm gate:function --file supabase/functions/moderate_vote_proof/index.ts` still fails before reaching the P3 file because root lint enters unrelated packages `@mylife/admin-ui` and `@mylife/restaurant-saas`, which do not have ESLint config in this dirty workspace.

## Next Phase

Start BCVOTE-P4: profile "My Cooks" 3-up grid, submission gallery view-all behavior, proof focus navigation, swipe/confirm vote deletion through `bc_delete_vote`, and account-deletion proof/media purge verification.
