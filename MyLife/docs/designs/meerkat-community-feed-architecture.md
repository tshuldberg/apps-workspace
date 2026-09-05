# Meerkat Community Feed - Architecture + Implementation Plan

Goal: let any community member open Meerkat in a browser from anywhere and see the
FULL community feed (all channels, full history, up to date), while the data stays
end-to-end encrypted and no host ever reads plaintext.

This is a design + phased implementation plan. It extends the existing Meerkat
substrate; it does not replace it. Crypto and protocol primitives come from
`@mylife/sync` unchanged wherever they already exist.

## 1. The honest problem statement

Today the web client only exchanges messages during a MANUAL relay session between
two devices that are both online at the same time. The relay is stateless and
forgets after 5 minutes. So there is no "place" a member can visit and just see the
feed. A true always-available feed needs something that holds the full history and
is reachable at any time, without that something being able to read the messages.

The tension to resolve: "available from anywhere" usually means "a server has it,"
and "a server has it" usually means "a server can read it." Meerkat resolves this
the way it resolves everything else: the host holds only ciphertext, and the keys
live with the members.

## 2. Locked decisions (from product direction)

1. HOSTING is decentralized, per community setting. The base layer is member
   seeding: every member's device holds its own timestamped copy of the community
   log and can serve ("fill in") any other member's missing history. A community MAY
   additionally designate an always-on community-owned node (a seeder someone in the
   community runs or rents) for reliable "from anywhere" access. There is NO founder
   cloud node. If no node and no peer is online, the feed is simply unreachable until
   one is, and the UI says so.
2. ACCESS CONTROL is per-member signed auth. A puller proves it holds a device key
   that is in the community's signed member list (and not removed) via a
   challenge-response signature. The host (a community node or a peer member) already
   legitimately knows the roster, so revealing membership to it is acceptable, and it
   buys instant revocation and per-member rate limiting. The host still never sees
   plaintext.
