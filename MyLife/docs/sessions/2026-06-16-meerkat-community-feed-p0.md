# Meerkat Community Feed - P0: epoch key-wrap distribution + history scope

Date: 2026-06-16
Branch: `feature/meerkat-community-feed` (off `main`)
Commit: `8761fe88e`
Design: `docs/designs/meerkat-community-feed-architecture.md` (section 9, P0)

## Goal

Make a community member receive the epoch key needed to decrypt the feed, while
the host still holds only ciphertext. The precondition for every later phase:
`sync_workspace_keys` wrap rows must replicate over the existing engine.

## What shipped

### @mylife/sync
- `sync_workspace_keys` replicates as a dedicated `communitykeys` sync module
  (prefix = the literal table name, so it owns only that one `sync_` table) at
  `shared_workspace` scope. Replicates exactly like `cm_messages`.
- The binary `wrapped_key_blob` rides the plain-JSON LWW document as hex
  (`keyWrapToSyncedRow` / `keyWrapFromSyncedRow` in `group-keys.ts`); the inbound
  apply special-case in `sync-session.ts` routes it through `storeReceivedKeyWrap`
  (the generic INSERT would store hex-as-text into the BLOB column and never
  advance the epoch).
- `createGroupCommit` / `commitMemberAdd` / `commitMemberRemoval` take an optional
  `recordChange` seam (pass `engine.recordChange`) so each wrap written is queued
  for replication.
- `commitMemberAdd` gains `historyScope` (default `full`): full back-wraps every
  prior epoch the committer can read to the newcomer; `join_point` keeps epoch
  exclusion. Back-wrap loop lives in `group-keys.ts` (wrapSecret is module-private).
- `CommunityDescriptor` + `canonicalDescriptor` gain member `dhPublicKey`,
  `historyScope`, `feedPollIntervalMs` (all inside the signed bytes; fixed order).
  `HistoryScope` / `FeedPollIntervalMs` types added to `types.ts`.
- `insertKeyWrap` -> `INSERT OR IGNORE`; new `replaceKeyWrap` (`INSERT OR REPLACE`)
  for the poison-defense path.

### Founder create path
- `storeOwnedCommunity` (web `meerkat-data.ts` + new native twin in
  `community-core.ts`) now creates the workspace at `currentKeyVersion: 0` then
  `createGroupCommit` mints epoch 1 (fixes a latent `currentKeyVersion: 1`-with-no-
  wrap bug that would make `getCurrentEpochKey` lie) and replicates the wraps.
- Both providers (`MeerkatProvider`, `SyncProvider`) + the relay harness add the
  keys module to `enabledModules`.

### Parity
The keys module landed in all FOUR sync-policy sites identically: native
`sync-core.ts`, web `meerkat-data.ts`, relay `multi-node-harness.ts` `HARNESS_*`,
and the config guard `SOURCE_*`. Two app config tests updated to match.

## Adversarial review + hardening

A second agent attacked the diff. The crypto envelope held (zero-knowledge, signed
descriptor, table isolation, MK-002 gating, removal forward secrecy). It found two
member-triggered denial-of-read vectors (both fail-closed, no confidentiality
break): epoch fast-forward (a bogus high-version wrap advancing a victim's pointer
to an unreadable epoch) and first-wins poisoning of a member's own wrap slot.

Fix: `storeReceivedKeyWrap(db, wrap, recipient?)` now, when given the recipient
identity (the replication path), only advances `current_key_version` to an epoch
this device can actually READ; a verified self-wrap supersedes an earlier
unopenable (poison) row; a wrap addressed to another device is stored for gossip
but never moves this device's pointer. Three defense tests added to
`group-keys.test.ts`.

## Proof

New `apps/meerkat-web/src/lib/__tests__/support/web-node-harness.ts` (extracted +
extended from the inline e2e harness) and `community-feed-key-distribution.test.ts`
prove over a REAL relay, asserting on real `sync_workspace_keys` + `cm_messages`
rows, that a new member after ONE sync: opens ALL snapshots under `full` / only the
from-join snapshot under `join_point`; and that a removed member receives no
readable new-epoch wrap (forward secret).

## Verification (all green)

- `pnpm --filter @mylife/sync test` 1101, `meerkat-web` 20, `meerkat-app` 149,
  `meerkat-relay` 111
