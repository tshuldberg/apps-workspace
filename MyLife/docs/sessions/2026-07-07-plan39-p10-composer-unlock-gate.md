# Plan 39 P10/P11 - Public composer + $4.99 unlock gate + real submit chain (2026-07-07)

Track C increment 1 (of 6) on `feature/meerkat-public-base-feed`. Completes AC-2 client-side: a verified, un-purchased user sees the locked composer + the $4.99 unlock sheet; a purchased user posts through the REAL three-gate chain and sees "posted" ONLY off a real dual-signed acceptance receipt.

## What shipped (both surfaces)

- **Batch humanity wallet** (`humanity-core.ts` mobile + web): the verification service issues a BATCH of single-use tokens per real check; the wallet now holds the whole batch (`getStoredHumanityTokens` / `setStoredHumanityTokens`), back-compat with a legacy single token. `popStoredHumanityToken` (config optional) removes one token and `unshiftStoredHumanityToken` returns it on a pre-spend failure; `getStoredHumanityTokenCount` for the wallet indicator. Without this, viewing spent the only token and a subsequent post was impossible. `acquireHumanityTokenBatch` returns all issued tokens; `VerifySheet` (both) now stores the batch.
- **persona-core** (both): `acquirePersonaSession` pops one token from the batch (was: get + clear) and pushes it back on every failure that never reached the server-side redeem.
- **public-post-client.ts** (new, both): the real submit chain. `submitPublicPost` runs session (`x-mk-session`) -> mint persona-bound app-unlock proof (`x-mk-app-unlock`, POST `/api/entitlements/meerkat-app-token`) -> pop humanity token (`x-mk-humanity`) -> persona-sign the post (`createPublicPost`) -> POST `/submit`. Returns `ok` ONLY when the returned acceptance receipt DUAL-VERIFIES against the descriptor-pinned node key (`verifyPublicPost`); a node that fabricates an acceptance is rejected `unverified_receipt` (NC-3). Honest reason buckets: `session / humanity / unlock / policy / caps / rejected / unreachable / needs_verification / needs_unlock / unlock_unavailable / not_configured / not_wired`. Humanity token pushed back only on a session-gate/network failure (before the redeem).
- **Composer UI**: mobile `public/compose.tsx` (route registered in `_layout.tsx`) + web `PublicComposeView.tsx` (rendered inline by `PublicView`). Locked state = the S5 $4.99 unlock sheet (mobile drives the real IAP `purchaseAppUnlock`/`restoreAppUnlock`; web opens settings where the Stripe rail lives). Unlocked = the S6 composer with the before-going-live card + wallet-passes indicator. Compose entry bar wired into the Public tab/view; the feed re-pages on return (no optimistic injection).
- **app-unlock-keys.ts** (new, mobile): RN-free key constants so the pure data layer references the unlock cache without pulling `react-native-purchases` into its graph.
- **Price**: sourced from `@mylife/billing-config` on both surfaces (NC-P5), never a hardcoded dollar string. Added `@mylife/entitlements` to web deps (for `appUnlockBindingMessage`).

## Parity + tests

- `scripts/check-meerkat-parity.mjs`: new composer block locks 10 verbatim copy strings + the placeholder + the submit-chain headers + `json.accepted` receipt check + `unshiftStoredHumanityToken` + billing-config price source + the composer wiring on both surfaces.
- New tests: `public-post-client.test.ts` mobile (17) + web (8) proving sent-only-on-real-receipt, fabricated-receipt rejection, each honest bucket, and batch-wallet pop/unshift/count. Suites: mobile app 1069, web 710. Full `pnpm check:parity`, both typechecks green.

## Founder flags (unchanged, conservative)

Nothing new. The whole public tier is `not_configured` in this build (no persona/humanity/commons/hosted-API configured), so the composer honestly short-circuits; the real chain is proven server-side by `plan39-public-write-e2e.test.ts` and client-side by the new unit tests.

## Remaining Track C increments

2 thread + replies (S7), 3 reverse-resolve alias (S8 cards), 4 public profile + follows (S8), 5 topic channels + Explore reskin (S9/S10), 6 report sheet (S12).
