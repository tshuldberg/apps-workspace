# Meerkat Plan 27: community transport policies P0-P2 + gossip restriction (2026-07-02)

Continuation of the launch-execution thread on `feature/meerkat-launch-finish`,
directly after Plan 28 went engine-complete (see
`2026-07-02-meerkat-plan21-phase6-review.md`). All TDD (test first, watched
fail), inline Fable. Four commits: `1943b084`, `fee9abac`, `c3cac33b`,
`783354cf`.

## P0 (`1943b084`) - the signed policy protocol

- `CommunityTransportPolicy = 'local_only' | 'local_preferred' | 'any'`, a
  descriptor axis explicitly distinct from `SyncTier` (NC-4).
- Optional `transportPolicy` on `CommunityDescriptor`, appended to the
  canonical SIGNED tuple at a stable tail position (like `historyScope`):
  tampering breaks the owner signature; absent === explicit `any` canonically,
  so legacy descriptors stay verifiable and grandfathered (AC-6).
- `communityTransportPolicy()` is the only reader: absent -> `any`, unknown or
  malformed -> `local_only` (a promise field never fails open).
- `revisePolicy()` owner-only signed change; monotonic upsert + gossip guards
  make rollback to an older relaxed revision impossible (AC-3 protocol half).
- `transportPolicyAllows()` + `transportAllowedForCommunity()` (the Plan 29
  seam): local_only -> {lan, nearby}; BLE never a data path (NC-2); unknown
  community fails closed. 11 tests.

## P1 (`fee9abac`) - THE GUARANTEE: row-level gates

Meerkat sessions are device-scoped (one connection carries every community's
rows), so the security boundary is the ROW, both directions independently:

- `inbound-policy.ts`: `transport_not_permitted` reason;
  `InboundSessionAuth.sessionTransport`;
  `InboundChangeFacts.communityTransportPolicy`, resolved by the caller from
  the ROW's `community_id`/`workspace_id` against the LOCALLY stored
  descriptor (never `options.workspaceId`, never peer input). Present policy +
  unknown transport fails CLOSED; BLE rejected by construction.
- Apply loop: session-cached community-policy resolver feeds the fact per
  change; rejections audited. The key-wrap branch re-checks explicitly off the
  PARSED `wrap.workspaceId`; a workspace with no local community descriptor
  (DM groups, not-yet-joined) carries no promise and passes -- group-DM epoch
  wraps keep flowing over relay (regression-tested).
- Outbound: `filterLwwSnapshotForScope` filters PER ROW (the relay never sees
  a local_only community's row sizes or timing); `coveredChangeIds` applies
  the same filter over change `dataJson`, so an undelivered row is never
  acked -- it stays unsynced until a permitted local session delivers it.
  Community deletes are signed cm_ row events, so the unattributable LWW
  tombstone map carries no community content (documented in code).
- 9 tests, including a two-leg duplex device-scoped session fixture: over
  `wan_relay` ZERO local_only rows cross in either direction (and no inbound
  audit rows -- outbound did the work), the `any` community's rows flow, key
  wraps split correctly; the SAME fixture over `lan` moves everything.
  Fixture notes: sessions are initiator-push (two legs = duplex) and the D.6
  Noise leg needs the peer's REAL DH key in the paired record.

## P2 (`c3cac33b`) - dial cap + relay-token skip

- `TransportDialOptions.forbiddenLayerIds`: a HARD cap enforced INSIDE
  `_tryConnectViaLayer` (no preferred/fallback ladder combination can
  re-append a forbidden WAN rung) and inside `connectToPeerViaRelay` (the
  token bypass throws); an existing connection on a forbidden layer is never
  reused. `forbiddenLayerIdsForPolicy('local_only')` -> [4, 5].
- Tests pin `syncTier: 'free_cloud'` with passing relay controls so the
  SUBSCRIPTION tier axis is provably not what blocks (NC-4); the cap blocks an
  otherwise-SUCCEEDING simulated relay dial.
- Relay-token skip (AC-2): all three drain-token builders (mobile foreground
  `resolveJoinExtraTokens`, mobile background `buildExtraTokens`, web twin)
  skip EVERY relay mailbox token of a community whose policy forbids
  `wan_relay` -- even the opaque rendezvous token is metadata. Gated through
  the `transportAllowedForCommunity` seam; 3 parity guards lock the twins.

## Gossip metadata restriction (`783354cf`)

`collectDescriptorRecords(db, transport?)` excludes local_only communities on
a forbidden transport (their descriptor is metadata the policy covers);
`applyGossipedDescriptors(..., transport?)` symmetrically drops records whose
LOCALLY stored policy forbids the arriving transport (a hardening revision
still applies over a permitted transport). `gossipDescriptors` threads the
connection's transport into both sides. Legacy no-transport callers unchanged.

## Verification

`@mylife/sync` 1522 / meerkat app 367 / meerkat-web 187 / relay 325, all four
typechecks, Meerkat parity (incl. 3 new Plan 27 guards + 13 Plan 28 guards),
husky function gate on every commit.

## Remaining (Plan 27)

- P3: local join handoff -- deliver the sealed join-grant envelope over an
  ESTABLISHED local TransportConnection instead of the relay (a self-framed
  local-mailbox exchange feeding the SAME applyMailboxEnvelope dispatcher),
  plus the app invite-flow branch, so joining a local_only community genuinely
  requires co-presence (AC-4).
- P4: policy-change UX -- wire gossipDescriptors/gossipRevocations into a real
  session step (NO production caller exists yet; possibly Plan 29's
  auto-connect loop), `cm_policy_history` (device_local, explicit sync-policy
  rule per the C1 fail-closed convention), member change notice, community
  settings "Sync policy" row, owner picker at create + revise, both surfaces +
  parity guards, honest copy ("This community only updates in person or on a
  shared network").
- P5: red-team (forged relaxed descriptor, replayed old descriptor, local_only
  row smuggled inside a WAN batch -- partially covered by the P1 suite; BLE
  never carries data by construction), CLAUDE.md mesh-sync + honesty sections,
  `/qa`, AC-5 local_preferred dial-order labeling, AC-7 Plan 29 integration
  test.
