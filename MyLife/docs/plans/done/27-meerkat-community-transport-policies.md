# Feature Spec: Community Transport Policies + Proximity-Gated Communities

> Meerkat launch plan 27. Every community gets an owner-signed transport policy ladder:
> `local_only` / `local_preferred` / `any`. A `local_only` community is a proximity-gated
> space: its rows, key wraps, and join handoffs move ONLY over local transports (LAN
> Wi-Fi, Nearby peer; BLE remains wake-signal only), enforced fail-closed at the engine
> row level, so members must actually meet in person or share a network for the community
> to update. Relaxing the policy requires an owner-signed descriptor revision visible to
> members. Founder decision 2026-07-01: both hard mode and the configurable ladder.

## Reconciliation Status (2026-07-07)

Status: Done for codeable repository scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). Verified anchors include signed `transportPolicy`,
row-level inbound/outbound/key-wrap gates, `transport_not_permitted` audit rows,
hard `forbiddenLayerIds`, relay-token skip, local join handoff, `cm_policy_history`,
mobile/web policy pickers, production descriptor gossip wiring, auto-connect policy
consultation, and parity locks. Device proximity QA remains part of Plan 23 founder-ops.

## Status (2026-07-02)

P0-P2 BUILT + the gossip metadata restriction, TDD, committed on
`feature/meerkat-launch-finish`: P0 (`1943b084`) signed transportPolicy field +
fail-restrictive reader + revisePolicy + the transportAllowedForCommunity seam;
P1 (`fee9abac`) THE GUARANTEE -- row-level gates both directions
(transport_not_permitted in inbound-policy keyed by the ROW's community, the
key-wrap branch gate that spares DM-group wraps, the per-row outbound snapshot
filter + honest coveredChangeIds), proven by a two-leg duplex session fixture
(zero local_only rows over wan_relay, everything over lan); P2 (`c3cac33b`)
forbiddenLayerIds hard cap inside both dial paths + the local_only relay-token
skip in all three drain-token builders (AC-2) + parity guards; plus
(`783354cf`) descriptor gossip itself honoring the policy (collect + apply,
symmetric fail-closed). AC-1/2/6 and NC-2/3/4/5 engine-proven; AC-3 protocol
half proven (rollback via store + gossip). REMAINING: P3 (local join handoff
over an established local connection + invite-flow branch), P4 (policy-change
UX: gossip session wiring, cm_policy_history, member notice, settings row,
owner picker -- both surfaces + parity), P5 (red-team + docs + /qa). Note for
P4: gossipDescriptors/gossipRevocations still have NO production session
caller; wiring them is part of P4 (or Plan 29's auto-connect loop).

## Metadata

- **Surfaces:** `packages/sync`, `apps/meerkat`, `apps/meerkat-web`,
  `scripts/check-meerkat-parity.mjs`
- **Priority Score:** 43 / 50 (A-Tier). Unique differentiator (no mainstream competitor
  has in-person-gated communities) and a load-bearing privacy promise: once promised, it
  must be a protocol property, not UI copy.
- **Estimated CC Time:** 6-8 focused sessions.
- **Depends On (hard):** Plan 28 P1 (`descriptor-gossip.ts`): policy revisions must reach
  already-joined members; Plan 28 builds the shared primitive first. If this plan runs
  first for any reason, build `descriptor-gossip.ts` here per Plan 28's spec and Plan 28
  consumes it (the two specs define the identical module).
- **Blocks / feeds into:** Plan 29 (auto-connect consults this policy before every
  community dial; the `transportPolicyAllows` seam is defined in Plan 29 and implemented
  for real here).
- **Build order:** after Plan 28; before or parallel with Plan 29.

---

## The architecture fact that shapes everything (verified 2026-07-01)

**Meerkat sessions are device-scoped, not community-scoped.** The RN engine
(`sync-engine.native.ts:157-203`) never sets `workspaceId`; `SyncProvider.tsx:376`
builds ONE engine with a single shared `community` module (prefix `cm_`) carrying rows
for EVERY joined community on the same connection, distinguished only by each row's
`community_id` column. Therefore:

1. A dial-time or accept-time gate is NOT sufficient and is NOT the security boundary.
2. The hard guarantee lives at the ROW level: outbound, never put a `local_only`
   community's rows on a non-local wire; inbound, reject any such row arriving over a
   non-local wire. Both sides fail closed independently.
3. Dial-time gating is still built as defense-in-depth and UX (do not even attempt WAN
   when only local-only data is pending), but a mixed-policy device keeps using WAN
   sessions for its `any` communities; the row filter is what protects the local-only one.
4. Every `TransportConnection` knows its transport at construction, before handshake
   (`lan-peer-connection.ts:85`, `nearby-transport.ts:389`, `relay-peer-connection.ts:45`,
   `webrtc-transport.ts:895,919`), flowing into `options.transport`, so the row gates
   always have the transport fact available.

## Current-State Grounding

| Fact | Anchor |
|------|--------|
| Transport union `'lan'|'nearby'|'ble'|'wan_webrtc'|'wan_relay'`; layer ids are bare numbers 1-5 (no branded type exists) | `packages/sync/src/types.ts:295`; `transport-manager.ts:132-145` |
| BLE is wake-only, moves zero bytes | `transport-manager.ts:82` `DATA_TRANSPORT_LAYER_IDS` excludes 3 |
| Inbound apply loop + per-row community context | `sync-session.ts:527-682` `applyReceivedDocumentChanges`; channel gate precedent at `:596-613` |
| Key-wrap branch that BYPASSES the row gate today | `sync-session.ts:618-637` (`SYNC_WORKSPACE_KEYS_TABLE` -> `storeReceivedKeyWrap`), keyed by `wrap.workspaceId` (== communityId) |
| Outbound scope filter to mirror | `sync-session.ts:444-489` `canSendTableAtScope`/`filterLwwSnapshotForScope`; coveredChangeIds at `:1691-1694` |
| Pure inbound policy module (extend, keep pure) | `packages/sync/src/protocol/inbound-policy.ts:22-160` |
| Ladder walk + relay bypass path that must both honor a hard cap | `transport-manager.ts:296-337` `connectToPeer`, `:347-368` `connectToPeerViaRelay`, `:84-109` `buildTransportLayerDialOrder` (beware `fallbackToDefaultLadder:true` re-appends WAN) |
| Signed descriptor + canonical tuple + owner-only revise + monotonic upsert | `community.ts:67-133,212-233,561` |
| Join handoff parkEnvelope is RELAY-ONLY today (gap for local-only joins) | `join-handoff-core.ts:165-169`; only impls `public-join-client.ts:39`, `background-sync.ts:253-269` |
| Background job mints relay mailbox tokens per community | `background-sync.ts:310-328` `buildExtraTokens` |
| Audit table ready for a new reason | `sync_inbound_audit` (schema.ts:412+) |
| Naming trap: `SyncTier.local_only` is a SUBSCRIPTION tier, different axis | `transport-manager.ts:457-477` |

---

## Design (locked)

1. **Policy type:** `CommunityTransportPolicy = 'local_only' | 'local_preferred' | 'any'`
   (named distinctly from `SyncTier`). Allowed transports: `local_only` -> {lan, nearby}
   (+ BLE wake signaling, which carries no data); `local_preferred` -> all, but dial
   order prefers local and the UI labels remote syncs; `any` -> all.
2. **Storage + signing:** new optional field `transportPolicy` on `CommunityDescriptor`,
   appended to `canonicalDescriptor()`'s signed tuple (stable position at the end, like
   `historyScope`). ABSENT on a legacy descriptor means `any` (grandfathered: those
   communities always synced over relay; no promise existed). An UNKNOWN/unparseable
   value fails restrictive to `local_only`. Changing the policy is `reviseCommunity`
   (owner-only, chained, monotonic); members can never be rolled back to an older
   relaxed revision (`upsertCommunity` guard).
