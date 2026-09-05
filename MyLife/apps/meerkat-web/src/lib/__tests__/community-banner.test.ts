// Plan 38 Phase 1c (web): the community BANNER sealed-object bridge. The owner seals
// a banner under the community's current epoch and stores its blocks; a member opens
// it from LOCAL blocks. A banner whose blocks are NOT local renders nothing (open ->
// null): the honest "not local" signal, never a spinner lie.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createCommunity,
  createSyncTables,
  generateDeviceIdentity,
  type CommunityIdentityBanner,
  type DeviceIdentity,
  type NodeStore,
  type SealedBlock,
} from '@mylife/sync';
import { storeOwnedCommunity } from '../meerkat-data';
import {
  openCommunityBanner,
  parseBannerManifest,
  reconstructBannerShare,
  sealCommunityBanner,
} from '../community-banner';
import { ensureMeerkatTables } from '../schema';

// A minimal in-memory NodeStore: only the block methods the banner path uses.
class MemoryNodeStore {
  readonly blocks = new Map<string, string>();
  async putBlock(block: SealedBlock): Promise<void> {
    this.blocks.set(block.sealedId, block.payload);
  }
  async getBlock(sealedId: string): Promise<string | null> {
    return this.blocks.get(sealedId) ?? null;
  }
  async putManifest(): Promise<void> {
    /* refcount/index not exercised by the banner render path */
  }
}

let db: InMemoryTestDatabase;
let owner: DeviceIdentity;
let communityId: string;
let ownerDeviceId: string;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureMeerkatTables(db.adapter);
  owner = generateDeviceIdentity('Owner');
  ownerDeviceId = owner.publicKey;
  const signed = createCommunity(owner, {
    name: 'Trail Cooks',
    channels: [{ id: 'general', name: 'general' }],
    // The owner must be a keyed member so storeOwnedCommunity mints epoch 1 (the
    // banner seals under the current epoch).
    members: [{ deviceId: owner.publicKey, role: 'owner', displayName: 'Owner', dhPublicKey: owner.dhPublicKey }],
    now: '2026-07-05T09:00:00.000Z',
  });
  storeOwnedCommunity(db.adapter, owner, signed);
  communityId = signed.descriptor.communityId;
});

afterEach(() => db.close());

const nodeStore = (store: MemoryNodeStore): NodeStore => store as unknown as NodeStore;

describe('seal + open round trip', () => {
  it('seals a banner and the owner opens it back to a data URI', async () => {
    const store = new MemoryNodeStore();
    const bytes = new TextEncoder().encode('banner image bytes');
    const banner = await sealCommunityBanner({ nodeStore: nodeStore(store), db: db.adapter, owner, communityId, bytes });
    expect(banner.cid).toMatch(/^[0-9a-f]+$/);
    expect(banner.keyEpoch).toBe(1);

    const uri = await openCommunityBanner({
      nodeStore: nodeStore(store),
      db: db.adapter,
      identity: owner,
      communityId,
      ownerDeviceId,
      banner,
    });
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe('banner not local renders nothing extra', () => {
  it('open returns null when the sealed blocks are not on this device', async () => {
    const owningStore = new MemoryNodeStore();
    const bytes = new TextEncoder().encode('banner image bytes');
    const banner = await sealCommunityBanner({
      nodeStore: nodeStore(owningStore),
      db: db.adapter,
      owner,
      communityId,
      bytes,
    });
    // A DIFFERENT device's empty store: no blocks locally.
    const emptyStore = new MemoryNodeStore();
    const uri = await openCommunityBanner({
      nodeStore: nodeStore(emptyStore),
      db: db.adapter,
      identity: owner,
      communityId,
      ownerDeviceId,
      banner,
    });
    expect(uri).toBeNull();
  });
});

describe('pure manifest parse + reconstruct', () => {
  it('reconstructs the share only when every block is present', () => {
    const banner: CommunityIdentityBanner = {
      cid: 'ab'.repeat(16),
      keyEpoch: 1,
      wrappedKey: 'cd'.repeat(60),
      manifestJson: JSON.stringify({
        manifest: { contentId: 'ab'.repeat(16), size: 10 },
        manifestSignature: 'sig',
        sealedChunkIds: ['aa', 'bb'],
      }),
    };
    const parsed = parseBannerManifest(banner);
    expect(parsed).not.toBeNull();
    // Missing one block -> null (the not-local signal).
    expect(reconstructBannerShare(parsed!, new Map([['aa', 'p0']]))).toBeNull();
    const full = reconstructBannerShare(parsed!, new Map([['aa', 'p0'], ['bb', 'p1']]));
    expect(full?.sealedChunks.map((c) => c.sealedId)).toEqual(['aa', 'bb']);
  });

  it('returns null on a malformed manifest', () => {
    const banner: CommunityIdentityBanner = { cid: 'x', keyEpoch: 1, wrappedKey: 'y', manifestJson: 'not json' };
    expect(parseBannerManifest(banner)).toBeNull();
  });
});
