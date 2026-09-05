# Meerkat M5: Communities (MK-030 descriptors + MK-043 channels/roles + MK-032 catalog/seeding)

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M5)

## Goal

MK-030: a community is a signed, portable CommunityDescriptor, created and
joined via expiring invite links with NO public directory; host change
re-signs; a fork keeps member access (exit rights). MK-043: Discord-shape
channels and roles, enforced at apply on every receiving device -- no
server-side room state anywhere.

## MK-030: the descriptor IS the community

`protocol/community.ts`:

- `CommunityDescriptor` = {communityId, revision, previousHash, genesisNonce,
  forkedFrom, name, ownerDeviceId, hosts, catalogCid, joinPolicy
  'invite_only', quotas, channels, members}. Every revision is Ed25519-signed
  by the owner over a fixed canonical form.
- **Stable, unforgeable id**: communityId = hash of the genesis content (with
  the id field blanked); verification re-derives it. Revisions chain by
  `previousHash` over the previous SIGNED descriptor, so order is durable.
- **Host change re-signs** (the AC): `reviseCommunity` bumps the revision,
  chains the hash, keeps the id, and re-signs. Hosts are reachability hints,
  never identity.
- **Exit rights** (the AC): `forkCommunity` -- ANY device holding the
  descriptor can found a new community that keeps the name, catalog CID,
  channels, and member list. The catalog is content-addressed, so access
  survives the move; the old owner is demoted to admin in the fork; the
  origin is recorded in `forkedFrom`.
- **Invites**: `createCommunityInvite` (owner/admin only; expiring; nonce;
  binds the EXACT descriptor revision by hash) produces a self-contained
  `meerkat://community/join#<base64(invite+descriptor)>` link that works
  offline once delivered. `verifyCommunityInvite` checks the descriptor, the
  invite signature, the inviter's role IN that descriptor, the binding hash,
  and expiry.
- **Join + workspace bridge**: `joinCommunityFromLink` stores the community in
  the new `sync_communities` table (SYNC_TABLES 31 -> 32; stale-revision
  protected) and bridges it into a `community`-type workspace with the
  descriptor's members -- so sessions, MK-002 authorization, the MK-017 SAS
  gate, and M3 group keys all apply to community traffic unchanged.
- Ownership handoff (old owner blesses a new one) is deferred; the fork is the
  v1 exit right, per the AC.

## MK-043: channels + roles, enforced at apply

- Channels and role grants live IN the signed descriptor
  (`CommunityChannel.postRoles`; undefined = any member may post). The
  descriptor IS the room state -- there is no server to hold any.
- Pure `evaluateChannelPost(descriptor, sender, channelId)` ->
  unknown_channel / not_community_member / channel_role_denied / allowed.
- Engine wiring: `applyReceivedDocumentChanges` resolves the session
  workspace's stored community once; any row carrying a `channel_id` is
  checked against the descriptor and a violation is REJECTED AT APPLY and
  audited -- on every receiving device, not just hidden in UI.

## App: the placeholder dies

The Communities tab's "COMING IN M5" roadmap card is replaced by the real
surface: create a community (you become owner, default #general +
#announcements channels), mint + copy an expiring invite link (owner/admin
only), paste a link to join (typed failure copy for malformed / expired /
invalid / not_authorized), per-community channel list with posting rules,
member list with roles, leave. Honest notice states exactly what is live and
that community CONTENT sync + the seeding catalog + desktop hosts are still
pending (MK-031/032).

## Tests

`community.test.ts` (15):
- genesis create/verify; tampered name rejected (breaks id AND signature);
- host change re-signs and chain-verifies; non-owner revision throws;
  wrong-predecessor chain rejected;
- **fork AC**: valid new genesis, new id, forkedFrom recorded, catalog +
  members + channels preserved, old owner demoted -- access survives;
- invite round-trip ok; expiry; member-minted invites impossible AND a forged
  inviter caught at verify; invite bound to a superseded revision rejected;
