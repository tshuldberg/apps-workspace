# Meerkat Plan 21 Phase 6 - Adversarial Review + Fix (2026-07-02)

Branch: `feature/meerkat-launch-finish` (unpushed, CI down for billing, local-green gate).
Reviewer: inline Fable (the two Opus subagent reviews I first dispatched were stopped by
the founder; I ran the review directly instead).

## Scope

First task from the launch handoff: adversarially review Plan 21 Phase 6 (group DM epoch
backing + per-member handoff, commit `4d3fd536`) before building on it. Phase 6 was the one
phase that shipped without the adversarial review the others got.

Files reviewed: `packages/sync/src/protocol/dm-group.ts`, `dm-group-handoff-mailbox.ts`,
`dm-group-handoff-core.ts`, `dm-mailbox.ts` (group seal path), `mailbox-dispatch.ts`,
`mailbox-drain.ts`, `group-keys.ts` (the reused commit path), `crdt/change-tracker.ts`,
`db/schema.ts`, `db/queries.ts`; the unit tests `dm-group.test.ts`,
`dm-group-handoff-mailbox.test.ts`; and the live-relay e2e `dm-group-e2e.test.ts`.

## Invariants verified (HOLD)

- **NC-9 (metadata no-leak): HOLDS, structurally.** The change-tracker is a MANUAL API:
  the only path into `sync_change_log` is an explicit `recordChange()` call (no DB triggers).
  `createWorkspace` / `addWorkspaceMember` / `insertKeyWrap` / `replaceKeyWrap` are raw
  `db.execute` writes that never touch the change log. Every dm_group create/add/remove path
  passes NO `recordChange` to the group-keys commit helpers, so zero syncable
  `sync_workspace_keys` rows are ever queued. Nothing about the group (existence, member
  device ids) can replicate to unrelated community co-members. The NC-9 test's positive
  control fires (a `createGroupCommit` WITH `recordChange` on a community workspace does
  increment `getUnsyncedByModule('communitykeys')`), so the negative test is meaningful.
- **Forward secrecy on removal: HOLDS.** `commitMemberRemoval` mints epoch N+1 wrapped for
  survivors only; the removed device holds no wrap and cannot `unwrapEpochSecret` it. The
  3-engine live-relay e2e proves C, removed at epoch 2, drains the ciphertext but cannot
  decrypt it (`dmMessages` 0, `cCouldDecrypt` false).
- **Admin-only descriptor + cross-domain isolation: HOLDS.** `verifyDmGroupDescriptor`
  checks the Ed25519 signature under `adminDeviceId` over a canonical form whose first
  element is the domain `meerkat-dm-group-v1`. A non-admin forging `adminDeviceId` fails (no
  private key); a channel/dm-message signature cannot cross-verify. `openDmGroupCommit` binds
  the envelope signer to the descriptor admin, and `applyDmGroupCommit` re-asserts it.
- **Handoff poison / fast-forward / rollback: HOLDS.** `storeReceivedKeyWrap` with a
  recipient only advances the epoch pointer to a version this device can actually open, and
  `advanceWorkspaceEpoch` is forward-only (`WHERE current_key_version < ?`), so a replayed old
  handoff cannot roll a member back and a foreign/garbage wrap cannot fast-forward it. Tests
  cover both.
- **No dependency cycle: HOLDS.** The live-relay e2e lives in `packages/meerkat-relay` (which
  already depends on sync); the pure tests are in `packages/sync`; the apply factory is split
  into `dm-group-handoff-core.ts` so the dispatcher imports the open path cycle-free.
- **Delivery path (the FF3 trap): SOUND at the protocol layer.** The DM_GROUP_COMMIT handoff
  seals to `deriveDmGroupCommitToken(cid, recipientId)`, a distinct token nobody polls by
  default (the drain polls pairwise tokens + `extraTokens`). The e2e proves delivery ONLY
  because the receiver passes that token, re-derived from `cid + own id`, as an `extraToken`.
  This is correct for Phase 6 but is a hard Phase 7 requirement (below).

## Finding fixed this session

**HIGH - `sync_workspaces.workspace_type` CHECK is never migrated on existing installs.**
Phase 6 added `'dm_group'` to the CHECK in the `CREATE TABLE IF NOT EXISTS sync_workspaces`
DDL. On a device whose `sync_workspaces` already exists (created before Phase 6), that DDL is
a no-op and SQLite cannot ALTER a CHECK, so the old CHECK (`'personal','group','community'`)
persists. Then:
- `createDmGroup -> createWorkspace(..., 'dm_group')` throws a constraint violation (group DM
  create crashes), and
