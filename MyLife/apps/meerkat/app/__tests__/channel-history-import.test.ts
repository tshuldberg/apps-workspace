import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  buildChannelHistory,
  createChannelMessage,
  createGroupCommit,
  createSyncTables,
  generateDeviceIdentity,
} from '@mylife/sync';
import {
  ensureCommunityTables,
  listChannelMessages,
} from '../(root)/data/community-core';
import {
  fetchAndImportChannelHistory,
  httpHistorySeeds,
  parseChannelHistoryManifestJson,
} from '../(root)/data/channel-history-import';

const COMMUNITY = 'community-1';
const CHANNEL = 'general';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureCommunityTables(db.adapter);
});

afterEach(() => {
  db.close();
});

function createCommunityWorkspace(ownerDeviceId: string): void {
  db.adapter.execute(
    `INSERT INTO sync_workspaces (
      id, display_name, workspace_type, created_by_device_id,
      created_at, rotated_at, current_key_version, archived_at
    ) VALUES (?, ?, 'community', ?, ?, NULL, 0, NULL)`,
    [COMMUNITY, 'Community', ownerDeviceId, '2026-06-14T00:00:00.000Z'],
  );
}

function injectedFetch(pieces: readonly Uint8Array[]): typeof fetch {
  return (async (url: string) => {
    const match = /\/[0-9a-f]+\/(\d+)$/.exec(String(url));
    const piece = match ? pieces[Number(match[1])] : undefined;
    if (!piece) {
      return {
        ok: false,
        status: 404,
        statusText: 'not found',
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => piece.buffer.slice(piece.byteOffset, piece.byteOffset + piece.byteLength),
    };
  }) as unknown as typeof fetch;
}

describe('channel history manifest parsing', () => {
  it('filters non-HTTP seeds and dedupes candidates', () => {
    expect(httpHistorySeeds([
      ' ws://relay.example ',
      'https://host.example',
      'https://host.example',
      'http://backup.example',
      '',
    ])).toEqual(['https://host.example', 'http://backup.example']);
  });

  it('rejects empty, malformed, and non-manifest JSON', () => {
    expect(parseChannelHistoryManifestJson('')).toEqual({ ok: false, reason: 'empty_manifest' });
    expect(parseChannelHistoryManifestJson('{')).toEqual({ ok: false, reason: 'invalid_json' });
    expect(parseChannelHistoryManifestJson('{"infoHash":"x"}')).toEqual({
      ok: false,
      reason: 'invalid_manifest',
    });
  });
});

describe('fetchAndImportChannelHistory', () => {
  it('fetches a signed encrypted history snapshot and imports new events', async () => {
    const member = generateDeviceIdentity('Member');
    const host = generateDeviceIdentity('Host');
    const author = generateDeviceIdentity('Author');
    createCommunityWorkspace(member.publicKey);
    const epoch = createGroupCommit(db.adapter, {
      workspaceId: COMMUNITY,
      committer: member,
      members: [{ deviceId: member.publicKey, dhPublicKey: member.dhPublicKey }],
      now: '2026-06-14T00:00:01.000Z',
    });
    const first = createChannelMessage(author, {
      communityId: COMMUNITY,
      channelId: CHANNEL,
      body: 'first from host',
      hlc: { wall: '2026-06-14T00:01:00.000Z', counter: 0 },
    });
    const second = createChannelMessage(author, {
      communityId: COMMUNITY,
      channelId: CHANNEL,
      body: 'second from host',
      hlc: { wall: '2026-06-14T00:02:00.000Z', counter: 0 },
    });
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: COMMUNITY,
      epoch: epoch.epoch,
      events: [second, first],
      groupKey: epoch.secret,
      signer: host,
      createdAt: '2026-06-14T00:03:00.000Z',
      pieceLength: 256,
      webSeeds: ['https://host.example'],
    });

    const result = await fetchAndImportChannelHistory({
      db: db.adapter,
      identity: member,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifestJson: JSON.stringify(history.catalog.manifest),
      expectedCatalogCid: history.catalog.manifest.infoHash,
      fetchFn: injectedFetch(history.pieces),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inserted).toBe(2);
      expect(result.importedEvents.map((event) => event.body)).toEqual([
        'first from host',
        'second from host',
      ]);
    }
    expect(listChannelMessages(db.adapter, COMMUNITY, CHANNEL).map((event) => event.body))
      .toEqual(['first from host', 'second from host']);
  });

  it('fails honestly when this device has no current community group key', async () => {
    const member = generateDeviceIdentity('Member');
    const host = generateDeviceIdentity('Host');
    createCommunityWorkspace(member.publicKey);
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: COMMUNITY,
      epoch: 1,
      events: [],
      groupKey: new Uint8Array(32).fill(7),
      signer: host,
      pieceLength: 256,
      webSeeds: ['https://host.example'],
    });

    await expect(fetchAndImportChannelHistory({
      db: db.adapter,
      identity: member,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifestJson: JSON.stringify(history.catalog.manifest),
      fetchFn: injectedFetch(history.pieces),
    })).resolves.toMatchObject({
      ok: false,
      reason: 'no_key',
    });
  });

  it('reports no_hosts when only relay-style hosts are available', async () => {
    const member = generateDeviceIdentity('Member');
    const host = generateDeviceIdentity('Host');
    createCommunityWorkspace(member.publicKey);
    const epoch = createGroupCommit(db.adapter, {
      workspaceId: COMMUNITY,
      committer: member,
      members: [{ deviceId: member.publicKey, dhPublicKey: member.dhPublicKey }],
      now: '2026-06-14T00:00:01.000Z',
    });
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: COMMUNITY,
      epoch: epoch.epoch,
      events: [],
      groupKey: epoch.secret,
      signer: host,
      pieceLength: 256,
      webSeeds: ['ws://relay.example'],
    });

    await expect(fetchAndImportChannelHistory({
      db: db.adapter,
      identity: member,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifestJson: JSON.stringify(history.catalog.manifest),
      hosts: ['ws://descriptor-host.example'],
      fetchFn: injectedFetch(history.pieces),
    })).resolves.toMatchObject({
      ok: false,
      reason: 'no_hosts',
    });
  });
});
