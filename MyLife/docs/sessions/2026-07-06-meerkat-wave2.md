# 2026-07-06: Meerkat Wave 2 (Plan 23 UI set, presence, IAP rails, native transports)

## What was done
Founder: "walk me through any decisions then proceed." Decisions made and executed, then Wave 2 built by 3 agents and landed as `7722be7d` (+ `09990cf8` Plan 22 override).

## Decisions
1. Yearly SKU: STRUCK. Binding pricing-lock override added at the top of Plan 22 superseding every reprice/yearly/metered-SKU reference (exactly two prices stand). Annual billing would need a new explicit founder decision.
2. Pre-commit stashes: all 3 verified (stash@{0} byte-identical to HEAD on code; @{1}/@{2} superseded intermediates) and dropped. Unrelated wave0-ledgers stash untouched.
3. Gossip scoping: keep engine-global (roster filter makes extra gossip privacy-safe; scoping = complexity, no gain).
4. Launch config confirmed: public-join redeem gate ON, register gate OFF.
5. Mid-wave: presence opt-in must be PER-COMMUNITY (Plan 29 lines 28/279/322 + no-reduced-slice mandate) - reworked in-wave; AM5 app-side wiring assigned to w2-apps when flagged unclaimed.

## Built (3 agents, each codex-self-reviewed; all findings fixed)
- w2-sync: presence-beacon protocol (signed, sealed, relay-blind, roster-validated, fail-closed red-team x21 + drain dispatch route) + AM5 engine transport factories (policy-filtered local-first native dial in runAutoConnectJob; codex caught a per-layer policy bypass, fixed) + serialize export confirm.
- w2-apps: Plan 23 D.1 (files Request wired live, web button added), D.2 (reviewed-un-hide bug, test-first; closes the 2026-07-04 P3 row), D.3 (canonical report target + legacy reconciliation), D.5 (sealed rendezvous, extended friend-code, no plaintext downgrade), B.2 (delete-my-data incl. pairwise secrets + blob store); per-community presence UI both surfaces; P4 background graduation (SDK54-correct expo deps fixed by lead at install); AM5 app wiring (honest failure rows, web relay-only); serializeHumanityToken fix; D.4 verified covered by Plan 32. Codex x5 findings fixed (plaintext downgrade, secrets left behind, bare-code publish, id-collision un-hide, unvalidated secretHalf).
- w2-billing: mobile RevenueCat rail (app-unlock.ts + upgrade.tsx, price from billing-config, fail-closed w/o RC key), web Stripe rail + link-code cross-rail (server-validated), hosted-billing service (HMAC webhooks, durable O_EXCL link store, Ed25519 authorize, fail-closed receipt validator, bin + Dockerfile.hosted), verification-service CORS. Codex x2 fixed (webhook misclassification, cache-as-authority).

## Verification (whole merged tree)
sync 1758 / relay 384 / entitlements 71 / billing 5 / app 1007 / web 676 tests green; 6 typechecks clean; Meerkat parity green (new locks for every item). pnpm install fixed agent-guessed expo versions to SDK54 bundled versions (expo-notifications ~0.32.16, task-manager ~14.0.9, background-task ~1.0.10, battery ~10.0.8).

## Remaining (founder-ops + next wave)
- Founder-ops: relay/node/verification-service/hosted-billing-service deploys + env keys (RC keys, Stripe, MEERKAT_HUMANITY_*), dev builds (`npx expo install --fix` recommended before EAS), 2-device QA, store products, tile hosting.
- Next-wave code candidates: Plan 27 P5 + Plan 29 P5 red-team/QA passes, publish x-mk-humanity header + token-per-host (only if register gate enabled), Plans 25 (calls) and 26 (public participation) as their own multi-week programs, Plan 23 founder-ops-only items (icons, store metadata, device QA).
