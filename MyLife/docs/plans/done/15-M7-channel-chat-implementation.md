# Meerkat M7: Channel Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real text messages in community channels: signed, ordered, synced device-to-device over the existing encrypted session, with host-seeded history so a member who joins later can read the backlog.

**Architecture:** A channel message is an immutable, sender-signed event (D15) stored as a row in a new `cm_messages` table owned by a new `community` sync module (prefix `cm_`). Messages ride the SAME hardened session path the pad uses (signed batches, frame envelope, inbound policy), with `evaluateChannelPost` already gating `channel_id` on every receiver. Order is a hybrid logical clock applied at read time. Durable history is rolled into signed, group-key-encrypted catalog pieces seeded by host nodes (`MeerkatSeederNode`) and fetched rarest-first on scrollback.

**Tech Stack:** TypeScript, `@mylife/sync` (node + protocol + engine + crdt), `@mylife/meerkat-relay` (seeder/catalog), Expo/React Native (`apps/meerkat`), better-sqlite3 (tests) / expo-sqlite (device), tweetnacl (Ed25519), Vitest.

---

## Scope

This plan covers M7 only (MK-050..MK-058) from `docs/plans/active/15-meerkat-communities-suite.md`. M8-M12 get their own plans when reached. M7 ends green (gate + parity) with the exit demo: two members post in two channels from two devices, messages appear in the same order on both, a third member loads history from a host node, an image attachment sends and renders, and with no host online the UI honestly shows partial history.

## File Structure

**Create:**
- `packages/sync/src/protocol/channel-message.ts` — the message event: type, sign/verify, content-hash id, hybrid logical clock, deterministic ordering. Pure, no I/O.
- `packages/sync/src/protocol/channel-history.ts` — roll a set of message events into a signed, group-key-encrypted history snapshot for the catalog; parse/verify/merge on fetch.
- `packages/sync/src/__tests__/channel-message.test.ts` — unit tests for the event + clock + ordering.
- `packages/sync/src/__tests__/channel-chat-session.test.ts` — live two-engine session test (post -> appears ordered on peer; role gate; edit/delete; offline drain).
- `packages/sync/src/__tests__/channel-history.test.ts` — snapshot build/verify/merge + host-fetch acceptance.
- `apps/meerkat/app/(root)/data/community-core.ts` — the `community` sync module: id, `cm_` prefix, syncPolicy, `cm_` table DDL, message read/write helpers, read-state helpers.
- `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx` — the channel chat screen (message list + composer).
- `apps/meerkat/app/(root)/providers/ChatProvider.tsx` — channel message send/list/edit/delete + read-state, on top of the engine + community-core.
- `apps/meerkat/app/__tests__/community-core.test.ts` — Node-only tests for the DDL + helpers + policy shape.

**Modify:**
- `packages/sync/src/index.ts` and `index.native.ts` — export the new channel-message + channel-history APIs (RN-safe).
- `apps/meerkat/app/(root)/data/sync-core.ts` — add the `community` module to the engine's prefixes/enabled/policies (alongside `meerkatpad`).
- `apps/meerkat/app/(root)/providers/SyncProvider.tsx` — register the community module; pass the new prefixes/policies/enabled set to the engine; expose the community module id.
- `apps/meerkat/app/(root)/data/expo-node-store.ts` — already implements blob storage for attachments via `SessionBlobProvider`; confirm wired into the engine session (MK-054).
- `apps/meerkat/app/(root)/(tabs)/communities.tsx` — make each channel row navigate to the channel screen.
- `apps/meerkat/app/(root)/_layout.tsx` — register the `channel/[communityId]/[channelId]` route + mount `ChatProvider`.

---

## Task 1 (MK-050): Channel message event model

**Files:**
- Create: `packages/sync/src/protocol/channel-message.ts`
- Test: `packages/sync/src/__tests__/channel-message.test.ts`
- Modify: `packages/sync/src/index.ts`, `packages/sync/src/index.native.ts`

- [ ] **Step 1: Write the failing test for sign/verify + content id**