- **join AC**: community stored with my role, workspace bridged with members
  mirrored; expired link refused; stale descriptor never overwrites newer;
- channel verdict matrix; **engine AC**: in a real DB, a member's post to
  #announcements (owner/admin-only) is rejected at apply + audited
  `channel_role_denied`, while their #general post and the owner's
  #announcements post apply.

## Verification

- `@mylife/sync`: 963 tests (was 948; +15). typecheck clean.
- `@mylife/meerkat-app`: 31 tests; typecheck clean; meerkat parity green.
- `pnpm gate:function:changed`: EXIT 0.
- `apps/meerkat` CLAUDE/AGENTS architecture line updated in the same session.

## MK-032: catalog + seeding protocol (added same session)

`torrent/community-catalog.ts` composes the dormant torrent layer into the
community catalog protocol:

- `buildCommunityCatalog` wraps `createManifest`: one signed Merkle manifest
  per community (its `infoHash` is the descriptor's `catalogCid`; access
  'link', never directory-public). `catalogPieceBytes` + `verifyCatalogPiece`
  make every host and web seed untrusted-but-verifiable.
- `planReplicaPlacement`: RAREST-FIRST replica placement across alive hosts --
  pieces with the fewest copies are assigned first, least-loaded host wins the
  tiebreak, per-host storage caps are never exceeded, and pieces that cannot
  reach the replication target are reported (never silently dropped).
  `catalogAvailability` answers "is every piece on at least one alive host".
- `fetchCatalogFromWebSeed`: the cold-start fallback -- pull every piece from
  a plain HTTP web seed via the existing `WebSeedClient`, verify each against
  the manifest, reassemble.

