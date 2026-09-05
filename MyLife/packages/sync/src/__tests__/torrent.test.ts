import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishContent, generateMagnetUri } from '../torrent/publisher';
import { TorrentDownloader } from '../torrent/downloader';
import { SeedingEngine } from '../torrent/seeder';
import { SwarmManager } from '../torrent/swarm-manager';
import { WebSeedClient } from '../torrent/web-seed';
import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '../identity/device-identity';
import { createHash } from 'crypto';
import type { ContentManifest, TransportConnection } from '../types';

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const mockDb = {
  execute: vi.fn(),
  query: vi.fn().mockReturnValue([]),
  transaction: vi.fn((fn: Function) => fn()),
} as any;

function createMockConnection(remoteDeviceId: string): TransportConnection {
  return {
    id: `conn_${remoteDeviceId}`,
    remoteDeviceId,
    transport: 'lan',
    send: vi.fn().mockResolvedValue(undefined),
    onData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

const identity = generateDeviceIdentity('TestUser');
const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);

const sampleFile = {
  path: 'test.txt',
  data: new TextEncoder().encode('test content for torrent'),
  mimeType: 'text/plain',
};

/** Build a minimal valid ContentManifest for test purposes. */
function buildMockManifest(overrides: Partial<ContentManifest> = {}): ContentManifest {
  const data = new TextEncoder().encode('mock piece data');
  const pieceHash = createHash('sha256').update(data).digest('hex');

  return {
    infoHash: 'abc123def456',
    title: 'Test Torrent',
    description: 'A test torrent',
    creator: {
      publicKey: identity.publicKey,
      displayName: 'TestUser',
      signature: 'ff'.repeat(64),
    },
    files: [{ path: 'test.txt', size: data.length, hash: pieceHash, mimeType: 'text/plain' }],
    pieceLength: 256 * 1024,
    pieces: [pieceHash],
    totalSize: data.length,
    merkleRoot: pieceHash,
    access: 'public',
    tags: ['test'],
    category: 'other',
    createdAt: new Date().toISOString(),
    version: 1,
    trackers: ['wss://tracker.mylife.app'],
    webSeeds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// publishContent
// ---------------------------------------------------------------------------

describe('publishContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a manifest and returns shareable links', () => {
    const result = publishContent({
      db: mockDb,
      title: 'Published Content',
      description: 'A published test',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: ['test'],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    expect(result.manifest).toBeDefined();
    expect(result.manifest.title).toBe('Published Content');
    expect(result.infoHash).toBe(result.manifest.infoHash);
    expect(result.shareLink).toBe(`https://share.mylife.app/t/${result.infoHash}`);
    expect(result.deepLink).toBe(`mylife://t/${result.infoHash}`);
  });

  it('calls insertPublishedContent on the database', () => {
    publishContent({
      db: mockDb,
      title: 'DB Test',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('passes content key when provided', () => {
    const result = publishContent({
      db: mockDb,
      title: 'Encrypted Content',
      description: '',
      files: [sampleFile],
      access: 'encrypted',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
      contentKey: 'secret_key_123',
    });

    expect(result.manifest).toBeDefined();
  });
});

describe('generateMagnetUri', () => {
  it('generates a valid magnet URI', () => {
    const manifest = buildMockManifest();
    const uri = generateMagnetUri(manifest);
    expect(uri).toContain('magnet:?');
    // URLSearchParams encodes colons, so check the encoded form
    expect(uri).toContain(encodeURIComponent(`urn:mylife:${manifest.infoHash}`));
    expect(uri).toContain(encodeURIComponent(manifest.trackers[0]!));
  });
});

// ---------------------------------------------------------------------------
// TorrentDownloader
// ---------------------------------------------------------------------------

describe('TorrentDownloader', () => {
  let manifest: ContentManifest;

  beforeEach(() => {
    vi.clearAllMocks();
    manifest = buildMockManifest();
  });

  it('constructor creates a downloader in idle state', () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    const progress = dl.getProgress();
    expect(progress.state).toBe('idle');
    expect(progress.totalPieces).toBe(manifest.pieces.length);
    expect(progress.completedPieces).toBe(0);
    expect(progress.totalBytes).toBe(manifest.totalSize);
  });

  it('getProgress returns correct structure', () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    const progress = dl.getProgress();
    expect(progress).toHaveProperty('state');
    expect(progress).toHaveProperty('totalPieces');
    expect(progress).toHaveProperty('completedPieces');
    expect(progress).toHaveProperty('totalBytes');
    expect(progress).toHaveProperty('downloadedBytes');
    expect(progress).toHaveProperty('progress');
    expect(progress).toHaveProperty('peers');
    expect(progress).toHaveProperty('downloadSpeedBps');
  });

  it('start() transitions to downloading state', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    await dl.start();
    expect(dl.getProgress().state).toBe('downloading');
  });

  it('pause() transitions to paused state', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    await dl.start();
    dl.pause();
    expect(dl.getProgress().state).toBe('paused');
  });

  it('resume() transitions back to downloading from paused', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    await dl.start();
    dl.pause();
    dl.resume();
    expect(dl.getProgress().state).toBe('downloading');
  });

  it('resume() does nothing if not paused', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    // In idle state, resume should not change to downloading
    dl.resume();
    expect(dl.getProgress().state).toBe('idle');
  });

  it('cancel() transitions to idle and clears connections', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    await dl.start();
    const conn = createMockConnection('peer1');
    dl.addPeer(conn);

    await dl.cancel();
    expect(dl.getProgress().state).toBe('idle');
    expect(dl.getProgress().peers).toBe(0);
    expect(conn.close).toHaveBeenCalled();
  });

  it('addPeer and removePeer update peer count', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    const conn = createMockConnection('peer1');
    dl.addPeer(conn);
    expect(dl.getProgress().peers).toBe(1);

    dl.removePeer('peer1');
    expect(dl.getProgress().peers).toBe(0);
  });

  it('receivePiece verifies and records a valid piece', () => {
    const pieceData = new TextEncoder().encode('mock piece data');
    const pieceHash = createHash('sha256').update(pieceData).digest('hex');

    const singlePieceManifest = buildMockManifest({ pieces: [pieceHash] });
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest: singlePieceManifest,
      storagePath: '/tmp/download',
    });

    const result = dl.receivePiece(0, pieceData);
    expect(result).toBe(true);
    expect(dl.getProgress().completedPieces).toBe(1);
    expect(dl.isComplete()).toBe(true);
  });

  it('receivePiece rejects invalid piece data', () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    const result = dl.receivePiece(0, new TextEncoder().encode('wrong data'));
    expect(result).toBe(false);
    expect(dl.getProgress().completedPieces).toBe(0);
  });

  it('onProgress notifies listeners on state changes', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    const listener = vi.fn();
    const unsub = dl.onProgress(listener);

    await dl.start();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'downloading' }),
    );

    unsub();
    dl.pause();
    // After unsubscribe, listener should not have been called again for pause
    const callCountAfterUnsub = listener.mock.calls.length;
    expect(callCountAfterUnsub).toBeGreaterThan(0);
  });

  it('getWantedPieces delegates to piece manager', () => {
    const twoHashManifest = buildMockManifest({
      pieces: ['hash_a', 'hash_b'],
    });
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest: twoHashManifest,
      storagePath: '/tmp/download',
    });

    const wanted = dl.getWantedPieces(5);
    expect(wanted).toEqual([0, 1]);
  });

  it('start() is idempotent while downloading', async () => {
    const dl = new TorrentDownloader({
      db: mockDb,
      manifest,
      storagePath: '/tmp/download',
    });

    await dl.start();
    await dl.start(); // should not throw or change state
    expect(dl.getProgress().state).toBe('downloading');
  });
});