```ts
// packages/sync/src/__tests__/channel-message.test.ts
import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createChannelMessage, verifyChannelMessage, channelMessageId,
  compareChannelMessages, type ChannelMessageEvent,
} from '../protocol/channel-message';

const author = generateDeviceIdentity('Author');

describe('channel message event (MK-050)', () => {
  it('signs, verifies, and derives a stable content id', () => {
    const m = createChannelMessage(author, {
      communityId: 'c1', channelId: 'general', body: 'hello',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    expect(m.authorDeviceId).toBe(author.publicKey);
    expect(m.id).toBe(channelMessageId(m));
    expect(verifyChannelMessage(m)).toBe(true);
  });

  it('rejects a tampered body (signature no longer covers it)', () => {
    const m = createChannelMessage(author, {
      communityId: 'c1', channelId: 'general', body: 'hello',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const tampered: ChannelMessageEvent = { ...m, body: 'evil' };
    expect(verifyChannelMessage(tampered)).toBe(false);
  });

  it('rejects a forged author', () => {
    const evil = generateDeviceIdentity('Evil');
    const m = createChannelMessage(author, {
      communityId: 'c1', channelId: 'general', body: 'hi',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const forged: ChannelMessageEvent = { ...m, authorDeviceId: evil.publicKey };
    expect(verifyChannelMessage(forged)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `cd packages/sync && npx vitest run src/__tests__/channel-message.test.ts`
Expected: FAIL ("Cannot find module '../protocol/channel-message'").

- [ ] **Step 3: Implement the event model**

```ts
// packages/sync/src/protocol/channel-message.ts
import type { DeviceIdentity } from '../types';
import { extractSigningPrivateKeyHex, signMessage, verifySignature } from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const encoder = new TextEncoder();

/** A hybrid logical clock stamp: wall time + a per-author monotonic counter. */
export interface Hlc { wall: string; counter: number; }

/** An immutable, sender-signed channel message event (D15). */
export interface ChannelMessageEvent {
  version: 1;
  id: string;               // content hash of the signed body (see channelMessageId)
  communityId: string;
  channelId: string;
  authorDeviceId: string;   // Ed25519 device id
  body: string;
  hlc: Hlc;
  /** If set, this event supersedes a prior message id (edit) or tombstones it (deleted=true). */
  supersedes?: { id: string; deleted: boolean };
  signature: string;        // hex, by authorDeviceId over the canonical form
}

type ChannelMessageInput = Omit<ChannelMessageEvent, 'version' | 'id' | 'authorDeviceId' | 'signature'>;

/** Canonical bytes the author signs (everything but the id + signature). */
function canonical(m: Omit<ChannelMessageEvent, 'id' | 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-channel-message-v1',
    m.version, m.communityId, m.channelId, m.authorDeviceId,
    m.body, m.hlc.wall, m.hlc.counter,
    m.supersedes ? [m.supersedes.id, m.supersedes.deleted] : null,
  ]));
}

/** Content id = hash of the signed canonical form + signature (stable, unforgeable). */
export function channelMessageId(m: Omit<ChannelMessageEvent, 'id'>): string {
  const body = bytesToHex(canonical({ ...m }));
  return sha512Hex(encoder.encode(body + m.signature)).slice(0, 32);
}

export function createChannelMessage(author: DeviceIdentity, input: ChannelMessageInput): ChannelMessageEvent {
  const unsigned: Omit<ChannelMessageEvent, 'id' | 'signature'> = {
    version: 1, authorDeviceId: author.publicKey, ...input,
  };
  const signature = bytesToHex(
    signMessage(extractSigningPrivateKeyHex(author.privateKeyRef), canonical(unsigned)),
  );
  const id = channelMessageId({ ...unsigned, signature });
  return { ...unsigned, id, signature };
}

