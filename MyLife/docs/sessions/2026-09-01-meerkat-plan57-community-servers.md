# 2026-09-01 - Meerkat Plan 57: Community Servers (Realms pattern), W1-W4 execution

## What

Executed the core of Plan 57 (`docs/plans/queue/57-meerkat-community-servers.md`, authored this session from the 2026-08-31 research report) on branch `worktree-meerkat-community-servers` (worktree, per the concurrent-session rule). Three commits:

1. **`d31fc372` W1, writer clients in `@mylife/sync`:** `publishCommunityFeed` (owner descriptor + rolling snapshots in the exact `decodePublishBody` wire shape) and `appendCommunityTail` (seal one authored event with the epoch content key, outer-sign as a `SealedTailEntry`). Optional hosted-entitlement bearer threaded through every node client including `pullCommunityFeed`, `republishCommunityDescriptor`, and the piece fetches (the gate runs on `/challenge` too). Five real-HTTP e2e tests against the real `CommunityNode`.
2. **`06c4da0a` W2/W3, host lifecycle + wiring (both surfaces, verbatim twins):** `setCommunityHost` (attach only after a real `/healthz` answer AND an accepted owner publish; fail-closed, node reasons verbatim), `clearCommunityHost` (signed community exit, committed locally first so a dead server cannot block its firing), `appendEventToCommunityHost` + `publishCommunitySnapshotsToHost` + throttled wrappers, `mirrorEventToCommunityHost` wired into the one mobile mailbox choke point and all six web send sites, `maybeRefreshCommunityFeedFromHost` on channel-screen open (this made the never-called `refreshCommunityFeed` live), owner-only "Community server" settings section with the honest C5 state copy on both surfaces. 13+13 twin tests over a wire-accurate fake node with real sealed-tail verification.
3. **`8e474012` W4, durable join queue:** `community-join-queue.ts` on the node (opaque envelope boxes keyed by the existing HKDF join tokens; memory + atomic file stores under `DATA_DIR/joins`; TTL clamped 1h-30d, per-box/per-community caps, typed refusals; non-consuming reads + explicit acks; accepted parks emit the community's content-free notify ping via a new public `notifyCommunityChange`). Routes `join/park`, `join/box/{token}`, `join/ack` (entitlement-gated + per-IP limited). Sync client (`join-queue-client.ts`) incl. `drainJoinBoxFromNode` over the SAME `applyMailboxEnvelope` dispatch as the relay drain. Both providers park join requests host-first straight from the invite's descriptor and drain host boxes before the relay short-circuit, so joining a hosted community works with no relay configured. Relay e2e proves the full handshake across a node RESTART ending with the joiner holding a real epoch key.

## Why

Founder: "I want to do the above. Begin" on the 2026-08-31 community-server report. The always-on community node existed but was orphaned; this wires it end to end per the Realms pattern (only the creator ever sees a server decision; everyone else follows the invite).

## Honesty and security invariants kept

- No epoch keys or plaintext on any server; the join queue stores only opaque sealed envelopes under HKDF tokens (relay-mailbox trust model, durable).
- Attach commits ONLY after the node accepted the exact revision; removal never blocked by a dead server; every UI state from the C5 table is real (live `/healthz` probes, no online counts).
- Send-path mirroring is fire-and-forget; the local record + session replication stay the source of truth; `applied` counts come from the engine.
- Transport policy respected: `local_only` communities never park on or drain from a WAN host.

## Verification

- Full suites green after each commit: `@mylife/sync` 2624, `@mylife/meerkat-relay` 1620 (+8 new e2e), meerkat app 1815 (165 files), meerkat-web 1230 (151 files), `check-meerkat-parity` PASS, hub consumer typechecks PASS, lint clean (pre-existing warnings only), pre-commit gate green on all three commits.
- Codex independent review run on the full branch diff (results appended below when complete).

## Explicitly not shipped (documented in the plan, not silent)

- **Admin grant-minting (W4 item 3):** unsound on the current protocol; `reviseCommunity` is owner-signature-only, so an admin cannot produce the signed roster revision a grant needs. Needs an owner-countersigned delegation certificate primitive; follow-up plan.
- **W3 "Meerkat Keeper" one-tap hosted provisioning UI:** the entitlement seam is threaded everywhere, but the one-tap purchase/provision flow needs the deployed hosted-api + Stripe live keys (founder-ops W5 first). Self-host attach ships now.
- **W5 fleet deploy + announce cron:** founder-ops (Plan 44 evidence list).
- W6 onboarding polish (rules screening, first-task guide), W7 directory, W8 instant-join links: next plan waves per the report.

## Files

New: `packages/meerkat-relay/src/community-join-queue.ts`, `packages/meerkat-relay/src/__tests__/community-{node-writers,join-queue}-e2e.test.ts`, `packages/sync/src/node/join-queue-client.ts`, `apps/meerkat/app/(root)/components/CommunityServerSection.tsx` (+ web twin), twin `community-host-lifecycle.test.ts` files, `docs/plans/queue/57-meerkat-community-servers.md`.
Modified: `feed-node-client.ts`, sync node barrel, `community-node{,-http}.ts`, `meerkat-community-node.mjs`, relay barrel, `community-core.ts` + `meerkat-data.ts`, both providers, both community settings screens, both channel screens.

## Independent review round (codex, full branch diff)

Codex review surfaced 13 findings; every confirmed one was fixed in `0237e336` (compaction-safety pull-before-publish, prior-epoch tail recovery via candidate keys, tail-only channel delivery, owner roster republish after served joins, join-park token-exhaustion defense with an authenticated grant lane, ackRejected:false for owner request boxes, entitlement threading through every web host operation, the three-state honest hosting probe replacing the healthz-only "always available" claim, all 8 web-authored event kinds mirrored incl. edits/deletes, typed network failures in the writers, NUL-byte escape in the join-queue source). Full suites re-green after the wave (sync 2624, relay 1622, app 1815, web 1230, parity PASS). Two findings intentionally not adopted as stated:

- **Admin delegated grants:** still requires the owner-countersigned delegation primitive (see the plan's Phase 4 note); a quick version would break roster monotonicity guarantees.
- **"Ack only after durable grant":** softened to ackRejected:false plus the authenticated durable grant lane; a relay-delivered grant remains an accepted (existing) rail rather than a failure.

## Design work (same session, founder-directed)

- Ten community/creator page archetypes as a reviewable HTML with a switcher (`apps/meerkat/docs/reports/REPORT-meerkat-community-page-archetypes-2026-09-01.html`, commits `da1a87ee`, `7c923dcb`, `0fbc321c`): six community pages + the creator-platform set (Membership with fully creator-defined tiers incl. cadence toggle and one-time-forever; Personal Site; Storefront with sealed-grant delivery) + the Meerkat editor mock (per-block audiences, open-web publish toggle). All screenshot-verified, honest footers on every mock.
- **Plan 58 authored** (`docs/plans/queue/58-meerkat-editor-creator-rails.md`): tier schema (any count/price/cadence, one-time allowed), claim-code checkout handshake over the Plan 57 durable queue, sealed-grant digital goods, per-block layout audiences, open-web renderer on the community node, delegated billing agent gated on the delegation-certificate design review, template gallery absorbing Plan 57 W6. Positions locked: membership = key possession, Meerkat 0% and never touches payments, mature content behind the 18+ gate, irrevocable digital delivery.

## Merge state

Branch `worktree-meerkat-community-servers` in `.claude/worktrees/meerkat-community-servers`, 3 commits ahead of origin/main, all gates green. NOT merged to main this session: main is being actively moved by a concurrent session (FlashCards/branch-closure commits landed mid-session), so the merge should happen from a quiet checkout per the worktree rule.