// ---------------------------------------------------------------------------
// SeedingEngine
// ---------------------------------------------------------------------------

describe('SeedingEngine', () => {
  const defaultPolicy = {
    enabled: true,
    maxUploadKbps: 1000,
    maxSeedStorageMB: 500,
    autoDeleteDays: 30,
    seedOnCellular: false,
    seedWhileCharging: false,
    updatedAt: new Date().toISOString(),
  };

  it('startSeeding adds an entry', () => {
    const engine = new SeedingEngine(defaultPolicy);
    engine.startSeeding({
      infoHash: 'hash1',
      title: 'Test',
      totalSize: 1024,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    expect(engine.getEntries()).toHaveLength(1);
    expect(engine.getEntry('hash1')).toBeDefined();
    expect(engine.getEntry('hash1')!.isActive).toBe(true);
  });

  it('startSeeding skips when policy is disabled', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, enabled: false });
    engine.startSeeding({
      infoHash: 'hash1',
      title: 'Test',
      totalSize: 1024,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    expect(engine.getEntries()).toHaveLength(0);
  });

  it('startSeeding respects storage limit', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, maxSeedStorageMB: 1 });

    // Add entry that takes up ~2MB (exceeds 1MB limit)
    engine.startSeeding({
      infoHash: 'big',
      title: 'Big',
      totalSize: 2 * 1024 * 1024,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    expect(engine.getEntries()).toHaveLength(0);
  });

  it('stopSeeding marks entry as inactive', () => {
    const engine = new SeedingEngine(defaultPolicy);
    engine.startSeeding({
      infoHash: 'hash1',
      title: 'Test',
      totalSize: 1024,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    engine.stopSeeding('hash1');
    expect(engine.getEntry('hash1')!.isActive).toBe(false);
    expect(engine.getActiveEntries()).toHaveLength(0);
  });

  it('removeSeed deletes the entry entirely', () => {
    const engine = new SeedingEngine(defaultPolicy);
    engine.startSeeding({
      infoHash: 'hash1',
      title: 'Test',
      totalSize: 1024,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    engine.removeSeed('hash1');
    expect(engine.getEntries()).toHaveLength(0);
    expect(engine.getEntry('hash1')).toBeUndefined();
  });

  it('recordUpload increments bytes and peer count', () => {
    const engine = new SeedingEngine(defaultPolicy);
    engine.startSeeding({
      infoHash: 'hash1',
      title: 'Test',
      totalSize: 1024,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    engine.recordUpload('hash1', 500);
    engine.recordUpload('hash1', 300);

    const entry = engine.getEntry('hash1')!;
    expect(entry.bytesUploaded).toBe(800);
    expect(entry.peersServed).toBe(2);
    expect(engine.getTotalUploaded()).toBe(800);
  });

  it('shouldServe returns true on wifi with policy enabled', () => {
    const engine = new SeedingEngine(defaultPolicy);
    expect(engine.shouldServe({ isWifi: true, isCellular: false, isCharging: false })).toBe(true);
  });

  it('shouldServe returns false when policy is disabled', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, enabled: false });
    expect(engine.shouldServe({ isWifi: true, isCellular: false, isCharging: false })).toBe(false);
  });

  it('shouldServe returns false on cellular when seedOnCellular is false', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, seedOnCellular: false });
    expect(engine.shouldServe({ isWifi: false, isCellular: true, isCharging: false })).toBe(false);
  });

  it('shouldServe returns false when not charging and seedWhileCharging is true', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, seedWhileCharging: true });
    expect(engine.shouldServe({ isWifi: true, isCellular: false, isCharging: false })).toBe(false);
  });

  it('shouldServe returns true when charging and seedWhileCharging is true', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, seedWhileCharging: true });
    expect(engine.shouldServe({ isWifi: true, isCellular: false, isCharging: true })).toBe(true);
  });

  it('pruneExpired removes expired, non-pinned entries', () => {
    const engine = new SeedingEngine(defaultPolicy);
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

    engine.startSeeding({
      infoHash: 'expired',
      title: 'Expired',
      totalSize: 100,
      isPinned: false,
      autoDeleteAt: pastDate,
      createdAt: new Date().toISOString(),
    });
    engine.startSeeding({
      infoHash: 'pinned',
      title: 'Pinned',
      totalSize: 100,
      isPinned: true,
      autoDeleteAt: pastDate,
      createdAt: new Date().toISOString(),
    });
    engine.startSeeding({
      infoHash: 'active',
      title: 'Active',
      totalSize: 100,
      isPinned: false,
      autoDeleteAt: null,
      createdAt: new Date().toISOString(),
    });

    const pruned = engine.pruneExpired();
    expect(pruned).toEqual(['expired']);
    expect(engine.getEntries()).toHaveLength(2);
    expect(engine.getEntry('pinned')).toBeDefined();
    expect(engine.getEntry('active')).toBeDefined();
  });

  it('isWithinBandwidthLimit returns true when under limit', () => {
    const engine = new SeedingEngine(defaultPolicy);
    expect(engine.isWithinBandwidthLimit(500)).toBe(true);
  });

  it('isWithinBandwidthLimit returns true when limit is 0 (unlimited)', () => {
    const engine = new SeedingEngine({ ...defaultPolicy, maxUploadKbps: 0 });
    expect(engine.isWithinBandwidthLimit(99999)).toBe(true);
  });

  it('updatePolicy changes the active policy', () => {
    const engine = new SeedingEngine(defaultPolicy);
    const newPolicy = { ...defaultPolicy, enabled: false };
    engine.updatePolicy(newPolicy);
    expect(engine.getPolicy().enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SwarmManager
// ---------------------------------------------------------------------------

describe('SwarmManager', () => {
  it('addPeer adds a peer to the swarm', () => {
    const swarm = new SwarmManager('hash1', 3);
    const conn = createMockConnection('peer1');

    swarm.addPeer('peer1', conn);
    expect(swarm.peerCount).toBe(1);
    expect(swarm.getPeers()).toHaveLength(1);
  });

  it('removePeer removes a peer and closes its connection', async () => {
    const swarm = new SwarmManager('hash1', 3);
    const conn = createMockConnection('peer1');

    swarm.addPeer('peer1', conn);
    await swarm.removePeer('peer1');

    expect(swarm.peerCount).toBe(0);
    expect(conn.close).toHaveBeenCalled();
  });

  it('getPeersWithPiece returns peers that have a specific piece', () => {
    const swarm = new SwarmManager('hash1', 3);
    const conn1 = createMockConnection('peer1');
    const conn2 = createMockConnection('peer2');

    swarm.addPeer('peer1', conn1);
    swarm.addPeer('peer2', conn2);

    swarm.markPeerHasPiece('peer1', 0);
    swarm.markPeerHasPiece('peer2', 0);
    swarm.markPeerHasPiece('peer1', 1);

    const peersWithPiece0 = swarm.getPeersWithPiece(0);
    expect(peersWithPiece0).toHaveLength(2);

    const peersWithPiece1 = swarm.getPeersWithPiece(1);
    expect(peersWithPiece1).toHaveLength(1);
    expect(peersWithPiece1[0]!.peerId).toBe('peer1');

    const peersWithPiece2 = swarm.getPeersWithPiece(2);
    expect(peersWithPiece2).toHaveLength(0);
  });

  it('getPieceAvailability returns correct counts', () => {
    const swarm = new SwarmManager('hash1', 2);
    const conn1 = createMockConnection('peer1');
    const conn2 = createMockConnection('peer2');

    swarm.addPeer('peer1', conn1);
    swarm.addPeer('peer2', conn2);

    swarm.markPeerHasPiece('peer1', 0);
    swarm.markPeerHasPiece('peer2', 0);
    swarm.markPeerHasPiece('peer1', 1);

    const availability = swarm.getPieceAvailability();
    expect(availability.get(0)).toBe(2);
    expect(availability.get(1)).toBe(1);
  });

  it('updateBitfield replaces the peer bitfield', () => {
    const swarm = new SwarmManager('hash1', 3);
    const conn = createMockConnection('peer1');

    swarm.addPeer('peer1', conn);
    swarm.updateBitfield('peer1', [true, false, true]);

    const peersWithPiece0 = swarm.getPeersWithPiece(0);
    expect(peersWithPiece0).toHaveLength(1);

    const peersWithPiece1 = swarm.getPeersWithPiece(1);
    expect(peersWithPiece1).toHaveLength(0);

    const peersWithPiece2 = swarm.getPeersWithPiece(2);
    expect(peersWithPiece2).toHaveLength(1);
  });

  it('recordDownload updates peer bytes', () => {
    const swarm = new SwarmManager('hash1', 1);
    const conn = createMockConnection('peer1');

    swarm.addPeer('peer1', conn);
    swarm.recordDownload('peer1', 1024);

    const peers = swarm.getPeers();
    expect(peers[0]!.bytesDownloaded).toBe(1024);
  });

  it('recordUpload updates peer bytes', () => {
    const swarm = new SwarmManager('hash1', 1);
    const conn = createMockConnection('peer1');

    swarm.addPeer('peer1', conn);
    swarm.recordUpload('peer1', 2048);

    const peers = swarm.getPeers();
    expect(peers[0]!.bytesUploaded).toBe(2048);
  });

  it('seederCount tracks seeders', () => {
    const swarm = new SwarmManager('hash1', 1);
    swarm.addPeer('seeder1', createMockConnection('seeder1'), true);
    swarm.addPeer('leecher1', createMockConnection('leecher1'), false);

    expect(swarm.seederCount).toBe(1);
    expect(swarm.peerCount).toBe(2);
  });

  it('destroyAll closes all connections and clears the swarm', async () => {
    const swarm = new SwarmManager('hash1', 1);
    const conn1 = createMockConnection('peer1');
    const conn2 = createMockConnection('peer2');

    swarm.addPeer('peer1', conn1);
    swarm.addPeer('peer2', conn2);

    await swarm.destroyAll();
    expect(swarm.peerCount).toBe(0);
    expect(conn1.close).toHaveBeenCalled();
    expect(conn2.close).toHaveBeenCalled();
  });

  it('infoHash getter returns correct value', () => {
    const swarm = new SwarmManager('my_hash', 5);
    expect(swarm.infoHash).toBe('my_hash');
  });
});

// ---------------------------------------------------------------------------
// WebSeedClient
// ---------------------------------------------------------------------------

describe('WebSeedClient', () => {
  it('hasWebSeeds returns false when manifest has no web seeds', () => {
    const manifest = buildMockManifest({ webSeeds: [] });
    const client = new WebSeedClient({ manifest });
    expect(client.hasWebSeeds).toBe(false);
    expect(client.webSeedCount).toBe(0);
  });

  it('hasWebSeeds returns true when manifest has web seeds', () => {
    const manifest = buildMockManifest({
      webSeeds: ['https://seed1.example.com', 'https://seed2.example.com'],
    });
    const client = new WebSeedClient({ manifest });
    expect(client.hasWebSeeds).toBe(true);
    expect(client.webSeedCount).toBe(2);
  });

  it('downloadPiece throws when no web seeds are available', async () => {
    const manifest = buildMockManifest({ webSeeds: [] });
    const client = new WebSeedClient({ manifest });

    await expect(client.downloadPiece(0)).rejects.toThrow('No web seeds available');
  });

  it('downloadPiece throws for out-of-range piece index', async () => {
    const manifest = buildMockManifest({
      webSeeds: ['https://seed.example.com'],
    });
    const client = new WebSeedClient({ manifest });

    await expect(client.downloadPiece(99)).rejects.toThrow('out of range');
    await expect(client.downloadPiece(-1)).rejects.toThrow('out of range');
  });

  it('downloadPiece fetches data with a mock fetch function', async () => {
    const pieceData = new Uint8Array([1, 2, 3, 4]);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(pieceData.buffer),
    });

    const manifest = buildMockManifest({
      webSeeds: ['https://seed.example.com'],
    });
    const client = new WebSeedClient({
      manifest,
      fetchFn: mockFetch as any,
    });

    const data = await client.downloadPiece(0);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(pieceData.length);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify the URL includes the info hash and piece index
    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain(manifest.infoHash);
    expect(calledUrl).toContain('/0');
  });

  it('downloadPiece handles HTTP errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const manifest = buildMockManifest({
      webSeeds: ['https://seed.example.com'],
    });
    const client = new WebSeedClient({
      manifest,
      fetchFn: mockFetch as any,
    });

    await expect(client.downloadPiece(0)).rejects.toThrow('Web seed HTTP 404');
  });

  it('activeDownloadCount starts at 0', () => {
    const manifest = buildMockManifest({
      webSeeds: ['https://seed.example.com'],
    });
    const client = new WebSeedClient({ manifest });
    expect(client.activeDownloadCount).toBe(0);
  });

  it('clearCompleted removes finished download records', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1]).buffer),
    });

    const manifest = buildMockManifest({
      webSeeds: ['https://seed.example.com'],
    });
    const client = new WebSeedClient({
      manifest,
      fetchFn: mockFetch as any,
    });

    await client.downloadPiece(0);
    expect(client.getDownloadStatus()).toHaveLength(1);

    client.clearCompleted();
    expect(client.getDownloadStatus()).toHaveLength(0);
  });

  it('round-robins across multiple web seeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1]).buffer),
    });

    const manifest = buildMockManifest({
      webSeeds: ['https://seed1.example.com', 'https://seed2.example.com'],
      pieces: ['hash_a', 'hash_b'],
    });
    const client = new WebSeedClient({
      manifest,
      fetchFn: mockFetch as any,
      maxConcurrent: 10,
    });

    await client.downloadPiece(0);
    await client.downloadPiece(1);

    const url1 = mockFetch.mock.calls[0]![0] as string;
    const url2 = mockFetch.mock.calls[1]![0] as string;
    expect(url1).toContain('seed1');
    expect(url2).toContain('seed2');
  });
});
