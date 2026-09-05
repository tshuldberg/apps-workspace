/**
 * Community feed P6 hardening for the snapshot layer.
 *
 *  - ITEM 4: snapshot size cap as an HONEST signal. A snapshot over the configured
 *    byte/piece cap is STILL built + stored in full (never truncated, so the
 *    cold-start pull stays correct), but flagged `oversized: true` and surfaced via
 *    the result.oversized array + the log hook. A snapshot under the cap is not.
 *
 *  - ITEM 5: removal + re-snapshot forward secrecy, end to end. After
 *    commitMemberRemoval mints a NEW epoch (the removed device holds no wrap for
 *    it), the owner re-runs buildCommunitySnapshots: the new snapshot is sealed
 *    under the NEW epoch; a CURRENT member opens it; the REMOVED member (with only
 *    the OLD epoch key) gets decrypt_failed. This composes the P0 removal primitive
 *    with the P1 snapshot primitive with no new production code.
 *
 * Everything is real: real Ed25519/X25519 identities, real epoch group keys
 * (createGroupCommit / commitMemberRemoval + per-member wraps distributed
 * device-to-device), real signed ChannelMessageEvents sealed into a snapshot.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createWorkspace, getKeyWraps } from '../db/queries';
import {
  commitMemberRemoval,
  createGroupCommit,
  getCurrentEpochKey,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
  type GroupMemberKey,
} from '../protocol/group-keys';
import { createChannelMessage, type ChannelMessageEvent } from '../protocol/channel-message';
import type { DeviceIdentity } from '../types';
import {
  buildCommunitySnapshots,
  importSnapshotFromPieces,
  type CommunitySnapshotRecord,
  type SnapshotPieceStore,
} from '../protocol/community-snapshots';
import type { ContentManifest } from '../types';

const COMMUNITY = 'feed-club-p6';
const CHANNEL = 'general';
const NOW = '2026-06-16T00:00:00.000Z';

/** A trivial in-memory piece store (the sync package has only the interface). */
class MapPieceStore implements SnapshotPieceStore {
  private readonly pieces = new Map<string, Uint8Array>();
  private key(infoHash: string, index: number): string { return `${infoHash}:${index}`; }
  put(infoHash: string, index: number, bytes: Uint8Array): void { this.pieces.set(this.key(infoHash, index), bytes); }
  get(infoHash: string, index: number): Uint8Array | null { return this.pieces.get(this.key(infoHash, index)) ?? null; }
  removeContent(infoHash: string): void {
    for (const k of [...this.pieces.keys()]) if (k.startsWith(`${infoHash}:`)) this.pieces.delete(k);
  }
}

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  createWorkspace(db.adapter, {
    id: COMMUNITY, displayName: 'Feed Club', workspaceType: 'community',
    createdByDeviceId: 'owner', createdAt: NOW, rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  return db;
}

const memberKey = (m: DeviceIdentity): GroupMemberKey => ({ deviceId: m.publicKey, dhPublicKey: m.dhPublicKey });

function distributeWraps(from: InMemoryTestDatabase, to: InMemoryTestDatabase, epoch: number, deviceId: string): void {
  for (const wrap of getKeyWraps(from.adapter, COMMUNITY, epoch)) {
    if (wrap.wrappedForDeviceId === deviceId) storeReceivedKeyWrap(to.adapter, wrap);
  }
}

function postMessage(author: DeviceIdentity, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId: COMMUNITY, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

let dbs: InMemoryTestDatabase[] = [];
afterEach(() => { for (const db of dbs) db.close(); dbs = []; });

describe('community feed P6 item 4: snapshot size cap (honest signal, never truncate)', () => {
  it('flags a snapshot over the cap oversized + logs it, but still builds it in full', async () => {
    const owner = generateDeviceIdentity('Owner');
    const ownerDb = freshDb();
    dbs.push(ownerDb);
    createGroupCommit(ownerDb.adapter, { workspaceId: COMMUNITY, committer: owner, members: [memberKey(owner)], now: NOW });

    const events = Array.from({ length: 5 }, (_, i) => postMessage(owner, `message ${i}`, `2026-06-16T00:00:1${i}.000Z`));

    const store = new MapPieceStore();
    const logged: Array<{ event: string; bytes: number }> = [];
    const result = await buildCommunitySnapshots({
      db: ownerDb.adapter,
      identity: owner,
      communityId: COMMUNITY,
      channels: [{ channelId: CHANNEL, events }],
      pieceStore: store,
      // Force the cap to trip: a 1-byte ceiling is below any real snapshot.
      maxSnapshotBytes: 1,
      log: (event, detail) => logged.push({ event, bytes: detail.totalBytes }),
      now: NOW,
    });

    expect(result.records).toHaveLength(1);
    const record = result.records[0]!;
    // Built in FULL: every event is in the snapshot, and the pieces are stored.
    expect(record.eventCount).toBe(5);
    expect(record.totalBytes!).toBeGreaterThan(1);
    expect(store.get(record.infoHash, 0)).not.toBeNull();
    // HONEST signal: flagged oversized, surfaced on the result, and logged once.
    expect(record.oversized).toBe(true);
    expect(result.oversized).toHaveLength(1);
    expect(result.oversized[0]).toMatchObject({ channelId: CHANNEL, infoHash: record.infoHash, maxBytes: 1 });
    expect(logged).toEqual([{ event: 'snapshot_oversized', bytes: record.totalBytes }]);

    // The stored pieces still decrypt with the epoch key (not corrupted by the flag).
    const epochKey = getCurrentEpochKey(ownerDb.adapter, COMMUNITY, owner)!;
    const manifest = JSON.parse(record.manifestJson) as ContentManifest;
    const imported = await importSnapshotFromPieces({
      communityId: COMMUNITY, channelId: CHANNEL, epoch: record.epoch, manifest, pieceStore: store, groupKey: epochKey.secret,
    });
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.events).toHaveLength(5);
  });

  it('does not flag a snapshot under the cap', async () => {
    const owner = generateDeviceIdentity('Owner');
    const ownerDb = freshDb();
    dbs.push(ownerDb);
    createGroupCommit(ownerDb.adapter, { workspaceId: COMMUNITY, committer: owner, members: [memberKey(owner)], now: NOW });

    const result = await buildCommunitySnapshots({
      db: ownerDb.adapter,
      identity: owner,
      communityId: COMMUNITY,
      channels: [{ channelId: CHANNEL, events: [postMessage(owner, 'tiny', '2026-06-16T00:00:10.000Z')] }],
      pieceStore: new MapPieceStore(),
      maxSnapshotBytes: 8 * 1024 * 1024,
      maxSnapshotPieces: 4096,
      now: NOW,
    });
    expect(result.records[0]!.oversized).toBe(false);
    expect(result.oversized).toHaveLength(0);
  });
});

describe('community feed P6 item 5: removal + re-snapshot forward secrecy (end to end)', () => {
  it('a removed member cannot decrypt a snapshot re-sealed under the new epoch; a current member can', async () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const removed = generateDeviceIdentity('Removed');
    const ownerDb = freshDb();
    const memberDb = freshDb();
    const removedDb = freshDb();
    dbs.push(ownerDb, memberDb, removedDb);

    // Epoch 1: owner + member + removed all hold a wrap.
    const e1 = createGroupCommit(ownerDb.adapter, {
      workspaceId: COMMUNITY, committer: owner, members: [owner, member, removed].map(memberKey), now: NOW,
    });
    distributeWraps(ownerDb, memberDb, e1.epoch, member.publicKey);
    distributeWraps(ownerDb, removedDb, e1.epoch, removed.publicKey);

    // Owner authors + snapshots an OLD-epoch feed (sanity: the removed member CAN
    // open this one -- it predates the removal).
    const storeOld = new MapPieceStore();
    const oldBuilt = await buildCommunitySnapshots({
      db: ownerDb.adapter, identity: owner, communityId: COMMUNITY,
      channels: [{ channelId: CHANNEL, events: [postMessage(owner, 'pre-removal', '2026-06-16T00:00:10.000Z')] }],
      pieceStore: storeOld, now: NOW,
    });
    const oldRecord = oldBuilt.records[0]!;
    const removedOldKey = unwrapEpochSecret(removedDb.adapter, COMMUNITY, e1.epoch, removed)!;
    const oldOpen = await importSnapshotFromPieces({
      communityId: COMMUNITY, channelId: CHANNEL, epoch: oldRecord.epoch,
      manifest: JSON.parse(oldRecord.manifestJson) as ContentManifest, pieceStore: storeOld, groupKey: removedOldKey,
    });
    expect(oldOpen.ok).toBe(true); // the removed member legitimately had epoch-1 access

    // REMOVAL: a new epoch wrapped for everyone EXCEPT the removed device (P0).
    const e2 = commitMemberRemoval(ownerDb.adapter, {
      workspaceId: COMMUNITY, committer: owner,
      members: [owner, member, removed].map(memberKey),
      removedDeviceId: removed.publicKey,
      now: '2026-06-16T00:01:00.000Z',
    });
    distributeWraps(ownerDb, memberDb, e2.epoch, member.publicKey);
    expect(e2.epoch).toBeGreaterThan(e1.epoch);

    // Owner re-runs buildCommunitySnapshots: it seals under the CURRENT (new) epoch.
    const storeNew = new MapPieceStore();
    const newBuilt = await buildCommunitySnapshots({
      db: ownerDb.adapter, identity: owner, communityId: COMMUNITY,
      channels: [{ channelId: CHANNEL, events: [postMessage(owner, 'post-removal secret', '2026-06-16T00:01:10.000Z')] }],
      pieceStore: storeNew, previous: [oldRecord as CommunitySnapshotRecord], now: '2026-06-16T00:01:10.000Z',
    });
    const newRecord = newBuilt.records[0]!;
    expect(newRecord.epoch).toBe(e2.epoch); // sealed under the NEW epoch

    const newManifest = JSON.parse(newRecord.manifestJson) as ContentManifest;

    // A CURRENT member (holds the new epoch wrap) opens the new snapshot.
    const memberNewKey = unwrapEpochSecret(memberDb.adapter, COMMUNITY, e2.epoch, member)!;
    const memberOpen = await importSnapshotFromPieces({
      communityId: COMMUNITY, channelId: CHANNEL, epoch: newRecord.epoch, manifest: newManifest, pieceStore: storeNew, groupKey: memberNewKey,
    });
    expect(memberOpen.ok).toBe(true);
    if (memberOpen.ok) expect(memberOpen.events.map((e) => e.body)).toEqual(['post-removal secret']);

    // The REMOVED member holds NO new-epoch wrap. unwrapEpochSecret returns null;
    // trying the snapshot with the only key it has (the OLD epoch secret) fails
    // closed: decrypt_failed. Forward secrecy holds end to end.
    expect(unwrapEpochSecret(removedDb.adapter, COMMUNITY, e2.epoch, removed)).toBeNull();
    const removedOpen = await importSnapshotFromPieces({
      communityId: COMMUNITY, channelId: CHANNEL, epoch: newRecord.epoch, manifest: newManifest, pieceStore: storeNew, groupKey: removedOldKey,
    });
    expect(removedOpen.ok).toBe(false);
    if (!removedOpen.ok) expect(removedOpen.reason).toBe('decrypt_failed');
  });
});
