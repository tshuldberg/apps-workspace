/**
 * MK-031 Meerkat Node v0 -- core seeder logic. Storage caps are respected
 * before bytes are written, pieces are verified before being served, schedules
 * auto-delete non-pinned content, and stats come from real upload accounting.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCommunityCatalog,
  generateDeviceIdentity,
  extractSigningPrivateKeyHex,
  type CommunityCatalog,
  type SeedingPolicy,
} from '@mylife/sync';
import { MeerkatSeederNode, InMemorySeederPieceStore } from '../seeder-node';

const PIECE = 1024;

function policy(overrides: Partial<SeedingPolicy> = {}): SeedingPolicy {
  return {
    enabled: true,
    maxUploadKbps: 0,
    maxSeedStorageMB: 1024,
    autoDeleteDays: 30,
    seedOnCellular: false,
    seedWhileCharging: true,
    updatedAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  };
}

function catalog(name: string, sizeBytes = 8 * PIECE): CommunityCatalog {
  const owner = generateDeviceIdentity(`${name} Owner`);
  const data = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) data[i] = (i * 7 + name.length) % 251;
  return buildCommunityCatalog({
    communityName: name,
    entries: [{ path: 'cat.bin', data, mimeType: 'application/octet-stream' }],
    creatorPublicKey: owner.publicKey,
    creatorDisplayName: owner.displayName,
    creatorPrivateKey: extractSigningPrivateKeyHex(owner.privateKeyRef),
    pieceLength: PIECE,
  });
}

describe('MeerkatSeederNode (MK-031 core)', () => {
  it('pins a catalog, stores every piece, and serves them verified', async () => {
    const node = new MeerkatSeederNode({ policy: policy(), pieceStore: new InMemorySeederPieceStore() });
    const cat = catalog('Surf Club');

    const result = await node.pin(cat);
    expect(result).toEqual({ ok: true, infoHash: cat.manifest.infoHash, pieces: 8 });

    for (let i = 0; i < cat.manifest.pieces.length; i++) {
      const bytes = await node.servePiece(cat.manifest.infoHash, i);
      expect(bytes).not.toBeNull();
    }
    const stats = await node.stats();
    expect(stats.activeContent).toBe(1);
    expect(stats.pinnedContent).toBe(1);
    expect(stats.peersServed).toBe(8);
    expect(stats.bytesServed).toBe(8 * PIECE);
  });

  it('respects the storage cap BEFORE writing pieces', async () => {
    const store = new InMemorySeederPieceStore();
    // Cap of ~9 KiB: the first 8 KiB catalog fits, a second does not.
    const node = new MeerkatSeederNode({ policy: policy({ maxSeedStorageMB: 9 / 1024 }), pieceStore: store });

    expect((await node.pin(catalog('First', 8 * PIECE))).ok).toBe(true);
    const second = await node.pin(catalog('Second', 8 * PIECE));
    expect(second).toEqual({ ok: false, reason: 'storage_cap' });
    // Nothing from the rejected catalog was written.
    expect(store.sizeBytes()).toBe(8 * PIECE);
  });

  it('refuses to pin when seeding is disabled', async () => {
    const node = new MeerkatSeederNode({ policy: policy({ enabled: false }), pieceStore: new InMemorySeederPieceStore() });
    expect(await node.pin(catalog('Off'))).toEqual({ ok: false, reason: 'disabled' });
  });

  it('does not serve when policy conditions fail (e.g. not charging)', async () => {
    const node = new MeerkatSeederNode({
      policy: policy({ seedWhileCharging: true }),
      pieceStore: new InMemorySeederPieceStore(),
    });
    const cat = catalog('Conditional');
    await node.pin(cat);
    // seedWhileCharging requires charging; a not-charging request is refused.
    expect(await node.servePiece(cat.manifest.infoHash, 0, { isWifi: true, isCellular: false, isCharging: false })).toBeNull();
    // ...and a charging request is served.
    expect(await node.servePiece(cat.manifest.infoHash, 0, { isWifi: true, isCellular: false, isCharging: true })).not.toBeNull();
  });

  it('never serves a corrupted local piece', async () => {
    const store = new InMemorySeederPieceStore();
    const node = new MeerkatSeederNode({ policy: policy(), pieceStore: store });
    const cat = catalog('Tamper');
    await node.pin(cat);
    // Corrupt piece 2 in the store directly.
    store.put(cat.manifest.infoHash, 2, new Uint8Array(PIECE).fill(0xff));
    expect(await node.servePiece(cat.manifest.infoHash, 2)).toBeNull();
    // Other pieces still serve.
    expect(await node.servePiece(cat.manifest.infoHash, 0)).not.toBeNull();
  });

  it('serves nothing for unknown content or out-of-range pieces', async () => {
    const node = new MeerkatSeederNode({ policy: policy(), pieceStore: new InMemorySeederPieceStore() });
    const cat = catalog('Bounds');
    await node.pin(cat);
    expect(await node.servePiece('deadbeef', 0)).toBeNull();
    expect(await node.servePiece(cat.manifest.infoHash, 999)).toBeNull();
  });

  it('sweep auto-deletes non-pinned content past its window but keeps pinned', async () => {
    let nowMs = 1_000_000_000_000;
    const store = new InMemorySeederPieceStore();
    const node = new MeerkatSeederNode({ policy: policy({ autoDeleteDays: 7 }), pieceStore: store, now: () => nowMs });

    const pinned = catalog('Pinned');
    const temp = catalog('Temporary');
    await node.pin(pinned, { pinForever: true });
    await node.pin(temp, { pinForever: false });

    // Before the window: both held, nothing swept.
    expect(await node.sweep()).toEqual([]);

    // 8 days later: the non-pinned catalog expires and its pieces are removed.
    nowMs += 8 * 86_400_000;
    const pruned = await node.sweep();
    expect(pruned).toEqual([temp.manifest.infoHash]);
    expect(await node.servePiece(temp.manifest.infoHash, 0)).toBeNull();
    expect(await node.servePiece(pinned.manifest.infoHash, 0)).not.toBeNull();
  });

  it('unpin removes the content and stops serving it', async () => {
    const node = new MeerkatSeederNode({ policy: policy(), pieceStore: new InMemorySeederPieceStore() });
    const cat = catalog('Removable');
    await node.pin(cat);
    await node.unpin(cat.manifest.infoHash);
    expect(await node.servePiece(cat.manifest.infoHash, 0)).toBeNull();
    expect((await node.stats()).activeContent).toBe(0);
  });
});