- a received `DM_GROUP_COMMIT` throws inside `applyDmGroupCommit -> createWorkspace`, which
  `runMailboxDrainJob` catches and counts as `rejected` -> the epoch key never lands (SILENT
  non-delivery on upgraded installs).

Every existing test uses a fresh in-memory db (new CHECK), so the suite could not catch it.

Fix (`04a29914`): `migrateSyncSchema(db)` in `@mylife/sync` (`db/schema.ts`) does the standard
table rebuild for `sync_workspaces` when its live CHECK predates `'dm_group'` (detected via
`sqlite_master.sql`). No FOREIGN KEY references `sync_workspaces`, so the 12-step rebuild
collapses to a safe `CREATE temp / INSERT SELECT / DROP / RENAME` in one transaction that
preserves existing rows. Idempotent (skips when the CHECK already lists `'dm_group'`). Wired
into BOTH `ensureSyncSchema` paths (mobile `sync-core.ts`, web `schema.ts`) right after
`createSyncTables`, so the one migration is the single source of truth and cannot drift.
New test `dm-group-schema-migration.test.ts` reproduces the pre-migration throw, proves rows
survive the rebuild, `dm_group` inserts after, idempotency, and no-op on a fresh db.

Verification: `@mylife/sync` 1461, `meerkat-relay` dm-group-e2e green, mobile 341, web 183;
sync + mobile + web + tsconfig.test typechecks clean; `check-meerkat-parity.mjs` all passed.
Committed with the husky function gate passing (staged files do not touch `apps/web`, so the
known pre-existing `entitlement-issuer` billing failure was not pulled in).

## Requirements handed forward to Plan 21 Phase 7 (provider)

These are NOT Phase 6 defects (Phase 6 is the protocol layer; the provider is held for
Phase 7), but Phase 7 must satisfy all three or it will regress:

1. **(MED, FF3 trap) Drain the handoff token.** For every dm_group the device belongs to, the
   provider MUST add `deriveDmGroupCommitToken(conversationId, self.publicKey)` to the drain's
   `extraTokens`, re-derived from persisted state (never a send-side value). Otherwise the
   admin seals epoch handoffs to a token nobody polls and members silently never converge -
   the exact FF3-class bug. The e2e's `drainCommit` shows the required shape.
2. **(MED) Persist the signed descriptor; reconcile the roster; pick recipients from the
   descriptor.** `applyDmGroupCommit` bridges `sync_workspace_members` with `INSERT OR IGNORE`
   (additive) and does NOT persist the `SignedDmGroupDescriptor`. After a remove, a member's
   local roster still lists the removed device as active. Forward secrecy is safe (enforced by
   key wraps, proven by the e2e), but if Phase 7 sources the group-message recipient list from
   the local roster instead of the current admin-signed descriptor, it will fan epoch-N
   ciphertext (metadata: existence/size/timing) to a removed member. Phase 7 must (a) persist
   the descriptor as the authoritative membership/title/admin record, (b) reconcile the local
   roster against it (mark absent members removed), and (c) select message recipients from the
   descriptor, never the raw `sync_workspace_members` rows.
3. **(LOW, design limit) Pairwise-mesh requirement for group messages.** `sealDmGroup` fans one
   envelope per recipient under `deriveMailboxToken(recipient.pairSecret, recipientId)`,
   requiring the sender to hold a pairing secret with each recipient. A member added by the
   admin who is not pairwise paired with another member cannot deliver a message to them. The
   e2e only tests the admin (paired with all) as sender. Phase 7 must either ensure a full
   pairing mesh among group members or document that non-adjacent delivery is unsupported.

## Continuation: Plan 21 Phase 7 - group DM provider (commit `d42b60fa`)

Built the mobile group-DM provider on the Phase 6 primitives (UI held for Plan 30),
subagent-free (inline, TDD). Files: `dm-provider-core.ts` (group functions + drain handlers),
`SyncProvider.tsx` (callbacks + drain wiring + extra tokens), `background-sync.ts` (mirror),
`dm-group-provider.test.ts` (10 tests). All three Phase 6 requirements applied.

