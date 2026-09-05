# BestChef Vote Proof-of-Cook P2

Date: 2026-04-27

## Summary

BCVOTE-P2 is complete locally. The app now routes every recipe vote tier through a full-screen CookProof capture flow, uploads the proof through the server-backed media path, commits through the proof-gated vote RPC, and queues a device-local draft only for retryable/offline failures.

Public voting is still launch-blocked until BCVOTE-P3 through BCVOTE-P5 are complete, deployed, and verified.

## Shipped

- Added `app/(root)/submission/[id]/vote.tsx` as the full-screen proof capture route.
- Added `CookProofCapture` with tier selection, camera/library actions, preview, the required public-photo notice, and the five required states: empty, loading, error, success, and partial.
- Added `CookProofGallery` with approved proof rendering, reduced-motion handling, empty/loading states, and accessible proof actions.
- Replaced recipe detail direct voting with navigation to the proof capture route for `gold`, `silver`, `bronze`, and `like`.
- Added approved CookProof gallery data loading on submission detail and current-profile "My Cooks" loading on profile.
- Added `cloud-vote-proofs` helpers for approved proof reads and Supabase Storage public URL resolution.
- Added app interaction-contract coverage for route wiring, error states, gallery wiring, reduced motion, and the public-photo notice.

## Server Path

- The capture route re-encodes selected images as JPEG, reads the local bytes, calls module-level `prepareProof`, creates a `vote_proof` media upload intent, uploads bytes to the signed Storage URL, finalizes the upload, and calls `castVoteWithProof`.
- Retryable failures and offline/cloud-unready cases create `rc_local_vote_proofs` drafts only.
- The Expo bundle does not contain service-role behavior.
- The app does not write `file://` URIs into public `bc_*` rows.

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck`: passed after fixing structured vote-proof error handling in the route.
- `pnpm --filter @mylife/bestchef-app test -- app/(root)/__tests__/cook-proof-capture.test.tsx app/(root)/__tests__/uiux-interaction-contract.test.ts`: passed, 30 tests.
- `pnpm --filter @mylife/bestchef-app test`: passed, 17 files and 112 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux`: passed, 27 tests.
- `pnpm --filter @mylife/bestchef typecheck`: passed.
- `pnpm --filter @mylife/bestchef test`: passed, 57 files and 768 tests.
- `pnpm gate:function:changed`: passed.
- `pnpm check:parity --quiet`: passed with existing standalone warnings.
- `pnpm check:generated-artifacts`: passed.

## Notes

- Broad file-scoped app function gates for the new P2 app files still run the package-wide app function-gate suite and hit existing timing-sensitive slope/memory checks. The isolated noisy tests passed, and the required changed-function gate passed.
- P2 intentionally reserves proof alt text for a future schema column but does not add that column.
- P2 keeps the profile surface as a "My Cooks" gallery. The P4 3-up grid and tap-to-scroll detail behavior remain next-scope work.
- Simulator visual QA remains P5 scope.

## Next Phase

Start BCVOTE-P3: add `supabase/functions/moderate_vote_proof/index.ts`, stub live provider interfaces for local development, run NSFW and food-likeness checks, optionally blur faces, call `bc_apply_vote_proof_decision`, and document leaderboard recompute behavior.