3. **Propagation:** `descriptor-gossip.ts` (Plan 28 shared primitive) carries revisions
   to already-joined members. Gossip of a `local_only` community's descriptor is ITSELF
   restricted to local transports (the policy covers its own metadata).
4. **Policy change visibility:** at `upsertCommunity` call sites, compare
   `previous.transportPolicy !== next.transportPolicy`; write a `cm_policy_history`
   device-local row and surface an in-community notice ("Owner changed sync policy from
   In person only to Any connection on <date>").
5. **Enforcement points (all built; the first two are the guarantee):**
   - Inbound row gate: extend `InboundChangeFacts` with `communityTransportPolicy` and
     `InboundSessionAuth` with `sessionTransport`; new reject reason
     `transport_not_permitted` in `inbound-policy.ts` (checked right after the SAS gate);
     caller resolves the community from `change.data.community_id` (NOT
     `options.workspaceId`, which is always null on the Meerkat path) and writes
     rejections to `sync_inbound_audit`.
   - Key-wrap branch gate: the same check applied explicitly in the
     `SYNC_WORKSPACE_KEYS_TABLE` branch keyed off `wrap.workspaceId`.
   - Outbound row filter: sibling of `canSendTableAtScope` inside
     `filterLwwSnapshotForScope` + the `syncModule` coveredChangeIds computation: rows of
     a community whose policy forbids `options.transport` are never wire-visible (this
     also protects metadata: sizes/shapes/timing never reach the relay).
   - Dial-time defense-in-depth: first-class `forbiddenLayerIds` hard cap enforced
     INSIDE `_tryConnectViaLayer` AND `connectToPeerViaRelay` (never rely on callers
     combining `preferredLayerIds` + `fallbackToDefaultLadder:false`).
   - Background job gate: `buildExtraTokens` skips relay mailbox tokens for `local_only`
     communities; the opportunistic relay listen never carries their data (the row
     filter already guarantees this; the token skip avoids even the rendezvous
     metadata).
   - Local join handoff: new `parkEnvelope` implementation that delivers the sealed
     join-grant envelope over an ESTABLISHED local `TransportConnection` (LAN/nearby)
     instead of the relay, so joining a `local_only` community genuinely requires
     co-presence. The invite UI for such communities explains this ("Invite works when
     you are together on the same network").
6. **Reader for other plans:** `communityTransportPolicy(descriptor)` accessor next to
   `communityRole()`; `transportAllowedForCommunity(db, communityId, transport)` is the
   function Plan 29's `transportPolicyAllows` seam swaps in.
7. **Audit/UX:** `sync_inbound_audit` rows with `transport_not_permitted`; a per-community
   "Sync policy" row in community settings showing the policy, its meaning, and last
   policy change; honest copy everywhere ("This community only updates in person or on a
   shared network").

## Phases

- **P0 protocol:** descriptor field + canonical tuple + verify + `removeMemberRevision`
  sibling helper `revisePolicy` (owner-only) + accessors + tests (absent=any,
  unknown=local_only fail-restrictive, signature covers the field, rollback rejected).
- **P1 row gates (the guarantee):** inbound-policy extension + apply-loop wiring keyed by
  `community_id` + key-wrap branch + outbound filter + audit writes. Tests: a loopback
  RELAY session between two members of a local_only community moves ZERO of its rows in
  either direction (and the audit explains why) while an `any` community's rows on the
  SAME session flow normally; a LAN session moves both.
- **P2 dial + background gates:** `forbiddenLayerIds` in TransportManager (both dial
  paths) + `buildExtraTokens` skip + tests.
- **P3 local join handoff:** local `parkEnvelope` over an established local connection +
  invite flow branch + tests (join succeeds over LAN listener, fails with honest copy
  over relay-only connectivity).
- **P4 policy change UX:** gossip wiring (consume Plan 28's `descriptor-gossip.ts`),
  `cm_policy_history` (device_local, explicit sync-policy rule per the C1 fail-closed
  convention), member notice, community settings row, owner policy picker at create +
  revise. Both surfaces + parity guards.
- **P5 hardening:** red-team tests (forged relaxed descriptor rejected; replayed old
  descriptor rejected; a local_only row smuggled inside a WAN batch rejected + audited;
  BLE never carries data by construction); docs (CLAUDE.md mesh-sync + honesty
  sections); `/qa`.

## Acceptance Criteria

- AC-1: A `local_only` community between two devices updates over shared Wi-Fi or Nearby
  and NEVER over relay/WebRTC, verified at row level in both directions, regardless of
  what other communities share the session.
- AC-2: The relay never sees the community's row payloads, sizes, or mailbox rendezvous
  tokens (token-skip verified).
- AC-3: Owner relaxing the policy produces a signed revision; members see the change
  notice; rollback/replay to a relaxed older revision is impossible.
- AC-4: Joining a `local_only` community requires a local connection end-to-end.
- AC-5: `local_preferred` orders local first at dial time but syncs over WAN when local
  is unavailable, labeled honestly.
- AC-6: Legacy descriptors (absent field) behave exactly as today (`any`).
- AC-7: Plan 29's auto-dialer consults `transportAllowedForCommunity` for every
  community dial (integration test with the seam).

## Negative Criteria

- NC-1: Never enforce in UI copy only; every guarantee has an engine test.
- NC-2: Never treat BLE as a data path in policy language or code.
- NC-3: Never let per-user transport preferences (`sync_transport_preferences`) override
  a community's hard policy upward.
- NC-4: Never conflate `SyncTier` (subscription) with `CommunityTransportPolicy`.
- NC-5: No new crypto; signing rides the existing descriptor chain.

## Test Plan

Tier A: pure protocol + inbound-policy tests. Tier B: Node integration (mixed-policy
session over loopback relay + LAN backends from `lan-tcp-e2e.test.ts` patterns). Tier C:
app/vitest UI states + parity twins. Tier D (founder QA): 2 devices, real Wi-Fi + Nearby,
proximity community demo: update together, verify no drift apart over the internet, meet
again, converge.

## Founder-Ops

None new: dev build + 2 devices for Tier D (already in the runbook device-QA matrix).

## Status Delta (2026-07-05)

- P0-P2 built plus the gossip restriction (commits 1943b084, fee9abac, c3cac33b, 783354cf), verified in the 2026-07-04 production audit.
- P3 built under Plan 37 Wave 1: local join handoff runs over an established local connection, refuses relay/WebRTC/BLE where the descriptor policy forbids the carrier, and the mobile/web relay queue paths return honest `needs_local` handling instead of parking a forbidden relay request.
- P4 foundation started: mobile has `cm_policy_history` schema/helpers and web has the matching policy-history copy/formatter twin; `scripts/check-meerkat-parity.mjs` now locks the policy labels, meanings, and notice copy across mobile and web.
- Verified: `pnpm --filter @mylife/sync test -- session-token auto-connect-plan auto-connect-schema auto-connect-job local-join-handoff humanity-credential humanity-gate`, `pnpm --filter @mylife/meerkat-app test -- community-policy-history`, mobile/web typechecks, and `node scripts/check-meerkat-parity.mjs`.
- Remaining codeable: finish P4 production gossip caller, member notice, community settings row, owner create/revise picker on both surfaces, then P5 red-team/docs/qa.
- `gossipDescriptors`/`gossipRevocations` still have NO production caller (remaining P4 scope).
- Founder-ops: none new; Tier D device QA per the runbook matrix.
