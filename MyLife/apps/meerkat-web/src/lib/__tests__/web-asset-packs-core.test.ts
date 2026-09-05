/**
 * Plan 56 C2 (feature 5): the asset-packs app core. Proves define/add/remove
 * round trips on a real db (verified reads only), the reaction-token display
 * resolution (glyph, sealed asset, honest :slug: fallback for a pack that has
 * not arrived), curator moderation tombstones, and that emoji vs sticker
 * packs feed their separate surfaces.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createCommunity,
  generateDeviceIdentity,
  packReactionToken,
  upsertCommunity,
} from '@mylife/sync';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import {
  addAssetPackItem,
  defineAssetPack,
  listCommunityAssetPacks,
  listReactionPackItems,
  listStickerPackItems,
  resolvePackReactionDisplay,
  tombstoneAssetPack,
  tombstoneAssetPackItem,
} from '../asset-packs-core';

let testDb: InMemoryTestDatabase | null = null;
afterEach(() => { testDb?.close(); testDb = null; });

configureSyncSecretStore(createInMemorySyncSecretStore());

const owner = generateDeviceIdentity('Owner');
const member = generateDeviceIdentity('Member');

const signed = createCommunity(owner, {
  name: 'Burrow',
  channels: [{ id: 'general', name: 'general' }],
  members: [{ deviceId: member.publicKey, role: 'member' }],
});
const communityId = signed.descriptor.communityId;

function freshDb() {
  testDb = createInMemoryTestDatabase();
  const db = testDb.adapter;
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  upsertCommunity(db, signed, owner.publicKey);
  return db;
}

describe('asset packs app core', () => {
  it('define + add + list round trip; emoji and sticker packs feed separate surfaces', () => {
    const db = freshDb();
    const emojiPack = defineAssetPack(db, member, { communityId, name: 'Faces', packKind: 'emoji' });
    const stickerPack = defineAssetPack(db, member, { communityId, name: 'Stickers', packKind: 'sticker' });
    addAssetPackItem(db, member, { communityId, packId: emojiPack.packId, slug: 'happy', glyph: '🦫' });
    addAssetPackItem(db, member, { communityId, packId: stickerPack.packId, slug: 'wave', glyph: '👋' });
    const packs = listCommunityAssetPacks(db, communityId);
    expect(packs).toHaveLength(2);
    const reactions = listReactionPackItems(db, communityId);
    expect(reactions).toHaveLength(1);
    expect(reactions[0]!.item.slug).toBe('happy');
    expect(reactions[0]!.token).toBe(packReactionToken(emojiPack.packId, 'happy'));
    const stickers = listStickerPackItems(db, communityId);
    expect(stickers).toHaveLength(1);
    expect(stickers[0]!.item.slug).toBe('wave');
  });

  it('reaction display resolves glyphs and falls back to the honest :slug: for missing packs', () => {
    const db = freshDb();
    const pack = defineAssetPack(db, member, { communityId, name: 'Faces', packKind: 'emoji' });
    addAssetPackItem(db, member, { communityId, packId: pack.packId, slug: 'happy', glyph: '🦫' });
    expect(resolvePackReactionDisplay(db, communityId, packReactionToken(pack.packId, 'happy')))
      .toEqual({ kind: 'glyph', glyph: '🦫' });
    expect(resolvePackReactionDisplay(db, communityId, packReactionToken('99'.repeat(16), 'gone')))
      .toEqual({ kind: 'missing', slug: 'gone' });
    expect(resolvePackReactionDisplay(db, communityId, 'not-a-token')).toBeNull();
  });

  it('item replacement lww + uploader/curator tombstones', () => {
    const db = freshDb();
    const pack = defineAssetPack(db, member, { communityId, name: 'Faces', packKind: 'emoji' });
    addAssetPackItem(db, member, { communityId, packId: pack.packId, slug: 'happy', glyph: '🦫' });
    addAssetPackItem(db, member, { communityId, packId: pack.packId, slug: 'happy', glyph: '🌿' });
    let packs = listCommunityAssetPacks(db, communityId);
    expect(packs[0]!.items).toEqual([expect.objectContaining({ slug: 'happy', glyph: '🌿' })]);
    // Owner (curator) moderates the member's item away.
    tombstoneAssetPackItem(db, owner, { communityId, packId: pack.packId, slug: 'happy' });
    packs = listCommunityAssetPacks(db, communityId);
    expect(packs[0]!.items).toHaveLength(0);
    // The uploader removes their own pack entirely.
    tombstoneAssetPack(db, member, { communityId, packId: pack.packId, name: 'Faces', packKind: 'emoji' });
    expect(listCommunityAssetPacks(db, communityId)).toHaveLength(0);
  });
});