What shipped:
- `createDmGroupCore` / `dmGroupAddMemberCore` / `dmGroupRemoveMemberCore` (admin-only for
  add/remove): mint/rotate the epoch (no recordChange, NC-9), persist the admin-signed
  descriptor + roster, seal + park a per-member DM_GROUP_COMMIT handoff.
- `queueDmMessageCore` group branch: `sealDmGroup` under the current epoch content key,
  recipients read from the persisted DESCRIPTOR (never the raw roster), so a removed member is
  never addressed (req 2). A member with no pair secret is honestly `parked:false` (req 3).
- `buildDmGroupMailboxHandlers`: `applyDmGroupCommit` + app persistence of the authoritative
  descriptor + roster reconciliation (removed members pruned). A duplicate/stale commit
  (`descriptor.epoch <= stored`) applies nothing and never regresses the roster (an old
  add-handoff replay cannot resurrect a removed member) - honestly counted rejected.
- group-mode `dmMessage`: decrypt with this device's epoch secret and merge; no wrap for the
  epoch (not converged / removed) yields nothing (fail-closed).
- `resolveJoinExtraTokens` (foreground) + `buildExtraTokens` (background) both drain
  `deriveDmGroupCommitToken(cid, self)` for every group conversation (req 1).

Review finding fixed BEFORE commit (inline adversarial pass - the value of the review step):
the FF3 bootstrap trap. `resolveJoinExtraTokens` derives the group token from persisted
`dm_conversations`, which is EMPTY for a brand-new member (they learn `cid` only from the
commit - circular). So a real new member would never poll the token that delivers their first
commit. My own test masked it by feeding `drainGroupCommit` the `cid` directly (reusing the
send-side value - the exact anti-pattern). Fix: `sealAndParkGroupHandoff` parks each handoff on
BOTH the conversation-scoped token (steady state) AND the member's pair-private mailbox token
(bootstrap - the normal peer drain polls it without knowing `cid`). Idempotent apply dedups the
double delivery (the `<= stored epoch` guard returns rejected). Two new tests prove it:
bootstrap-via-pair-mailbox (a member with no prior conversation row converges via the peer
drain) and dedup (both tokens -> applied once). Known metadata tradeoff (the relay can correlate
the two tokens by size + timing) is documented in-code and deferred to Plan 27 (transport
policies / padding).

Verification: mobile 351 (+10), `tsc` + `tsconfig.test` clean, `check-meerkat-parity` passed.
The husky function gate passed on the mobile-only staged files (the pre-existing `apps/web`
`entitlement-issuer` billing failure is not pulled in).

## Continuation: Plan 21 Phase 8 - block / report / feed seam / disappearing / attachments

Built the four data/engine pieces (UI held for Plan 30), TDD, three commits.

Phase 8a (`f2e18086`) - block, report, feed seam:
- `blockDmParticipantCore`: block = a REAL local revocation (sync_device_revocations), authored
  and signed by this device. The drain already skips revoked peers; both DM send paths (direct +
  group) now also filter revoked devices so this device never addresses someone it blocked.
- `reportDmCore`: a local-only `dm_reports` ledger row (message or whole-participant), idempotent
  by a content-derived id. Nothing is sent.
- feed_opt_in guarded read API (frozen Plan 19 seam): `listFeedOptInConversations` +
  `getFeedSourceMessages`, both hard-filtering `WHERE feed_opt_in = 1`. Default 0 => empty set
  (NC-6). getFeedSourceMessages THROWS for a non-opted-in conversation. `optedInAt` sourced from
  `updated_at` (stamped on the opt-in flip); a dedicated column was rejected because the
  INSERT OR REPLACE upserts that run on every group commit would reset it.

Phase 8b (`4b3004c1`) - disappearing via author-signed DM_SHRED:
- New `@mylife/sync` `dm-shred.ts` (sibling of dm-receipt): an author-signed delete-for-everyone
  over domain `meerkat-dm-shred-v1`. Two-layer authority guarantees "a shred signed by a
  non-author is rejected": (1) verifyDmShred checks the signature under authorDeviceId and
  openDmShredMailbox binds the envelope signer to that author; (2) the apply side deletes a
  referenced message ONLY when the local row's author matches the shred author (a valid shred
  can delete only its author's OWN messages). Cross-domain isolated. Dispatcher gained a
  DM_SHRED slot + `dm-shred` outcome; the drain gained a `dmShreds` counter. Both barrels export it.
