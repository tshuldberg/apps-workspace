# 2026-07-06: Meerkat Launch-Completion Wave (evaluate -> codex review -> 3-agent build)

## What was done
Founder pipeline request: evaluate the open Meerkat plans for accuracy, adversarially review with codex, then develop with a team of max 3 agents and complete the codeable items.

### Stage 1: plan accuracy evaluation (3 read-only agents)
- Plan 23 delta STALE on two items (Noise D.6 + EAS projectId already done; W2 channel-creation fixed by Plan 38); plans 27/29 deltas accurate; plans 25 (calls, 12-16 sessions) and 26 (public participation, upstream-blocked) confirmed spec-only, no small slice - reported, not built.
- Plan 22 founder gate RESOLVED by the 2026-07-05 pricing lock; Phase 0 codeable. Plan body has 3 passages contradicting the two-price lock (reprice line 71, metered overage line 369, yearly SKU) - still to strike (docs pass), yearly SKU needs founder confirmation.
- Sprint-audit punch list: 4/5 confirmed unfixed; ChatProvider send-state REFUTED (message durably recorded locally, park explicitly best-effort). dataTransportFactories confirmed never injected. W1 == Plan 23 D.1.

### Stage 2: codex adversarial review (gpt-5.5, high)
9 P1 + 3 P2 amendments folded, notably: humanity enforcement must live IN the public-join payload (park path bypasses HTTP middleware); channel gate must verify the SIGNED author; redeem needs atomic trySpend; gossip must be real session message types; AM5 transport factories = engine-level work, not a one-liner.

### Stage 3: 3-agent build (dev-sync / dev-apps / dev-relay), landed as 3 commits
- `410634d4` feat(sync): shared roster reconcile (gossiped removals close removed_at), signed-author cm_messages inbound validator on device-scoped sessions (+ v1-cannot-smuggle-v2 fix from codex self-review), transactional dm-group apply, recovery-restore helpers, GOSSIP session message type (opt-in), REQUIRED humanityToken in PublicJoinRequestPayload, NUL-byte cleanup in public-join.ts. AM5 engine half correctly reported week-sized and NOT half-built (Wave 2).
- `3397651b` feat(meerkat-relay,billing): atomic trySpend + durable FileHumanityStore (O_EXCL; deliberate divergence from SqliteHumanityStore - node:sqlite experimental), deployable verification service (bin + Dockerfile, fail-closed boot), requireHumanityToken on /public/register (capped-body-first per AM9), atomicWriteFile for descriptor revisions, meerkat_app_unlock $4.99 + deriveMeerkatAppUnlock + price locks.
- `62aa86a9` feat(meerkat): Metro/EAS blocker FIXED + verified with a real successful expo export (second blocker found: expo-router bundling sibling *.test.ts - metro blockList); auto-connect P2-P3 (one composed foreground round: drain + session sync + gossip); Plan 27 P4 policy UI + web policy-history twin; Plan 24 P4/P5 humanity wallet/VerifySheet with owner-drain authoritative /humanity/redeem single-use spend (fail-closed both ends when unconfigured); Plan 23 recovery restore full flow both surfaces; loopback decode guard; op-count perf gate; gossip send roster-scoped for privacy (founder privacy-first call made in-session after dev-sync surfaced the descriptor-roster leak).

### Final verify (whole tree)
sync 1713 / relay 364 / entitlements 71 / billing 5 / app 977 / web 660 tests green; 6 typechecks clean; Meerkat parity green.

## Incidents
- husky pre-commit gate stash machinery corrupted the multi-agent working tree repeatedly (conflict markers, 3 orphan pre-commit-gate stashes). Recovered from stash@{0}; landed with everything staged. errors_log row added (Mitigated). Stashes @{0}-@{2} verified-landed, left for manual drop.

## Launch-config recommendation (dev-relay, humanity-service owner)
Launch with the community-node PUBLIC REGISTER humanity gate OFF (its deploy default via MEERKAT_HUMANITY_REQUIRED; publications already pass owner-signing + archive moderation) and the public-join redeem gate ON (the real anti-sybil surface, wired now). Enabling the register gate later requires the x-mk-humanity publish header plus one wallet token per host (publish registers per-host in a loop; a single token would 401 hosts 2..N).

## Wave 2 (declared, next session)
Plan 23 UI set 16b-16f (D.1/W1 files Request, D.2 un-hide, D.3 attachment report id, D.5 sealed rendezvous, B.2 delete-my-data), Plan 29 P6 presence + P4 background graduation, AM5/15b transport-factory engine+app wiring, Plan 22 Part 1 IAP rails + plan-body contradiction strike (+ yearly-SKU founder question), x-mk-humanity header at the register call site + one-wallet-token-per-host (only if the register gate is enabled), web CORS on the verification service's 3 POST routes (relay-side, deploy-time), serializeHumanityToken wire-string in acquireHumanityToken when the service returns token objects (dark path today), per-session gossip scoping decision (currently engine-global; bounded no-op vs non-gossip peers).

## Founder-ops unchanged
Relay/node/verification-service deploys, humanity env keys (MEERKAT_HUMANITY_SERVICE_URL/_PUBLIC_KEY, VITE_ + Turnstile), device QA, store ops.