`community-catalog.test.ts` (8) proves the ACs: two hosts shard ~5/5 balanced
at replication 1; at replication 2 KILLING ONE HOST leaves the catalog fully
available (negative control at r=1 exposes exactly the dead host's shard);
scarce capacity goes to zero-copy pieces first; a REAL localhost HTTP server
serves a cold start end-to-end hash-verified; a corrupting web seed is caught
per-piece. The web-seed tests inject an explicit `node:http` fetchFn because
the repo's vitest network guard stubs global fetch (by design).

Live 24/7 hosting of a pinned community is MK-031 (device/ops).

## MK-033: mailbox mode (added same session)

`protocol/mailbox.ts` (the Briar pattern):
- `deriveMailboxToken(pairSecret, recipientId)`: the mailbox address is
  PAIR-PRIVATE -- derived from the pairing shared secret, so the relay/host
  sees an opaque 64-hex token it cannot link to any identity.
- `sealMailboxDelta`: each delta is sealed to ONE recipient (ephemeral X25519
  -> HKDF -> authenticated secretbox) and Ed25519-signed by the sender; the
  signature binds the ciphertext, so tampering reads as a forged signature.
- `openMailboxDelta`: fails closed on forged sender, wrong recipient, tamper.
- Transport is the EXISTING relay contract: env frames queue in the hub's TTL
  mailbox while the peer is absent; the drain-on-join is the wake-up delivery.
  `RelayLimits` was widened from literal types so a mailbox-mode relay (or the
  personal node running the same hub) can configure a long TTL.

AC proven in `mailbox-mode-e2e.test.ts` (meerkat-relay): the desktop parks
three sealed deltas for an OFFLINE phone and disconnects (the queue outlives
the sender -- store-and-forward, not live relay); the phone joins its
pair-private mailbox later and drains + opens all three with the sender
authenticated. TTL purge verified with an injected clock: queued at 0h, still
there at 23h, purged at 25h, and a late receiver honestly gets nothing.
+7 sync unit tests (token privacy, round-trip, host-cannot-open, forged and
tampered rejection, garbage decode).

## MK-034: abuse rails v1 (added same session)

`protocol/abuse-rails.ts` -- three rails at the narrowest honest boundary:
1. Reports are reporter-side: the reporter quotes the plaintext THEY can read
   and seals it to the T&S inbox via the MK-033 mailbox envelope (signed by the
   reporter, readable only by T&S -- a snoop or admin cannot open it). AC
   proven: context intact, reporter authenticated.
2. `evaluatePublishBoundary`: client-side hash matching at the PUBLISH boundary
   only -- `published_blob` content hashed pre-encryption, flagged hashes block
   the publish. PRIVATE SCOPES PROVABLY UNSCANNED: the test passes a spy hash
   function and asserts it is never invoked for device_local /
   personal_replica / shared_workspace, and runs exactly once for a publish.
3. Kill switch at the join boundary: T&S-authority-signed kill records;
   `joinCommunityFromLink` (optional kill list) refuses NEW joins of a killed
   community while an existing member's stored data is untouched (proven);
   forged or untrusted-authority kills never count. DMCA agent registration
   stays founder ops. abuse-rails.test.ts (6).

## MK-035: Host Credits v0 (added same session)

`protocol/host-credits.ts` -- credits are an ENTITLEMENT, not a currency:
- The ledger is signed spot-check attestations from OTHER members (uptime
  probe answered, serve receipts in bytes, storage verified); self-attestation
  is structurally rejected; `computeHostCredits` recomputes from the ledger,
  skipping anything unverifiable, with a rolling window so stale entries age
  out (local-first + verifiable AC).
- `hostPerk`: healthy hosts (>=10 checks at >=95% pass) get
  `{proFree: true, quotaMultiplier 2..4}` -- the perk object carries nothing
  transferable, asserted in test (no token, no cash-out AC).
- `hostRatioStats`: soft served/stored ratios for admins, informational only.
  host-credits.test.ts (6).

## MK-031: Meerkat Node v0 (added 2026-06-12)

`@mylife/meerkat-relay` (the desktop-binary package) gains the headless seeder:
- `seeder-node.ts` `MeerkatSeederNode` composes the shipped halves --
  `SeedingEngine` (@mylife/sync: storage caps, schedules, upload/peer
  accounting) + `community-catalog` (per-piece bytes + hash verification).
  `pin` enforces the storage cap BEFORE writing a byte; `servePiece` gates on
  policy (`shouldServe` -- wired/charging), verifies the piece against the
  manifest (a corrupted local piece is never served), and records the upload;
  `sweep` auto-deletes non-pinned content past its window on the NODE's own
  injectable clock (SeedingEngine.pruneExpired uses the wall clock, which I
  deliberately bypass for determinism); `stats` reports uptime / pinned /
  storage / bytesServed / peersServed. Content-AGNOSTIC: it serves opaque
  hash-addressed pieces and learns no plaintext (the MK-041 zero-knowledge
  property).
- `seeder-http.ts` binds the web-seed convention `GET /{infoHash}/{index}` over
  node:http, so the existing `fetchCatalogFromWebSeed` client consumes a node
  unchanged. Injectable `SeederPieceStore` (InMemory + File).
- `bin/meerkat-node.mjs`: the CLI (PORT/DATA_DIR/MAX_STORAGE_MB env, optional
  CATALOGS_FILE, periodic sweep + stats logging). `meerkat-node` added to the
  package bin map alongside `meerkat-relay` and `meerkat-direct`.

Tests: `seeder-node.test.ts` (8) -- cap respected before writing, policy gate
(not-charging refused), corrupted-piece refusal, unknown/out-of-range, sweep
keeps pinned + drops expired, unpin. `seeder-node-e2e.test.ts` (2) -- the AC: a
member fetches the FULL catalog from the LONE node over real HTTP, verified end
to end, with no other member online; plus /healthz + 404.

## M5 status

CODE-COMPLETE: MK-030, MK-031, MK-032, MK-033, MK-034, MK-035, MK-043 all done
with ACs proven (sync 990, relay 45, app 31). The only milestone-exit remainder
is non-code founder ops: the 24/7 Mac-mini soak with a live phone, a minimal
desktop UI, and the relay-region deploy.