- App: `deleteDmMessageRow` (overwrite-then-delete the body + attachments + delivery rows,
  returns blob hashes to unpin), `queueDmShredCore` (shred my own: sign, fan to recipients,
  delete local copies + unpin blobs), `buildDmShredHandler` (drain side, author-owns guard).
  SyncProvider exposes `queueDmShred` and unpins via `ExpoBlobStore.removeLocal`; background mirrors.
- Honest boundary (documented in-code): until a peer drains the shred it can still read its local
  copy; the relay mailbox TTL is the only guarantee for a never-drained copy. NOT an
  entity-keys crypto-shred (dm_ tables never replicate).

Phase 8c (`551972bf`) - attachments:
- Send: `queueDmMessageCore` carries attachment blob blocks (splitBlobForTransfer output) on the
  1:1, group, and own-device paths; SyncProvider resolves + splits the cached bytes from the blob
  store. Receive: `verifyAndPinDmAttachments` reassembles the blocks for each blob hash referenced
  by an already-signature-verified event, hash-checks, and pins (blobStore.put re-verifies the
  hash) - a tampered or unreferenced block is never pinned, an incomplete set is skipped. Wired
  into the dmMessage drain handler (both modes) and mirrored in background-sync.
- Deferred, documented: the over-per-blob-cap DM file re-request (generalizing file-request to DM
  authors) lands with the attachment UI in Plan 30.

Also fixed `dm-provider-core.test` freshDb to create the sync tables (the send path now consults
`sync_device_revocations`). Verification across 8a-8c: `@mylife/sync` 1469, mobile 363, all four
typechecks, `check-meerkat-parity` green. The husky function gate passed on the staged files
(no `apps/web`, so the pre-existing billing failure is not pulled in).

## Plan 28 P0-P2 (member removal + epoch rotation, protocol through apply)

All TDD (test first, watched fail, then implemented), inline Fable, on the same branch.

P0 (`0dc3f361`) - removal protocol:
- `community.removeMemberRevision(owner, previous, removedDeviceId)`: owner-only wrapper over
  `reviseCommunity` that drops the member and bumps the revision (non-owner throws).
- `member-removal-mailbox.ts`: `MEMBER_REMOVAL_MAILBOX_KIND` + `deriveCommunityRemovalToken`
  (HKDF domain `meerkat-community-removal-v1:<cid>:<recipient>`, distinct from join/notify/
  public-join). `sealMemberRemovalFanOut` builds one sealed envelope per SURVIVOR carrying the
  new owner-signed descriptor, that survivor's new-epoch wrap rows, the removedDeviceId, and the
  owner bundle; the removed device is never a recipient. `openMemberRemovalMailbox` validates
  structurally fail-closed. No message content rides here (NC-4). 4 tests.

P1 (`d20af647`) - descriptor gossip (shared with Plan 27):
- `descriptor-gossip.ts` cloned from revocation-gossip: each side of any established session
  sends the signed descriptor of every community it holds and applies the peer's, fail-closed
  (known community only, strictly newer revision, verifies owner signature + chain against the
  local predecessor). The mailbox stays the primary direct delivery; gossip is the backfill.
  5 tests.

P2 (`142b59d0`) - dispatch + apply, both surfaces:
- `member-removal-core.ts` `applyMemberRemoval` handler factory (mirrors `applyJoinGrant`).
  Authority re-verified before any write: sender must equal the descriptor's ownerDeviceId, the
  community must already be held (a removal never introduces one), same stored owner, revision
  STRICTLY newer and verifying signature + chain against the local predecessor (AC-5), the new
  descriptor must drop the removed device and still list me. Apply: `upsertCommunity`, roster
  reconcile to the authoritative descriptor (closes `removed_at`, which flips the exact
  `getWorkspaceMembers` predicate both session gates read; reopens rows the descriptor
  re-lists), `storeReceivedKeyWrap` for the recipient-gated community-scoped wraps (the survivor
  advances to the new epoch, so an old-epoch session from the removed device hits the
  groupEpoch-mismatch refusal), owner bundle used as first-seen pin material only. The
  paired-device row is NOT touched (pairing is global; community dial eligibility is the roster
  row).
- Dispatcher: `memberRemoval` slot + kind case + `member-removal` outcome; drain gained a
  `memberRemovals` counter; both barrels export.
- Wiring: all three drain composition sites (mobile foreground SyncProvider, mobile
  background-sync headless, web MeerkatProvider shared builders) compose the handler AND poll
  `deriveCommunityRemovalToken(genesisNonce, communityId, self)` re-derived from persisted state
  for every LISTED member (FF3 trap avoided by construction). `ForegroundDrainResult` gained
  `memberRemovalsApplied` on both surfaces.