- typecheck: sync, meerkat-web, meerkat-app, meerkat-relay
- `pnpm --filter @mylife/meerkat-web build`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed` (incl. hub mobile + web consumer typechecks)
- em-dash check clean; honesty grep clean (no fabricated status; P0 added no UI)

## Known next step (honest scope)

P0 ships the distribution PRIMITIVES and proves them in the harness. The
owner-side `commitMemberAdd` for the invite-link join flow is NOT yet wired: the
owner does not learn a joiner's `dhPublicKey` from `joinCommunityFromLink`, so a
normal invite -> join does not auto-distribute a key end-to-end. Wiring that loop
(owner learns the joiner, revises the descriptor, `commitMemberAdd` with the
joiner's DH key + `recordChange`) is the first follow-up toward a working feed,
and `descriptor.historyScope` should then drive the `commitMemberAdd` arg.

## Phases P1-P6 (same session, all committed on feature/meerkat-community-feed)

Methodology each phase: a focused build agent owns the file zone, then (for the
security-sensitive phases) a second adversarial agent tries to break it, then the
orchestrator personally re-runs the full verification + reviews the diff, then one
Conventional Commit. The orchestrator never trusted an agent's "green" claim.

### P1 - rolling snapshots + tail + warm cursor (`f8b559495`)
New `@mylife/sync` `protocol/community-snapshots.ts` (PURE, App-Isolation safe):
`buildCommunitySnapshots` (per channel -> buildChannelHistory -> inject a
SnapshotPieceStore; compaction = one rolling snapshot per channel),
`importSnapshotFromPieces` (parse+verify+decrypt fail-closed, split events after a
cursor), `runCommunitySnapshotJob` (pure scheduler hook). New LOCAL-ONLY
`cm_snapshots` + `cm_feed_cursor` tables (never in any sync policy; cursor written
row-only, never recordChange, gotcha d). Proof: a non-author member reconstructs
the full RESOLVED feed from the snapshot alone after its live rows are wiped; a
warm pull transfers only the post-cursor tail.

### P2 - always-on community node + per-member signed auth (`77c09b025`)
New `protocol/feed-auth.ts` (challenge-response: signature + freshness + membership
in the latest descriptor; removed device absent -> not_member) + `SealedTailEntry`
zero-knowledge integrity (outer author signature over sha512(sealed bytes) - the
node never decrypts). New `node/feed-node-client.ts` `pullCommunityFeed`. New
`@mylife/meerkat-relay` `community-node.ts` + `community-node-http.ts`: owner-only
publish (hash-only piece integrity), append (outer-sig only), opaque serving,
host-registry announce. Adversarial SECURITY review: no P0; both headline
guarantees hold (node never reads plaintext; non/removed members rejected), proven
by real-HTTP real-crypto e2e. Two defense-in-depth findings deferred to P6.

### P3 - member-to-member backfill over the relay mailbox (`d6df80bf0`)
New `protocol/history-backfill-mailbox.ts` cloning the file-request pattern (kinds,
seal/open via the pair-private mailbox so the relay sees only ciphertext). Wired
into the mailbox dispatcher + drain (per-kind counters) + `history-backfill-core.ts`
serve/apply handlers (gate requester: not revoked + active member; re-verify +
role-gate each event on BOTH serve and apply) + `SyncProvider.queueHistoryRequest`.
Proof: with NO node, member B reconstructs A's resolved feed over a real relay;
non-member served nothing; tampered grant dropped on apply.

### P4 - poll + notify liveness + settings (`b08724b8e`)
New `protocol/community-notify.ts`: `deriveCommunityNotifyToken` (HKDF over the
descriptor genesisNonce, so members AND the zero-knowledge node derive it with no
epoch key), a content-FREE sealed ping, `FEED_POLL_INTERVALS` + normalize (1m
production floor, sub-minute dev-flag), `shouldEmitMessageNotification` (applied>0).
Node emits one ping after a real append / content-changing publish (best-effort).
Per-member auto-update toggle (mk_settings, row-only). Mirrors the data-only-push
discipline (wake enqueues; the applied count gates the user notification).

### P5 - browser feed UX + honest durable cache (`1752cfecc`)
New `apps/meerkat-web/src/ui/feed-status.ts` (pure: `formatUpdatedAgo`,
`sourceLabel`, `deriveFeedState`). `refreshCommunityFeed` surfaces a real `removed`
source when the node returns not_member; `getLastPulledAt`/`setLastPulledAt`
row-only. `App.tsx` ChannelView is now an honest feed: instant cached load,
"Updated Xm ago" + Refresh + read-only admin interval + auto-update toggle, honest
removed/no-relay/no-host/empty banners, background poll while open. Built on main's
MINIMAL UI (the rich Phase-1C UI is on a separate unlanded branch). Honesty grep
clean. Full browser flow is the P6 manual checklist.

### P6 - hardening + ops (`5f6d9ade2`)
Closed both P2 deferrals: per-community piece-path scoping
(`GET /community/{id}/{infoHash}/{index}` + `servePieceForCommunity`) and a durable
`CommunityDescriptorStore` enforcing restart-safe revision monotonicity (an
owner-signed older roster cannot re-grant a removed member after restart). Added
per-device token-bucket rate limits (-> 429) and a snapshot size cap (honest
`oversized` signal, never truncates). Proved removal re-snapshot forward secrecy.
Shipped `bin/meerkat-community-node.mjs` (second deployable image, DATA_DIR) +
relay docs + `docs/reports/meerkat-community-feed-manual-checklist.md`.

## Final verification (whole feature, all green)

sync 1129 + meerkat-relay 126 + meerkat-web 40 + meerkat-app 150 tests; all four
typechecks + hub mobile/web consumer typechecks; web build; meerkat parity;
`gate:function:changed`; honesty grep clean; no em dashes. (The lone load-flaky
complexity-slope perf benchmark - file-save / community-files / remote-store
function-gate - passes in isolation every time; gotcha f, not in this feature's
diff.)

### P7 - owner-side invite -> join key handoff (`78d4c7b40`)

Closed the one honest gap above: a normal invite -> join now mints the joiner an
epoch key + descriptor membership end to end, over the existing pair-private relay
mailbox (no new crypto). New `protocol/join-handoff-mailbox.ts`
(JOIN_REQUEST/JOIN_GRANT kinds + `deriveCommunityJoinToken`) +
`join-handoff-core.ts` (`buildJoinRequest`, owner `processJoinRequest`, joiner
`applyJoinGrant`). The owner verifies the invite + the joiner's signed identity
bundle, `reviseCommunity` + `commitMemberAdd` (epoch + historyScope back-wrap +
`recordChange` to paired members), pairs owner<->joiner so future rotations flow
over the engine, packages the joiner's openable wraps, and seals + parks a grant;
the joiner applies it (verify owner, upsert descriptor, bridge roster, store wraps,
pair owner). Dispatcher/drain gained the two kinds + an `extraTokens` path so an
owner drains its join-request token and a joiner its join-grant token. App wiring:
queue the request on join + re-queue while pending; drain the join tokens (native +
web in lockstep).

Built + reviewed by a 6-lens adversarial security workflow (auth-bypass,
confidentiality, epoch-key, descriptor-integrity, pairing/drain, honesty). The
orchestrator re-verified and FIXED every real finding before committing:
- P0 multi-use invite: the first join revises the descriptor (hash moves), which
  rejected every later joiner on the same invite. Fix: the owner authorizes on
  inviter authority + community id + expiry, not the mutable descriptor hash
  (`verifyCommunityInvite` gains `requireDescriptorBinding`, false for the owner
  path). Locked by a new second-joiner-same-link e2e test.
- P0 pairing ref: the handoff wrote an inline `local:shared:` ref the real app's
  drain cannot resolve. Fix: canonical secret-store ref via `storeSharedSecret`.
- P1s: scope grant wraps to the granted community (no cross-community poison),
  bridge `sync_workspace_members`, validate the joiner/owner DH-key shape (a
  malformed key would throw deep in wrapSecret and abort the drain), enforce
  `quotas.maxMembers`, replace (never duplicate) a member row, and guard the drain
  so one bad envelope cannot abort it.

Proof: `join-handoff-e2e.test.ts` (4 tests over a real relay): the full handoff +
full history; a second joiner reuses the same link; expired/wrong-community invites
dropped; a stranger-owned grant dropped. Verified sync 1129 + relay 130 + app 150 +
web 40, all typechecks + consumer typechecks, parity, gate. PR #17 updated.

## Founder ops / follow-ups (out of scope, by design)

- Deploy the community-node second image (`bin/meerkat-community-node.mjs`,
  DATA_DIR volume) and wire its parkNotify/announce to a real relay.
- Run the 2-device / 2-network manual checklist
  (`docs/reports/meerkat-community-feed-manual-checklist.md`).
- CODE follow-up (the one honest gap in the end-to-end loop): wire the owner-side
  `commitMemberAdd` for the invite-link join flow so a normal join auto-receives a
  key (P0 ships the primitives + harness proof; the auto-handoff after an
  invite-link join is not wired because the owner does not yet learn a joiner's
  dhPublicKey from `joinCommunityFromLink`). `descriptor.historyScope` should then
  drive the `commitMemberAdd` arg.
- OS-scheduled background poll + push-token delivery remain deferred behind the
  existing dev-build flag (same posture as `background-task-registration.ts`).