3. HISTORY SCOPE is owner-configurable, default FULL. Full history means new members
   can read everything from before they joined; the owner accepts that past authors'
   messages become readable by future members. Join-point-only is the
   cryptographically clean alternative (matches today's epoch exclusion).
4. LIVENESS is poll + notify, not a persistent live socket. A community admin sets a
   poll interval (Manual only / 1m / 5m / 10m / 15m / 30m / 1h / 6h / 24h / 1 week).
   Members poll the host on that interval, can tap Refresh anytime, and (if they have
   auto-update enabled) get woken by a host notify-on-post ping that triggers a pull.
   The UI always shows honest staleness ("Updated 3m ago"), never a fake "live".

## 3. What already exists (do not rebuild)

| Primitive | Status | Where |
|---|---|---|
| Zero-knowledge relay (transient forward + 5m TTL mailbox, opaque tokens) | works | `packages/meerkat-relay/src/hub.ts` |
| Host registry (HKDF rid + sealed records, announce/lookup, multi-announcer) | works | relay `protocol.ts` + `packages/sync/src/node/host-registry.ts` |
| Channel-history snapshot: signed (Ed25519) + encrypted (epoch content key, secretbox), wrapped in a ContentManifest with pieces/merkle/webSeeds; fetch+verify+decrypt fail-closed | works | `packages/sync/src/protocol/channel-history.ts` |
| Epoch group keys: MLS-shaped commits, per-member X25519 wraps, member add/remove with epoch advance (forward secrecy by exclusion), `deriveEpochContentKey` | works | `packages/sync/src/protocol/group-keys.ts` |
| Seeder node: content-agnostic, pins + serves hash-addressed encrypted pieces over HTTP web-seed (`GET /{infoHash}/{index}`), announces to registry | works | `packages/meerkat-relay/src/seeder-node.ts`, `seeder-http.ts` |
| Channel event log: signed append-only events, HLC order, edit/delete via supersede, CRDT-resolved | works | `packages/sync/src/protocol/channel-message.ts` |
| Browser persistence: sql.js + IndexedDB (rows), OPFS/IndexedDB (sealed blocks + blobs), WebCrypto/IndexedDB (secrets) | works | `apps/meerkat-web/src/lib/storage/*` |

Gaps this plan fills:
- Key wraps are NOT distributed today ("ride future gossip"); members cannot reliably
  obtain their epoch key. No full-history back-wrap.
- No automatic snapshot publishing (manual manifest paste only); no automatic host
  discovery for history.
- No persistent per-community store; the relay forgets.
- No membership auth to a host (relay is anonymous).
- No member-to-member history backfill protocol.
- No poll/notify liveness, no community poll-interval setting, no auto-update toggle.
- No browser feed view with durable cache + honest staleness.

## 4. Architecture

### 4.1 Components

- Member device (mobile or browser): holds its own timestamped copy of the
  community event log + the epoch keys it is entitled to. Source of truth is the set
  of signed events; the local DB is a materialized view. Can serve history to peers.
- Community node (optional, per community): an always-on `seeder-node` extended into
  "community mode": persists the community's rolling snapshots + live tail, serves
  them over HTTP web-seed, announces to the host registry, and gates pulls with
  per-member signed auth. Stores only ciphertext. Self-hostable; the community
  descriptor records its URL(s).
- Relay: unchanged zero-knowledge forwarder. Used for (a) member-to-member backfill
  sessions, (b) the notify-on-post ping, (c) host discovery via the registry.
- Browser client: the feed UI. Loads the cached full history instantly, polls the
  node/peers per the community interval, verifies + decrypts + merges, renders. Never
  claims a status it cannot prove.

### 4.2 Data: what is encrypted and how

The unit of truth is the signed `ChannelMessageEvent` (already author-signed). The
feed is the ordered, edit/delete-resolved set of those events per channel.

For transport + storage by an untrusted host, events are packaged two ways, both
already supported by `channel-history.ts`:
- Rolling snapshot: `buildChannelHistory(events, groupKey, signer)` -> a
  `SignedChannelHistorySnapshot` (Ed25519-signed) sealed under
  `deriveEpochContentKey(epochSecret, workspaceId, epoch)` (NaCl secretbox), wrapped
  in a `ContentManifest` (pieces, merkle root, signature). The host stores the sealed
  manifest + pieces; it cannot open them.
- Live tail: the raw signed events since the latest snapshot, each still individually
  encrypted to the epoch key for host storage. Small and frequently appended.

A puller fetches snapshot + tail, decrypts with the epoch key, re-verifies every
event's author signature, and merges into its local log. Decryption fails closed if
the key/epoch does not match; a bad signature drops that event.

### 4.3 Keys: who can read what

Epoch model (exists): each membership change mints a new epoch secret, wrapped per
member to their X25519 key. `historyScope`:
- `join_point` (clean): a joiner receives wraps for the current epoch onward only.
  Past epochs stay unreadable to them.
- `full` (default, "true feed"): on join, the committer ALSO back-wraps every prior
  epoch secret to the new member, so they can decrypt all historical snapshots. This
  is a deliberate, owner-approved relaxation of forward secrecy for newcomers and is
  surfaced in the UI.

Removal stays forward-secret: a removed device gets no wrap for the new epoch and is
also rejected by node auth, so it can neither pull nor decrypt new content.

### 4.4 Trust + threat model (what the host learns)

The host (community node or peer member) can see, per the locked decisions:
- Ciphertext blobs, their sizes, and timing.
- That the blobs belong to a given community (it serves per community).
- With per-member signed auth: which member device pulled, and when (access pattern +
  roster). Acceptable because the host is run by the community / is a fellow member,
  who already knows the roster.

The host CANNOT see: message bodies, attachment contents, channel names inside
events, or anything requiring the epoch key. A third-party relay used for backfill or
notify sees only opaque tokens + sizes + timing (unchanged zero-knowledge property).

Honesty rules carried forward: never show "live"/"online"/"delivered"; show
"Updated Xm ago" and the real source (community node vs peer). Never invent a peer
count. A revoked member is rejected, not silently shown stale data.

## 5. New protocol pieces to build (in `@mylife/sync`, extend not parallel-wire)

1. Key-wrap distribution: replicate `sync_workspace_keys` wrap rows over the existing
   engine session (each wrap is already encrypted to one member's DH key, so syncing
   it leaks nothing). Add to the community sync policy as `shared_workspace`. This is
   the precondition for any member to actually hold their epoch key.
2. Full-history back-wrap: extend `addWorkspaceMember`/`createGroupCommit` so that when
   `historyScope === 'full'`, prior epoch secrets are re-wrapped to the new member.
3. Auto snapshot job: `buildCommunitySnapshots(db, communityId, identity)` -> per
   channel, build a rolling `SignedChannelHistorySnapshot` + a tail manifest, on a
   cadence (every N events or T minutes) with compaction (one rolling full snapshot +
   small tail). Pure function + a scheduler hook (mirrors `runMailboxDrainJob`).
4. Per-member signed pull auth (challenge-response): node issues a nonce; client
   returns `sign(deviceKey, nonce || communityId || ts)`; node verifies the signature
   and that the device is a non-removed member of the community's latest signed
   descriptor. New module `protocol/feed-auth.ts`. Tokens are short-lived.
5. Member-to-member backfill: a history-range request/response over the relay mailbox
   (parallels the file-request mailbox): "send me events for channel C since HLC X";
   the serving member returns the signed events (re-encrypted to the requester pair or
   relying on the epoch key). New `protocol/history-backfill.ts`.
6. Notify-on-post ping: when a post reaches a host, the host publishes a content-free
   "community C changed" ping addressed by the community's relay token; auto-update
   members subscribed to that token wake and pull. Reuses relay frames; no content
   crosses in the ping.
7. Incremental cursor: persist a per-(community,channel) `last_pulled_hlc`; pulls
   request only events after the cursor (snapshot covers cold start, tail covers warm).

## 6. Community node ("always-on") build

Extend `seeder-node.ts` into a community-node mode (a second deployable, same
codebase, `DATA_DIR` volume):
- Persist per-community sealed snapshots + tail manifests + pieces (durable, not the
  5m mailbox).
- HTTP endpoints: `GET /community/{id}/manifest` (current snapshot + tail manifest,
  AUTH required), reuse `GET /{infoHash}/{index}` for pieces, `POST /community/{id}/append`
  (a member pushes a new sealed tail event, AUTH required), `GET /community/{id}/challenge`
  (nonce for auth).
- Auth middleware: per-member signed challenge (piece 4). Reject non-members + removed
  devices. Rate-limit per device.
- Announce the community to the host registry so browsers discover the node URL
  without it being hardcoded.
- Never decrypts; rejects any attempt to store an event whose author signature does
  not verify (fail-closed integrity even without reading content).

## 7. Browser feed experience

- A "Feed" surface in `apps/meerkat-web`: loads the full cached history from IndexedDB
  instantly, shows "Updated Xm ago" + a Refresh button + the source ("community node"
  / "peer" / "no host reachable").
- On open and on the community poll interval (and on a notify-ping wake if auto-update
  is on), it: discovers the node (registry) or a peer, authenticates (signed
  challenge), pulls snapshot + tail since the cursor, verifies + decrypts + merges,
  advances the cursor, updates "Updated now".
- Honest empty/edge states: "No host reachable, showing your last synced copy from
  Xm ago", "You were removed from this community", "Set a relay to discover the
  community node".
- Settings: per-member auto-update toggle; the community poll interval is admin-set
  and shown read-only to members.

## 8. Settings model

- Community descriptor gains: `historyScope: 'full' | 'join_point'` (default `full`),
  `feedPollIntervalMs: number | 'manual'` (admin-set; one of the allowed values),
  optional `nodes: string[]` (community node URLs, else registry discovery).
- Allowed poll intervals (admin picker): Manual only, 1m, 5m, 10m, 15m, 30m, 1h, 6h,
  24h, 1 week. (The product also wants a very low option for testing; gate sub-minute
  intervals behind a dev flag to avoid hammering hosts in production.)
- Member device setting: `autoUpdate: boolean` (receive notify-pings and auto-pull).

## 9. Phased rollout

- P0 - Key distribution + history scope. Sync key wraps over the engine; add
  `historyScope` to the descriptor; full-history back-wrap on join. Accept: a new
  member, after one sync, decrypts all (full) or from-join history snapshots in a test.
- P1 - Auto snapshots + cursor. Snapshot job + tail + incremental cursor. Accept: a
  channel's rolling snapshot import reconstructs the full resolved feed; warm pulls
  only transfer new events.
- P2 - Community node + per-member auth. Community-mode seeder persists + serves +
  authenticates. Accept: a browser with a member key pulls the full encrypted feed
  from another network; a non-member and a removed member are both rejected; the node
  never decrypts (proven by it holding only sealed bytes).
- P3 - Member-to-member backfill. History-range request/response over the relay.
  Accept: with no node, member B reconstructs the full feed from member A over a real
  relay (e2e, two browser nodes).
- P4 - Poll + notify liveness + settings. Community poll-interval admin setting,
  member auto-update toggle, notify-on-post ping, manual refresh. Accept: posting to
  the node wakes an auto-update member to pull within the interval; manual refresh
  pulls now; admin interval honored; "Updated Xm ago" is accurate.
- P5 - Browser feed UX + durable cache. The Feed surface, honest staleness + source,
  background poll while open. Accept: open from any browser with the member identity ->
  full feed -> refresh pulls new posts; offline shows last-synced honestly.
- P6 - Hardening + ops. Rate limits, snapshot size caps, removal re-snapshot + key
  rotation, deploy artifacts for the community node, the 2-device/2-network manual
  checklist (OPFS, real auth, real notify).

Every phase: typecheck + tests (extend the two-node real-relay harness so each new
cross-device flow is proven by real DB rows, not stubs) + honesty grep + the function
gate, mirroring how the web client slices were built.

## 10. Key risks + open questions

- Full-history back-wrap is a real privacy relaxation. Default it on per the product
  call, but make the owner explicitly confirm at creation, and consider letting
  individual authors opt their messages out of back-provisioning later.
- Snapshot growth: a busy community's full snapshot can get large. Compaction
  (rolling snapshot + bounded tail, periodic re-baseline) and per-channel snapshots
  bound it; cap sizes and page the cold-start pull.
- Node availability honesty: if the only host is offline, the feed is stale; the UI
  must say so plainly rather than spin.
- Sub-minute poll intervals: useful for testing, abusive in production. Gate behind a
  dev flag; default the production floor to 1m.
- Per-member auth reveals access patterns to the host. Acceptable per the decision
  (host is community-run/peer), but document it so it is a conscious tradeoff, not a
  surprise. An unlinkable capability-token mode remains a future option if a community
  wants to hide access patterns from its own node.

## 11. Honesty checklist (carry the product boundary into the feed)

- Never show "live", "online", "delivered", or a peer count not backed by a real row.
- Show "Updated Xm ago" from the real last-pull time and the real source.
- A removed member sees an explicit removed state, never silently-stale content
  dressed as current.
- The node stores only ciphertext; the UI never implies the node can read messages.
- No em dashes in copy.
