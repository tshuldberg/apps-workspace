// Plan 38 Phase 1c: the banner sealing + resolve path.
//
// A banner is a sealed library object under the community's current epoch, its
// blocks pinned in the node store, its DEK wrapped in the signed identity row.
// Asserts: the owner seals + publishes a banner and reads it back verified from a
// store that holds the blocks; the SAME banner resolves to null from an empty
// store (blocks not local yet -> render NOTHING extra); a forged identity's banner
// never resolves (owner binding); owner-only editing gate.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeBase64 } from 'tweetnacl-util';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  InMemoryNodeStore,
  configureSyncSecretStore,
  createCommunity,
  createCommunityIdentityEvent,
  createInMemorySyncSecretStore,
  createSyncTables,
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  ensureCommunityTables,
  insertCommunityIdentityRow,
  publishCommunityIdentity,
  storeOwnedCommunity,
} from '../(root)/data/community-core';
import { communityAdminCaps } from '../(root)/data/community-list-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import { resolveCommunityBannerImage, sealCommunityBanner } from '../(root)/data/community-identity-media';

let db: InMemoryTestDatabase;
let owner: DeviceIdentity;
let stranger: DeviceIdentity;
let communityId: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureMeerkatTables(db.adapter);
  ensureCommunityTables(db.adapter);
  owner = generateDeviceIdentity('Owner');
  stranger = generateDeviceIdentity('Stranger');
  const signed = createCommunity(owner, {
    name: 'Trail Cooks',
    channels: [{ id: 'general', name: 'general' }],
    now: '2026-07-05T09:00:00.000Z',
  });
  storeOwnedCommunity(db.adapter, owner, signed);
  communityId = signed.descriptor.communityId;
});

afterEach(() => db.close());

const bannerBytes = encodeBase64(new Uint8Array(Array.from({ length: 4096 }, (_, i) => i % 251)));

describe('sealCommunityBanner + resolveCommunityBannerImage', () => {
  it('seals a banner, publishes it, and reads it back verified from the pinning store', async () => {
    const store = new InMemoryNodeStore();
    const banner = await sealCommunityBanner({ db: db.adapter, store, identity: owner, communityId, base64: bannerBytes });
    expect(banner).not.toBeNull();
    expect(banner!.keyEpoch).toBeGreaterThanOrEqual(1);

    publishCommunityIdentity(db.adapter, owner, communityId, { banner });

    const uri = await resolveCommunityBannerImage({ db: db.adapter, store, identity: owner, communityId });
    expect(uri).not.toBeNull();
    expect(uri!.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('resolves to null from a store that does NOT hold the blocks (not local yet)', async () => {
    const sealingStore = new InMemoryNodeStore();
    const banner = await sealCommunityBanner({ db: db.adapter, store: sealingStore, identity: owner, communityId, base64: bannerBytes });
    publishCommunityIdentity(db.adapter, owner, communityId, { banner });

    const emptyStore = new InMemoryNodeStore();
    const uri = await resolveCommunityBannerImage({ db: db.adapter, store: emptyStore, identity: owner, communityId });
    expect(uri).toBeNull();
  });

  it('resolves to null when the identity has no banner', async () => {
    const store = new InMemoryNodeStore();
    publishCommunityIdentity(db.adapter, owner, communityId, { description: 'no banner here' });
    const uri = await resolveCommunityBannerImage({ db: db.adapter, store, identity: owner, communityId });
    expect(uri).toBeNull();
  });

  it('never resolves a forged (non-owner) banner even with the blocks local + openable', async () => {
    // Seal a REAL banner (owner-wrapped, blocks pinned, DEK the owner can unwrap),
    // but attach it to a STRANGER-signed identity event at a high revision instead
    // of publishing it as the owner. The owner binding at read time drops the whole
    // event (getCommunityIdentity -> null), so the banner never renders even though
    // its blocks are local and openable.
    const store = new InMemoryNodeStore();
    const realBanner = await sealCommunityBanner({ db: db.adapter, store, identity: owner, communityId, base64: bannerBytes });
    expect(realBanner).not.toBeNull();
    const forged = createCommunityIdentityEvent(stranger, { communityId, revision: 99, banner: realBanner });
    insertCommunityIdentityRow(db.adapter, forged);

    const uri = await resolveCommunityBannerImage({ db: db.adapter, store, identity: owner, communityId });
    expect(uri).toBeNull();
  });
});

describe('owner-only appearance editing gate', () => {
  it('only the owner role may edit community appearance', () => {
    expect(communityAdminCaps('owner').isOwner).toBe(true);
    expect(communityAdminCaps('admin').isOwner).toBe(false);
    expect(communityAdminCaps('member').isOwner).toBe(false);
    expect(communityAdminCaps(null).isOwner).toBe(false);
  });
});
