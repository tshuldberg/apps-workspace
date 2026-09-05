import { describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import { createChannelMessage, createCommunity, generateDeviceIdentity } from '@mylife/sync';
import { importChannelHistoryManifest } from '../channel-history-import';
import { getFeedCursor, listChannelMessageEvents, storeOwnedCommunity } from '../meerkat-data';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';

const NOW = '2026-07-15T12:00:00.000Z';

function manifest(infoHash = 'catalog-1') {
  return {
    infoHash,
    title: 'History',
    description: '',
    creator: { publicKey: 'owner', displayName: 'Owner', signature: 'signature' },
    files: [],
    pieceLength: 1024,
    pieces: [],
    totalSize: 0,
    merkleRoot: 'root',
    access: 'encrypted',
    tags: [],
    category: 'other',
    createdAt: NOW,
    version: 1,
    trackers: [],
    webSeeds: ['http://plaintext.example', 'https://seed.example'],
  };
}

function fixture() {
  const database = createInMemoryTestDatabase();
  ensureSyncSchema(database.adapter);
  ensureMeerkatTables(database.adapter);
  const owner = generateDeviceIdentity('Manual history owner');
  const community = createCommunity(owner, {
    name: 'Manual history', channels: [{ id: 'general', name: 'General' }], now: NOW,
  });
  storeOwnedCommunity(database.adapter, owner, community, NOW);
  const event = createChannelMessage(owner, {
    communityId: community.descriptor.communityId,
    channelId: 'general',
    body: 'Imported manually',
    hlc: { wall: '2026-07-15T12:01:00.000Z', counter: 0 },
  });
  return { database, owner, community, event };
}

describe('importChannelHistoryManifest', () => {
  it('rejects malformed and cross-catalog manifests before any fetch', async () => {
    const f = fixture();
    const fetchHistory = vi.fn();
    await expect(importChannelHistoryManifest({
      db: f.database.adapter, identity: f.owner, communityId: f.community.descriptor.communityId,
      channelId: 'general', manifestJson: '{', hosts: [], expectedCatalogCid: null,
      fetchHistory: fetchHistory as never,
    })).resolves.toMatchObject({ ok: false, reason: 'invalid_manifest' });
    await expect(importChannelHistoryManifest({
      db: f.database.adapter, identity: f.owner, communityId: f.community.descriptor.communityId,
      channelId: 'general', manifestJson: JSON.stringify(manifest()), hosts: [],
      expectedCatalogCid: 'another-catalog', fetchHistory: fetchHistory as never,
    })).resolves.toMatchObject({ ok: false, reason: 'catalog_mismatch' });
    expect(fetchHistory).not.toHaveBeenCalled();
    f.database.close();
  });

  it('filters plaintext seeds and atomically merges a fully verified result', async () => {
    const f = fixture();
    const fetchHistory = vi.fn(async (input: { hosts?: readonly string[]; manifest: { webSeeds: string[] } }) => {
      expect(input.hosts).toEqual(['https://extra.example']);
      expect(input.manifest.webSeeds).toEqual(['https://seed.example']);
      return {
        ok: true as const,
        snapshot: {} as never,
        events: [f.event],
        mergedEvents: [f.event],
        importedCount: 1,
        fetchedPieces: [],
        failedPieces: [],
      };
    });
    const result = await importChannelHistoryManifest({
      db: f.database.adapter, identity: f.owner, communityId: f.community.descriptor.communityId,
      channelId: 'general', manifestJson: JSON.stringify(manifest()),
      hosts: ['http://extra-plain.example', 'https://extra.example'],
      expectedCatalogCid: 'catalog-1', fetchHistory: fetchHistory as never, now: NOW,
    });
    expect(result).toMatchObject({ ok: true, inserted: 1 });
    expect(listChannelMessageEvents(f.database.adapter, f.community.descriptor.communityId, 'general'))
      .toHaveLength(1);
    expect(getFeedCursor(f.database.adapter, f.community.descriptor.communityId, 'general')).toEqual(f.event.hlc);
    f.database.close();
  });

  it('rolls back all local writes when cursor persistence fails', async () => {
    const f = fixture();
    f.database.adapter.execute(`CREATE TRIGGER reject_manual_cursor BEFORE INSERT ON cm_feed_cursor
      BEGIN SELECT RAISE(ABORT, 'forced rollback'); END`);
    const fetchHistory = vi.fn(async () => ({
      ok: true as const,
      snapshot: {} as never,
      events: [f.event],
      mergedEvents: [f.event],
      importedCount: 1,
      fetchedPieces: [],
      failedPieces: [],
    }));
    await expect(importChannelHistoryManifest({
      db: f.database.adapter, identity: f.owner, communityId: f.community.descriptor.communityId,
      channelId: 'general', manifestJson: JSON.stringify(manifest()), hosts: ['https://seed.example'],
      expectedCatalogCid: 'catalog-1', fetchHistory: fetchHistory as never, now: NOW,
    })).rejects.toThrow('forced rollback');
    expect(listChannelMessageEvents(f.database.adapter, f.community.descriptor.communityId, 'general')).toEqual([]);
    expect(getFeedCursor(f.database.adapter, f.community.descriptor.communityId, 'general')).toBeNull();
    f.database.close();
  });
});
