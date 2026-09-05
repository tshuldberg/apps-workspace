# Meerkat Main Merge And Plan Audit - 2026-07-07

## Outcome

Local `main` now includes the Meerkat public base feed branch.

- Merge commit: `e876de3e` (`merge(meerkat): public base feed`)
- Source branch tip: `d1722d3c` (`feature/meerkat-public-base-feed`)
- Push status: not pushed. `main` is `0 58` against `origin/main`, meaning 58 local commits ahead and no remote commits missing.
- Meerkat branch tips: all committed Meerkat branch tips are merged into local `main`.
- Remaining unmerged branch tips: `feature/mylife-improvements-sprints` and `feature/phone-web-daily-driver`, both non-Meerkat.

One separate Meerkat worktree is still dirty: `.claude/worktrees/track-c-consumer` has staged copies of `apps/meerkat-web/src/lib/public-report.ts`, its test, and `scripts/check-meerkat-parity.mjs`. Compared against merged `main`, those staged files are older/regressive residue from the public-report work, not unique unfinished implementation. I left that worktree untouched rather than reverting or force-dropping user or agent state.

## Merge Safety

Pre-merge verification on `feature/meerkat-public-base-feed` passed:

- `pnpm --filter @mylife/sync test`: 1802 tests passed
- `pnpm --filter @mylife/meerkat-relay test`: 574 tests passed
- `pnpm --filter @mylife/meerkat-app test`: 1075 tests passed
- `pnpm --filter @mylife/meerkat-web test`: 717 tests passed
- `pnpm --filter @mylife/entitlements test`: 77 tests passed
- `pnpm --filter @mylife/billing-config test`: 5 tests passed
- Typechecks passed for sync, relay, app, web, entitlements, and billing-config
- `pnpm check:meerkat-parity` passed
- `pnpm check:generated-artifacts` passed
- `pnpm gate:function:changed` found no uncommitted source changes on the feature branch

Merge verification on local `main` passed:

- Normal pre-commit hook completed after installing the merged dependencies in the separate main worktree
- Staged function gate passed during commit:
  - Meerkat app: 21 files, 248 tests
  - Meerkat web: 17 files, 127 tests
  - Billing config: 3 tests
  - Entitlements: 13 tests
  - Meerkat relay: 26 files, 242 tests
  - Sync: 18 files, 193 tests
  - Consumer typechecks: `@mylife/mobile`, `@mylife/web`
- Post-merge `pnpm check:meerkat-parity` passed
- Post-merge `pnpm check:generated-artifacts` passed
- Post-merge `pnpm check:parity --quiet` passed

Merge friction:

- `memory.md` and `errors_log.md` had expected ledger conflicts and were union-resolved.
- The first commit attempt failed because the separate main worktree needed `pnpm install --frozen-lockfile` for newly merged dependencies.
- A hook-created stash restore left a mode-only conflict on `packages/meerkat-relay/bin/meerkat-persona-service.mjs`. The file content was identical on both sides; the executable bit was preserved and staged.
- Both real workflow failures were recorded in `errors_log.md`.
- Hook-created stash `stash@{0}: On main: pre-commit-gate-89132-1783433390-183` remains for audit.

## Plan Audit

This was checked against actual files and code search, not only against plan text.

| Plan | Actual state | Remaining work |
|------|--------------|----------------|
| 39 public base feed | Codeable P0-P14 complete and merged. Public persona, alias registry, verify-to-view, Commons feed, composer, threads, profiles, topics, Explore, operator console, legal queues, GDPR delete, red-team tests, and parity guards are present. | P15 founder-ops only: deploy persona/session services, production secrets, Commons provisioning, Turnstile/App Attest/Play Integrity, NCMEC vendor, DMCA agent, CSAM hash DB, store UGC flags/copy. |
| 25 calls and rooms | Incomplete codeable plan. Code search found no real call-signal, room membership, media session, SFU, or call routes. | Build the calls/rooms stack if still wanted. |
| 26 open public participation | Superseded by Plan 39 for public posting, policies, base feed, and verified public access. | Same founder-ops as Plan 39 unless a separate Plan 26 scope is redefined. |
| 37 launch completion mission control | Umbrella/stale orchestration doc. Work landed through Plan 39 and launch-completion waves. | No direct feature gap by itself. Use current code and newer plan logs. |
| 19 public social layer | Code-complete for public join/request/grant/redeem, `cm_publications`, public reader, public directory/node, and abuse rails. | Founder-ops and public infrastructure validation. Plan 39 supersedes some public/anonymous distinctions. |
| 20 connectivity and self-hosting | Code-complete for repo scope: effective relay URL, connection cards, share intake, WebRTC/Nearby/BLE backends, app config deps, and parity checks. | Install/dev/EAS/device QA, App Group provisioning, relay/community-node/public-directory deploy, desktop companion builds, two-device QA. |
| 21 direct messages | App/web DMs are code-complete for core messaging, groups, receipts, shred, attachments, own-device mirror, and tests. | Cross-device link-device UI for same-account own-device pairing was not found. Live relay and device QA remain founder-ops. |
| 22 monetization and billing | Plan text is stale. Code now includes founder-locked prices, RevenueCat mobile unlock, Stripe web unlock, hosted service, hosted API usage/entitlements, cross-rail link code, storage ingest, storage upload route, server-side cap, and `meerkat:hosted-storage`. | Real store, Stripe, receipt, provider config, and device/store approval. Reconcile stale plan checkboxes if the plan docs must be current. |
| 23 launch readiness | Several stale unchecked items are implemented: recovery restore, reviewed-still-hidden fixes, sealed rendezvous, delete-my-data, and real EAS project id. | Store/legal bundle, brand/icon assets, store submission, and possibly D.7 standalone Downloads browser screen. Device/store approval remains founder-ops. |
| 24 humanity verification | Service, HTTP routes, Turnstile/attestation verifiers, route guard, mobile/web core, VerifySheet, and humanity headers/gates are present. | Production keys/service deployment. If blind-RSA scoping remains mandatory, current code uses signed opaque tokens rather than full scoped blind-RSA. |
| 27 community transport policies | Code has signed community transport policy, owner picker on both surfaces, observed-member notice/history, session gossip, and enforcement in drains, joins, and native auto-connect. | Device QA for real transports. Plan file status is stale. |
| 29 seamless auto-connect | Foreground auto-connect, shared core, mobile/web AutoConnectCard, native integration, presence opt-in/beacons, and background drain hooks exist. | Closed-app scheduled sync is still best-effort/dev-build/default-off, not guaranteed OS-level background sync. Device QA remains. |

## Bottom Line

The committed Meerkat public base feed work is safely merged into local `main` and verified. The only truly incomplete codeable Meerkat plan I found is Plan 25 calls and rooms. Several queue plan files are stale and should not be treated as authoritative without reconciling them against the code.
