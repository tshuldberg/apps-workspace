import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createChannelMessage } from '../protocol/channel-message';
import {
  buildChannelHistory,
  channelHistorySnapshotId,
  fetchChannelHistory,
  mergeChannelHistoryEvents,
  parseChannelHistory,
  verifyChannelHistorySnapshot,
  type BuildChannelHistoryInput,
  type ParseChannelHistoryInput,
} from '../protocol/channel-history';
import { deriveEpochContentKey } from '../protocol/group-keys';
import { verifyCatalogPiece } from '../torrent/community-catalog';
import { verifyManifest } from '../torrent/manifest';

const COMMUNITY = 'community-1';
const CHANNEL = 'general';
const WORKSPACE = 'community';
const EPOCH = 3;
const GROUP_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1));
const WRONG_GROUP_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => 255 - index));
const SEAL_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => (index * 7 + 11) & 0xff));
const WRONG_SEAL_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => (index * 3 + 5) & 0xff));

function buildMessages() {
  const author = generateDeviceIdentity('Author');
  const first = createChannelMessage(author, {
    communityId: COMMUNITY,
    channelId: CHANNEL,
    body: 'first',
    hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
  });
  const second = createChannelMessage(author, {
    communityId: COMMUNITY,
    channelId: CHANNEL,
    body: 'photo',
    attachments: [{
      id: 'att-1',
      blobHash: 'a'.repeat(128),
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 4097,
    }],
    hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
  });

  return { author, first, second };
}

describe('channel history snapshots (MK-055)', () => {
  it('builds signed encrypted catalog pieces and parses ordered events', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();

    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [second, first],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 96,
    });

    expect(history.pieces.length).toBeGreaterThan(1);
    expect(verifyManifest(history.catalog.manifest)).toBe(true);
    expect(history.snapshot.snapshotId).toBe(channelHistorySnapshotId(history.snapshot));
    expect(verifyChannelHistorySnapshot(history.snapshot)).toBe(true);
    expect(history.snapshot.events.map((event) => event.id)).toEqual([first.id, second.id]);
    history.pieces.forEach((piece, index) => {
      expect(verifyCatalogPiece(history.catalog.manifest, index, piece)).toBe(true);
    });

    const parsed = parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: history.pieces,
      groupKey: GROUP_KEY,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.snapshotId).toBe(history.snapshot.snapshotId);
      expect(parsed.events).toEqual([first, second]);
    }
  });

  it('fails closed with the wrong group key', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 128,
    });

    expect(parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: history.pieces,
      groupKey: WRONG_GROUP_KEY,
    })).toEqual({ ok: false, reason: 'decrypt_failed' });
  });

  it('rejects corrupt catalog pieces before decryption', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 96,
    });
    const corruptPieces = history.pieces.map((piece) => piece.slice());
    corruptPieces[0]![0] = corruptPieces[0]![0]! ^ 0xff;

    expect(parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: corruptPieces,
      groupKey: GROUP_KEY,
    })).toEqual({ ok: false, reason: 'bad_piece' });
  });

  it('fails closed when the snapshot signature is malformed', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 128,
    });

    expect(verifyChannelHistorySnapshot({
      ...history.snapshot,
      signature: 'not-hex',
    })).toBe(false);
  });

  it('dedupes fetched history against live events and reports no-host partial state', async () => {
    const { first, second } = buildMessages();

    expect(mergeChannelHistoryEvents([second], [first, second]).map((event) => event.id))
      .toEqual([first.id, second.id]);

    const signer = generateDeviceIdentity('Host Admin');
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 128,
    });

    const result = await fetchChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: { ...history.catalog.manifest, webSeeds: [] },
      hosts: [],
      groupKey: GROUP_KEY,
      existingEvents: [second],
    });

    expect(result).toEqual({
      ok: false,
      reason: 'no_hosts',
      mergedEvents: [second],
      failedPieces: history.catalog.manifest.pieces.map((_, index) => index),
    });
  });
});

describe('channel history injectable seal key (Plan 19 P1)', () => {
  it('round-trips through an injected non-secret sealKey', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();

    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [second, first],
      sealKey: SEAL_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 96,
    });

    const parsed = parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: history.pieces,
      sealKey: SEAL_KEY,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.snapshotId).toBe(history.snapshot.snapshotId);
      expect(parsed.events).toEqual([first, second]);
    }
  });

  it('fails closed when parsed with a different sealKey', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      sealKey: SEAL_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 128,
    });

    expect(parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: history.pieces,
      sealKey: WRONG_SEAL_KEY,
    })).toEqual({ ok: false, reason: 'decrypt_failed' });
  });

  it('regression: the EPOCH path content key equals deriveEpochContentKey (byte-for-byte)', () => {
    // A snapshot sealed via the private groupKey path must decrypt under EXACTLY
    // deriveEpochContentKey(groupKey, workspaceId, epoch). The sealKey path passes
    // its key verbatim to the cipher, so feeding that derived key as sealKey proves
    // the epoch path's content key is unchanged by this feature.
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
      pieceLength: 96,
    });

    const epochParsed = parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: history.pieces,
      groupKey: GROUP_KEY,
    });
    expect(epochParsed.ok).toBe(true);

    const equivalentSealKey = deriveEpochContentKey(GROUP_KEY, WORKSPACE, EPOCH);
    const sealParsed = parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      pieces: history.pieces,
      sealKey: equivalentSealKey,
    });

    expect(sealParsed.ok).toBe(true);
    if (epochParsed.ok && sealParsed.ok) {
      expect(sealParsed.events).toEqual(epochParsed.events);
      expect(sealParsed.snapshot.snapshotId).toBe(epochParsed.snapshot.snapshotId);
    }
  });

  // SealKeyChoice blocks neither/both at compile time; these casts exercise the
  // runtime assertExactlyOneSealKey defense-in-depth (e.g. a JS / cast caller).
  it('throws when neither groupKey nor sealKey is supplied (build + parse)', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();

    expect(() => buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
    } as unknown as BuildChannelHistoryInput)).toThrow(/exactly one of groupKey or sealKey/);

    const valid = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      sealKey: SEAL_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
    });

    expect(() => parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: valid.catalog.manifest,
      pieces: valid.pieces,
    } as unknown as ParseChannelHistoryInput)).toThrow(/exactly one of groupKey or sealKey/);
  });

  it('throws when both groupKey and sealKey are supplied (build + parse)', () => {
    const signer = generateDeviceIdentity('Host Admin');
    const { first, second } = buildMessages();

    expect(() => buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      groupKey: GROUP_KEY,
      sealKey: SEAL_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
    } as unknown as BuildChannelHistoryInput)).toThrow(/exactly one of groupKey or sealKey/);

    const valid = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [first, second],
      sealKey: SEAL_KEY,
      signer,
      createdAt: '2026-06-13T00:01:00.000Z',
    });

    expect(() => parseChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: valid.catalog.manifest,
      pieces: valid.pieces,
      groupKey: GROUP_KEY,
      sealKey: SEAL_KEY,
    } as unknown as ParseChannelHistoryInput)).toThrow(/exactly one of groupKey or sealKey/);
  });
});
