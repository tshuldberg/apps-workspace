# 2026-07-30: Meerkat account.test.ts intermittent root-caused + fixed; CI billing recurrence

## Context

Launch-train continuation after the plans 52+53 merge (`cad7db07`). Ordered tasks: (1) confirm GitHub Actions billing fixed and CI green on main, (2) cut rc17 at `cad7db07`, (3) handle release-verify failures, (4) root-cause the `account.test.ts` intermittent (errors_log, Unresolved, security-relevant).

## 1. GitHub Actions billing is STILL broken (founder action required)

- Every CI run on main since the merge fails at job start: "The job was not started because recent account payments have failed or your spending limit needs to be increased" (runs 30509359636, 30509552329, 30509580547, confirmed via check-run annotations).
- A fresh rerun of 30509580547 (attempt 2) failed identically within seconds, proving billing was still broken at 2026-07-30 02:52 UTC. This is a RECURRENCE of the 2026-07-19 incident; the 2026-07-21 GitHub Pro upgrade fixed quota, but now the payment itself is failing.
- rc17 is blocked: the ledger requires a green full-matrix release-verify dispatch, which cannot run. errors_log row updated (Unresolved, founder action).
- A background monitor reruns the failed main run every 15 minutes and alerts the session when jobs actually start.

## 2. account.test.ts intermittent: root cause (cross-file leakage DISPROVEN)

Failing test: `apps/meerkat-web/src/lib/__tests__/account.test.ts` > "mint fails closed when the epoch-key route serves a different key than the issuer signs under" (line 336). Recorded belief: full-suite-only failure pointing at cross-file state leakage.

**Reproduced in ISOLATION on run 24 of a 30-run loop.** The failure is per-run crypto randomness, not suite interaction:

1. The test generates a module-level issuer keypair (modulus n1) and a per-test foreign keypair (n2), serves the foreign key from the epoch-key route, and raw-signs with the issuer key.
2. The client blinds under the served key, so the blinded message is uniform mod n2 (`prepareBlindCredentialRequest` line 413).
3. The fake service's `rawBlindSign` calls `privateDecrypt(RSA_NO_PADDING)` under n1. Whenever the blinded value lands numerically >= n1, OpenSSL throws `error:02000084:rsa routines::data too large for modulus`. Measured probability ~12.5% per run (40-trial standalone proof, scratchpad `blind-modulus-proof.mjs`); it depends on which random modulus is larger, so most runs pass.
4. The throw rejects the fake fetch; `runIssuance` caught it and returned `{ ok: false, reason: 'unreachable' }` WITHOUT clearing `PENDING_MINT_KEY` (only the 403, echo-mismatch, and finalize paths cleared it). The test's `expect(store.get(PENDING_MINT_KEY)).toBeNull()` at line 347 then failed with the pending-mint JSON.

The "full runs only" observation was small-sample coincidence (3 isolated passes at ~12% failure probability is a 68% outcome). The mobile twin test never flakes because it blinds under the correct issuer key and only mismatches the response echo.

## 3. Latent PRODUCTION defect found by the same investigation

`AccountService.issueLocked` (packages/meerkat-relay/src/account-service.ts) shape-validated the blinded message by base64 length only. A client-shaped 256-byte value >= the epoch modulus reached `blindSignCredential` and threw the same OpenSSL error, contradicting the "cannot throw for client-shaped input" comment, AND it threw AFTER `recordIssuance`, so the account's one-per-epoch quota slot was burned with no credential issued. An honest client hit by an epoch-key rotation race (blinding under a just-rotated key) could permanently lose its epoch mint; the echo cross-check designed for that race never got to run. Proven by a failing test before the fix.

## 4. Fixes (branch fix/meerkat-account-mint-intermittent)

1. **Server** (`account-service.ts` issueLocked): ensure the epoch key and range-check the blinded value against the epoch modulus BEFORE the quota insert; out-of-range is `bad_request` exactly like other malformed input, and `not_configured` (key ensure failure) no longer burns the slot either. Content-determined for the session holder, so no eligibility side channel opens. Stale header comment ("quota insert happens FIRST in every path") corrected.
2. **Both client twins** (`apps/meerkat-web/src/lib/account.ts`, `apps/meerkat/app/(root)/data/account-core.ts` runIssuance): every issuance failure exit now discards pending-mint state via a best-effort `discardPendingMint` (fetch throw, unparseable body, non-ok body). Pending state has no resume path, so a failed mint leaves no blinding material behind.
3. **Web test determinized, two rounds**: the first attempt rejection-sampled a foreign key smaller than the fixed module-level issuer key (32 attempts). That is itself probabilistic: when the issuer modulus lands near the bottom of the RSA-2048 range no bounded attempt count is guaranteed to find a smaller one, and a post-fix verification loop caught exactly that throw on run 25 (expected failure rate is 1/(N+1) per call). Final fix is deterministic BY CONSTRUCTION (`orderedMismatchedKeys`): generate one fresh pair, serve the smaller modulus from the discovery route and have the fake service sign (and echo) with the larger, so the blinded value is always in range. The fake service also now mirrors the fixed real wire contract by range-checking the blinded message and answering 400 bad_request instead of ever letting the raw RSA op throw.

## New behavioral tests (all mutation-checked)

| Test | Mutation that proves it |
|------|------------------------|
| relay: out-of-range blinded message is bad_request, never throws, quota not burned | disable the range check -> throws `data too large for modulus` |
| web: network failure on issue POST is unreachable + no pending state | remove discardPendingMint from the fetch catch -> fails |
| web: wrong-key response without publicKey echo fails closed via finalize-verify + no pending state | skip finalize's verifyBlindCredential -> fails |
| mobile: network failure on issue POST is unreachable + no pending state | remove discardPendingMint from the fetch catch -> fails |

## Verification (final battery on the branch)

- sync 2498 green, relay 1588 green (+1 new), app 1493 green (+1 new), web 1040 green (+2 net new; the flaky test reworked in place).
- check-meerkat-parity green (incl. plan 53 block), check:meerkat-transport-nc green (incl. NC-53.1), gate:function:changed green.
- Full meerkat-web suite repeated 3x green (the original failure mode was full-run visible).
- Isolated account.test.ts determinism loop: 40 consecutive green runs after the ordered-keys rework (pre-fix baseline failed on run 24/30; the round-one rework failed on run 25/60 with the rejection-sampling throw).

## Remaining / notes

- rc17 cut still blocked on founder billing fix (step 1). This fix lands as a NEW SHA after rc17 per freeze rules (rc17 stays bound to `cad7db07`).
- The contested-derived-id diagnostics recommendation and other OPEN ledger rows are unchanged.