export function verifyChannelMessage(m: ChannelMessageEvent): boolean {
  if (!m || m.version !== 1 || typeof m.signature !== 'string') return false;
  if (m.id !== channelMessageId(m)) return false;
  try {
    const { id, signature, ...unsigned } = m;
    void id;
    return verifySignature(m.authorDeviceId, canonical(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

/** Deterministic total order: wall, then counter, then author (tiebreak). */
export function compareChannelMessages(a: ChannelMessageEvent, b: ChannelMessageEvent): number {
  if (a.hlc.wall !== b.hlc.wall) return a.hlc.wall < b.hlc.wall ? -1 : 1;
  if (a.hlc.counter !== b.hlc.counter) return a.hlc.counter - b.hlc.counter;
  return a.authorDeviceId < b.authorDeviceId ? -1 : a.authorDeviceId > b.authorDeviceId ? 1 : 0;
}

/** Next HLC for a local send given the highest clock this device has seen. */
export function nextHlc(seen: Hlc | null, now: string): Hlc {
  if (!seen) return { wall: now, counter: 0 };
  if (now > seen.wall) return { wall: now, counter: 0 };
  return { wall: seen.wall, counter: seen.counter + 1 };
}
```

- [ ] **Step 4: Add the ordering + clock tests**

```ts
// append to channel-message.test.ts
import { nextHlc } from '../protocol/channel-message';

it('orders deterministically by wall, counter, then author', () => {
  const a = createChannelMessage(author, { communityId: 'c', channelId: 'g', body: '1', hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 } });
  const b = createChannelMessage(author, { communityId: 'c', channelId: 'g', body: '2', hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 5 } });
  const c = createChannelMessage(author, { communityId: 'c', channelId: 'g', body: '3', hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 5 } });
  const sorted = [a, b, c].sort(compareChannelMessages).map((m) => m.body);
  // b and c share wall+counter; author tiebreak is stable; both precede a.
  expect(sorted[2]).toBe('1');
});

it('nextHlc advances the counter within the same wall and resets on a newer wall', () => {
  expect(nextHlc(null, 'T1')).toEqual({ wall: 'T1', counter: 0 });
  expect(nextHlc({ wall: 'T1', counter: 0 }, 'T1')).toEqual({ wall: 'T1', counter: 1 });
  expect(nextHlc({ wall: 'T1', counter: 3 }, 'T2')).toEqual({ wall: 'T2', counter: 0 });
});
```

- [ ] **Step 5: Run all channel-message tests; verify pass**

Run: `cd packages/sync && npx vitest run src/__tests__/channel-message.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Export from both barrels**

In `packages/sync/src/index.ts` and `packages/sync/src/index.native.ts`, add:
```ts
export {
  createChannelMessage, verifyChannelMessage, channelMessageId,
  compareChannelMessages, nextHlc,
} from './protocol/channel-message';
export type { ChannelMessageEvent, Hlc } from './protocol/channel-message';
```

- [ ] **Step 7: Typecheck + commit**

Run: `cd packages/sync && pnpm typecheck`
Expected: clean.
```bash
git add packages/sync/src/protocol/channel-message.ts packages/sync/src/__tests__/channel-message.test.ts packages/sync/src/index.ts packages/sync/src/index.native.ts
git commit -m "feat(sync): MK-050 channel message event model (signed, ordered)"
```

---

## Task 2 (MK-051): Sync wiring + channel-post gate (live two-engine)

**Files:**
- Create: `apps/meerkat/app/(root)/data/community-core.ts`
- Test: `packages/sync/src/__tests__/channel-chat-session.test.ts`
- Modify: `apps/meerkat/app/(root)/data/sync-core.ts`

**Design:** A message event is persisted as a row in `cm_messages` (columns mirror the event). The `community` module (prefix `cm_`) carries it through the engine; `evaluateChannelPost` (already wired in `applyReceivedDocumentChanges`) rejects a row whose `channel_id` the sender's role can't post to; signed batches already bind the author. The row's scope is `shared_workspace` (community), `conflictStrategy: 'or_set'` (add-only events; edit/delete are supersede rows).

- [ ] **Step 1: Write the failing live-session test**

```ts
// packages/sync/src/__tests__/channel-chat-session.test.ts
// Reuse the session harness pattern from session-sync.test.ts: two in-memory DBs,
// a community workspace both devices are members of, the wired connection pair,
// runInitiatorSession/runResponderSession. A message row authored on A with a
// valid channel_id lands ordered in B's cm_messages; a row for a channel the
// sender's role cannot post to is rejected + audited (channel_role_denied).
```
(Model it on `session-sync.test.ts`'s `connectionPair` + `runSession`, adding a `community` workspace via `createWorkspace`/`addWorkspaceMember` and a `community` module policy with `cm_messages`.)

- [ ] **Step 2: Run it; verify it fails** (no `community` module / `cm_messages` table yet).

- [ ] **Step 3: Add the community module + DDL in `community-core.ts`**

```ts
// apps/meerkat/app/(root)/data/community-core.ts
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';

export const COMMUNITY_MODULE_ID = 'community';
export const COMMUNITY_PREFIX = 'cm_';

export const COMMUNITY_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'cm_messages', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_reactions', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_read_state', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
  ],
};

export const COMMUNITY_DDL = `
CREATE TABLE IF NOT EXISTS cm_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  hlc_wall TEXT NOT NULL,
  hlc_counter INTEGER NOT NULL,
  supersedes_id TEXT,
  supersedes_deleted INTEGER,
  signature TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cm_messages_channel ON cm_messages (community_id, channel_id, hlc_wall, hlc_counter);
CREATE TABLE IF NOT EXISTS cm_read_state (
  id TEXT PRIMARY KEY,             -- communityId:channelId
  last_read_wall TEXT, last_read_counter INTEGER, updated_at TEXT NOT NULL
);
`;
```
(`updated_at` is required because inbound LWW + tombstone logic key on it; set it to the message's `hlc_wall` for messages.)

- [ ] **Step 4: Register the module with the engine in `sync-core.ts`**

Add `COMMUNITY_MODULE_ID`/`COMMUNITY_PREFIX`/`COMMUNITY_SYNC_POLICY` to the engine's `MEERKAT_SYNC_PREFIXES`, `enabledModules`, and `MEERKAT_SYNC_POLICIES` (so the engine syncs `cm_` tables alongside `mp_`). Run `COMMUNITY_DDL` in `DatabaseProvider`/`ensureMeerkatTables`.

- [ ] **Step 5: Implement send/receive helpers** in `community-core.ts`: `insertMessageRow(db, event)`, `listChannelMessages(db, communityId, channelId)` (ordered via `compareChannelMessages`, resolving supersedes), `highestHlc(db, communityId, channelId)`. The engine's `recordChange('cm_messages', 'INSERT', event.id, row)` ships it; `applyReceivedDocumentChanges` + `evaluateChannelPost` enforce on receive.

- [ ] **Step 6: Run the live-session test; verify pass** (message lands ordered on B; role-denied row rejected + audited).

- [ ] **Step 7: Full sync suite + commit**

Run: `cd packages/sync && pnpm test`
Expected: all green (existing + new).
```bash
git add packages/sync apps/meerkat/app/\(root\)/data/community-core.ts apps/meerkat/app/\(root\)/data/sync-core.ts
git commit -m "feat(meerkat): MK-051 channel messages sync through the engine with role gating"
```

---

## Task 3 (MK-052): Channel chat screen + composer

**Files:**
- Create: `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`, `apps/meerkat/app/(root)/providers/ChatProvider.tsx`
- Modify: `apps/meerkat/app/(root)/(tabs)/communities.tsx` (channel rows navigate), `apps/meerkat/app/(root)/_layout.tsx` (route + ChatProvider)

**Build:** `ChatProvider` exposes `useChannel(communityId, channelId)` -> `{ messages, send(body), busy, error }`, backed by community-core + the engine. The screen renders the ordered list (author + time grouping, supersede/edit/delete resolved), an Open Burrow composer, optimistic local echo that reconciles to the recorded event, and the five states (loading/empty/error/sending/partial-history). Honesty: a message shows "sending" until its row is recorded; never "delivered" without a recorded session.

- [ ] Step 1: Write a Node-only `ChatProvider` reducer test (compose -> optimistic -> reconcile) in `apps/meerkat/app/__tests__/community-core.test.ts`.
- [ ] Step 2: Run; fails.
- [ ] Step 3: Implement `community-core` list/insert helpers + `ChatProvider`.
- [ ] Step 4: Build the channel screen UI (Open Burrow tokens via `useMkStyles`).
- [ ] Step 5: Wire navigation from `communities.tsx` channel rows + the route in `_layout.tsx`.
- [ ] Step 6: Run app tests + typecheck; `/browse` the screen for the 5 states.
- [ ] Step 7: Commit `feat(meerkat): MK-052 channel chat screen + composer`.

**Acceptance:** All 5 states render; no message shown delivered before a recorded event; sending two messages shows them in order.

---

## Task 4 (MK-053): Edit + delete with redaction

**Files:** Modify `community-core.ts`, `ChatProvider.tsx`, channel screen; Test: extend `channel-chat-session.test.ts`.

**Build:** Edit = a new `createChannelMessage` with `supersedes: { id, deleted: false }`; delete = `supersedes: { id, deleted: true }`. The list resolver shows the latest non-deleted version. Delete also crypto-shreds the message's per-entity key (MK-024 `destroyEntityKey`) so any seeded ciphertext for it goes dark.

- [ ] Step 1: Failing test: an edit supersedes on a second engine; a delete removes it on the peer AND renders prior captured ciphertext unreadable.
- [ ] Step 2: Run; fails.
- [ ] Step 3: Implement supersede resolution in `listChannelMessages` + the shred call on delete.
- [ ] Step 4: Edit/delete affordances in the UI (long-press own message).
- [ ] Step 5: Run tests; pass.
- [ ] Step 6: Commit `feat(meerkat): MK-053 message edit + delete with redaction`.

**Acceptance:** Edit updates on a peer; delete removes everywhere and the captured-bytes test confirms ciphertext is unreadable post-shred.

---

## Task 5 (MK-054): Attachments via blob-transfer

**Files:** Create `cm_message_attachments` DDL in `community-core.ts`; Modify `ChatProvider`, channel screen; confirm `ExpoNodeStore` is wired as the session `SessionBlobProvider`. Test: extend `channel-chat-session.test.ts`.

**Build:** An attachment is a blob (`blobContentHash`, 16KiB blocks, `BLOB_REQUEST`/`BLOB_DATA`, size-capped, wifi_only default). The message row carries `attachment` refs (blob hash + mime + name). Picker -> stage blob -> send message with refs -> peer requests + verifies + renders.

- [ ] Step 1: Failing test: a multi-block image posts A->B, verifies, stores; over-cap refused; resume skips staged blocks. (Model on `blob-pipeline.test.ts`.)
- [ ] Step 2: Run; fails.
- [ ] Step 3: Add attachment table + refs; wire `SessionBlobProvider` (ExpoNodeStore) into the engine session options.
- [ ] Step 4: Image/file picker + inline render + download in the UI.
- [ ] Step 5: Run tests; pass.
- [ ] Step 6: Commit `feat(meerkat): MK-054 channel attachments via blob transfer`.

**Acceptance:** Image posts, verifies, renders on a peer; over-cap refused; resume works.

---

## Task 6 (MK-055): Signed, encrypted history snapshots

**Files:** Create `packages/sync/src/protocol/channel-history.ts`, `packages/sync/src/__tests__/channel-history.test.ts`; Modify barrels.

**Build:** `buildChannelHistory(messages, groupKey, signer)` -> encrypts the ordered event batch under the community group epoch key (MK-021 `deriveEpochContentKey`), packages it as catalog entries via `buildCommunityCatalog`, returns pieces + the catalog manifest (its `infoHash` becomes the descriptor `catalogCid`). `parseChannelHistory(pieces, groupKey)` verifies + decrypts + returns ordered events.

- [x] Step 1: Failing test: build a snapshot from N messages; every catalog piece verifies (`verifyCatalogPiece`); parse round-trips the exact ordered events; a wrong group key fails closed.
- [x] Step 2: Run; fails.
- [x] Step 3: Implement build/parse on top of `community-catalog` + `deriveEpochContentKey` + secretbox.
- [x] Step 4: Run; pass. Export from barrels.
- [x] Step 5: Commit `feat(sync): MK-055 signed encrypted channel-history snapshots`.

**Acceptance:** Snapshot builds, pieces verify, round-trips; wrong key fails closed.

---

## Task 7 (MK-056): History fetch + scrollback (host-seeded)

**Files:** Modify `ChatProvider` (fetch on join/scroll), `community-core` (merge), reuse `fetchCatalogFromWebSeed` / host fetch; Test: extend `channel-history.test.ts` with a host-node fetch.

**Build:** On opening a channel with gaps (or scroll-up), fetch missing history rarest-first from the community's hosts (`MeerkatSeederNode.servePiece` over `startSeederHttp` / `fetchCatalogFromWebSeed`), decrypt with the group key, dedupe against live events by id, merge into the ordered list. No host -> show "older messages need a host online" honestly.

- [x] Step 1: Failing acceptance: a third member with zero live history loads the full backlog from a LONE host node over real HTTP; order matches authors' devices. (Model on `seeder-node-e2e.test.ts`.)
- [x] Step 2: Run; fails.
- [x] Step 3: Implement fetch + decrypt + merge + dedupe; the no-host honest state.
- [x] Step 4: Run; pass.
- [x] Step 5: Commit `feat(meerkat): MK-056 channel history fetch + scrollback`.

**Acceptance:** Cold third member loads full ordered backlog from a lone host; no-host state is honest.

---

## Task 8 (MK-057): Offline delivery via mailbox

**Files:** Modify `ChatProvider`/session wiring to seal undelivered messages into the MK-033 v2 mailbox; Test: extend `channel-chat-session.test.ts`.

**Build:** When a recipient is offline, messages park in the mailbox (sealed, no cleartext ids — MK-033 v2) and drain on reconnect into the ordered log.

- [x] Step 1: Failing test: a member offline during a burst receives every message in order after reconnect; TTL purge respected.
- [x] Step 2: Run; fails.
- [x] Step 3: Wire mailbox seal/drain for channel messages.
- [x] Step 4: Run; pass.
- [x] Step 5: Commit `feat(meerkat): MK-057 offline channel-message delivery via mailbox`.

**Acceptance:** Offline member catches up in order; TTL respected.

---

## Task 9 (MK-058): Read state + unread counts

**Files:** Modify `community-core` (`cm_read_state` helpers), `ChatProvider`, `communities.tsx` (badges), channel screen (mark-read).

**Build:** `cm_read_state` (personal_replica) tracks last-read HLC per channel and syncs across the user's own devices (never to the group). Unread = count of messages with HLC > last-read. Mark-read on view.

- [x] Step 1: Failing test (Node): reading on one db advances last-read; unread count derives correctly; read-state row is personal_replica and not sent over shared-workspace sessions.
- [x] Step 2: Run; fails.
- [x] Step 3: Implement read-state helpers + unread derivation + UI badges.
- [x] Step 4: Run app tests + typecheck.
- [x] Step 5: Commit `feat(meerkat): MK-058 read state + unread counts`.

**Acceptance:** Reading on phone clears the laptop badge after a personal-sync session; read state never leaks to the group.

---

## M7 Done Gate

- [x] `cd packages/sync && pnpm test` green; `cd packages/meerkat-relay && pnpm test` green; `pnpm --filter @mylife/meerkat-app test` + `typecheck` green.
- [x] `pnpm gate:function:changed` exit 0; `node scripts/check-meerkat-parity.mjs` green.
- [ ] Exit demo verified: two devices post in two channels, ordered on both; third member loads host history; image attachment renders; no-host state honest.
- [x] Update `memory.md` + a session log; update `apps/meerkat/CLAUDE.md` table-prefix list with `cm_` and the honesty note (messaging now LIVE).

## Self-Review Notes

- **Spec coverage:** MK-050..058 each map to a task above; the M7 exit demo maps to Tasks 2/3/5/7.
- **Type consistency:** `ChannelMessageEvent`, `Hlc`, `compareChannelMessages`, `nextHlc`, `channelMessageId`, `COMMUNITY_MODULE_ID`/`COMMUNITY_PREFIX`/`COMMUNITY_SYNC_POLICY`/`COMMUNITY_DDL` are defined in Tasks 1-2 and reused by name throughout.
- **Honesty boundary:** Tasks 3/7 explicitly gate "sending"/"partial history" states; no message shown delivered without a recorded event; no-host history labeled.
- **Reuses, not reinvents:** rides `evaluateChannelPost`, signed batches, frame envelope, `applyReceivedDocumentChanges`, `filterForSync` (M7 inherits the 2026-06-12 hardening), `blob-transfer`, `community-catalog`, `MeerkatSeederNode`, `deriveEpochContentKey`.
