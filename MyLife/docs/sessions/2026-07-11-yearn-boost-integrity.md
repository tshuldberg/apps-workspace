# 2026-07-11: Yearn Boost Integrity (Plan 50)

**Branch:** `feature/yearn-boost-integrity` (worktree `/Users/trey/Desktop/Apps-wt-50-yearn-boost-integrity`, off `main` at 6f8e6545)
**Plan:** `docs/plans/done/50-yearn-boost-integrity.md` (authored by the Fable orchestrator before any agent ran)
**Source findings:** errors_log 2026-07-11 activate_boost row (rev-yearn P2); plan 47 Phase 2 item 3 + Phase 5.
**Orchestration:** Fable authored the plan and reviewed all output against the actual SQL and StoreKit contract; a sonnet subagent did the mechanical implementation; an opus subagent ran the adversarial (red-team) review.

## What was done and why

`yearn.activate_boost(text)` (migration 20260525000012) was SECURITY DEFINER, granted to `authenticated`, with no receipt validation and no uniqueness on `original_transaction_id`. Any signed-in user could self-grant unlimited 7-day visibility boosts via a direct PostgREST call (revenue leak + `discover_profiles` ranking abuse). Plan 47 Phase 1 had removed the boost UI, but the RPC and the client repository call remained.

The fix removes every client-trusted path and moves activation behind server-side App Store Server API validation:

1. **Migration `20260712000001_yearn_boost_integrity.sql`** (collision-free vs 20260525*/20260711*): drops `yearn.activate_boost(text)`; adds audit columns (`transaction_id`, `product_id`, `environment`); dedupes and adds a partial unique index on `original_transaction_id`; adds `yearn.grant_boost(...)`, SECURITY DEFINER, executable ONLY by `service_role`, idempotent for same-user retries, raising SQLSTATE `YB409` on cross-user replay, with an `auth.users` existence check.
2. **Edge function `supabase/functions/yearn-activate-boost`** (DI pattern per dowork-rc-webhook): gateway `verify_jwt` stays ON (not in the config.toml disable list); strict bearer decode (exactly 3 segments, non-empty `sub`, anon-role rejected); validates the transaction via App Store Server API (ES256 JWT via WebCrypto, GET `/inApps/v1/transactions/{id}`, production-then-sandbox on 404); enforces bundleId `com.mylife.yearn`, productId `com.mylife.yearn.boost`, type Consumable, echoed transactionId match, no revocationDate, originalTransactionId present; grants via service-role REST rpc with `Content-Profile: yearn`. **Fails closed with 503 `boost_unavailable` when Apple credentials are unset, so boost stays fully disabled until validation is live.** Grant inputs come from Apple's payload, never the request body.
3. **App side:** `yearnRepository.activateBoost` now calls the edge function via `functions.invoke` with typed `YearnBoostActivationError` codes; `yearnBoost.ts` provides honest failure copy (every string states no boost was activated); deck formatter says "Boost isn't available yet" instead of "Boost previewed"; README RPC list corrected. Zero `activate_boost` references remain in `apps/yearn` outside intentional never-called assertions.
4. **Repo hygiene (incidental, blocking):** commit 0b7358ec had accidentally committed `node_modules` and `apps/yearn/node_modules` as absolute-path symlinks (`.gitignore`'s `node_modules/` matches directories, not symlinks), leaving the main tree with a self-referential ELOOP and breaking pnpm in every worktree. Fixed in 81d72b70 (untracked, removed, slash-less ignore rule) and both trees reinstalled.

## Adversarial review (opus red team)

Verdict: **SHIP-WITH-FIXES** (leak confirmed fully closed; hardening only). Applied in 75018b5b:
- F1: strict JWT decode (3 segments, anon-role rejection) + comment that security requires `verify_jwt=true` + 401 tests for anon-key-style and signature-less bearers.
- F6: cross-user replay raises SQLSTATE `YB409`; the store matches the stable code with the message substring as fallback + store-level tests.

Deferred to the future StoreKit purchase UI plan (documented in plan 50 Follow-ups): bind redemption to Apple's `appAccountToken` matching the caller's `sub` (prevents theft-of-boost via a leaked un-redeemed transactionId); decide the policy for Sandbox-environment grants once real purchases exist (Sandbox acceptance is currently required for App Review and is recorded per-row).

Accepted-by-design (reviewed): the JWS payload returned by Apple is decoded without x5c chain verification because it arrives over TLS in response to our own authenticated request; the echoed transactionId is re-checked against the requested one.

## Commits

- 290f43d3 fix(yearn): drop client-callable activate_boost, add unique tx index + service-role grant_boost
- 81d72b70 fix(repo): untrack node_modules symlinks committed in 0b7358ec and ignore node_modules symlinks
- c2b95e61 feat(yearn): App Store Server API validated boost activation edge function
- 62dfec42 test(yearn): sweep yearn-activate-boost function tests into the app suite
- 13407e73 fix(yearn): boost activation via validated edge function with honest failure copy
- 75018b5b fix(yearn): harden boost auth decode and stabilize cross-user replay error contract
- (docs commit follows: ledgers, plan 50 to done/, this log)

## Verification (run first-hand by the orchestrator, not just reported by agents)

- `pnpm --filter @mylife/yearn-app typecheck`: clean.
- `pnpm --filter @mylife/yearn-app test`: 166/166 passing (baseline 134 + 20 edge-function + 12 app-side).
- `npx tsc --noEmit -p supabase/functions/tsconfig.json`: zero errors in yearn-activate-boost; 4 pre-existing errors in untouched bestchef-vision / mynews-review test files.
- `pnpm gate:function:changed` vs merge-base: green (46/46 in the gate's own run).
- `git grep activate_boost -- apps/yearn`: only intentional never-called assertions.

## Founder ops (boost remains disabled until ALL done)

1. Apply migration `20260712000001` to the hosted project (kills the leak server-side immediately).
2. Create an App Store Connect In-App Purchase key; set function secrets `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY` (optional `YEARN_APPLE_BUNDLE_ID`, `YEARN_BOOST_PRODUCT_ID`).
3. `supabase functions deploy yearn-activate-boost` (keep gateway JWT verification ON; never add it to the `verify_jwt = false` list).
4. StoreKit purchase UI is a separate future plan; it must implement the two documented follow-ups.

## Remaining items / notes

- Branch is ready to merge to `main` (squash per repo convention) whenever the founder wants; not pushed.
- The main working tree's `feature/dowork-production-readiness` branch (and `main`) still TRACK the node_modules symlinks; the untracking fix rides this branch. Until merged, a fresh checkout of those branches recreates the broken symlinks. The other session's tree will show a node_modules typechange in git status; the correct resolution is this branch's fix.
- errors_log boost row set to Mitigated (repo fixed; hosted apply pending), node_modules row Resolved.