- `check-meerkat-parity.mjs`: 9 new guards lock handler + token + label across the three sites.
- 7 tests: full-drain convergence (revision adopted, roster closed via the real gate predicate,
  epoch advanced), replay rejected, non-owner forgery rejected, stale-revision rollback rejected,
  unknown community rejected, unhandled kind rejected, removed device never a recipient and a
  misdelivered envelope applies nothing.

Verification: `@mylife/sync` 1485, meerkat app 363, meerkat-web 183, relay 324, all four
typechecks, Meerkat parity green, `gate:function:changed --staged` exit 0.

P3 (`31c9b80e`) - removeCommunityMember end to end + node republish:
- `removeCommunityMember` (member-removal-core.ts): the owner-side orchestration. Owner-only
  (unknown_community / not_owner / not_a_member / cannot_remove_owner refused), then removal
  revision + monotonic upsert, commitMemberRemoval (fresh epoch for keyed survivors only,
  Boolean(dhPublicKey); AC-7 keyless FF3 joiners removable without wrap errors; recordChange
  replicates wraps over the engine), per-survivor fan-out parked on the P2 removal tokens
  (never the removed device, never self), and the revised descriptor republished to every
  http(s) node host. Honest result counts (envelopesParked / nodesRepublished report only
  what really happened).
- `republishCommunityDescriptor` (feed-node-client.ts): descriptor-only owner publish
  (snapshots: []) over the real challenge -> signFeedAuth -> POST /community/{id}/publish
  wire; the node chain-verifies + enforces durable revision monotonicity, then its next feed
  challenge rejects the removed member (AC-3).
- Both providers expose `removeCommunityMemberById` (no UI; P4 owns the control); 4 parity
  guards added.
- Live e2e (meerkat-relay `member-removal-e2e.test.ts`): 3 independent nodes + REAL loopback
  relay + REAL community-node HTTP server. Positive control (B pulls the hosted feed as a
  member), then ONE owner action; A drains its removal token through the real dispatcher
  (roster closed, epoch advanced); B's real workspace session to A is REFUSED (group-epoch
  mismatch, no pairwise fallback); B's hosted pull returns not_member while A still pulls.
- +7 sync tests (orchestration + republish client), all TDD.

P5 (`ab3ef678`) - hardening:
- NC-2 dead: `revokeFromWorkspace` / `rotateWorkspaceKey` (the v1 FAKE integer-bump rotation,
  no real key minted) now THROW unless an explicit `{ legacyOk: true }`; the error names the
  real path; barrels carry the warning; security-redteam opts in where it exercises legacy.
- Channel-apply membership cut (both surfaces, identical): `mergeChannelMessageEvents` drops
  events whose author's roster row is CLOSED and whose stamp is AFTER removed_at (the
  pairwise channel-mailbox is membership-unchecked, so the apply side is the gate; AC-2).
  Pre-removal events stay (epoch-boundary honesty); an author with NO roster row is allowed
  (snapshot/backfill history from members gone before this device joined must not vanish).
  New `droppedRemoved` counter keeps the result honest.
- Red-team: wrap withholding proven fail-closed (revision applies + roster closes, but the
  survivor stays on the OLD epoch, safe-locked behind the groupEpoch-mismatch refusal, never
  silently downgraded). Replay / non-owner forgery / stale-revision rollback were locked in P2.
- Two existing community-core tests gained createSyncTables (production boot always creates
  the sync tables before any merge runs).

Final verification: `@mylife/sync` 1495, meerkat app 367, meerkat-web 187, relay 325 (incl.
the live removal e2e), all four typechecks, Meerkat parity (incl. 13 new Plan 28 guards),
husky function gate on every commit.

## Next

Plan 21 Phases 5-8 done except the held UI. Plan 21 phases NOT built: 5 (mobile DM UI, held for
Plan 30), 9 (web parity of 3-8 + parity-gate extension), 10 (hardening). Plan 28 is ENGINE
COMPLETE (P0-P3 + P5); only P4 remains (owner-only Remove UI on both surfaces, retire the two
placeholder notices with epoch-boundary honest copy + parity guards) and lands with the UX set
30-32 per the founder's bundling decision. Then Plans 27 -> 24 -> 26, the UX set 30-32 with the
held DM UI, and Plan 25 (calls) last.
