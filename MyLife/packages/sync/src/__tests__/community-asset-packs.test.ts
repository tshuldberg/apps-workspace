/**
 * Plan 56 C2 (feature 5): asset packs. Proves the authority model (members
 * upload; live content only from the ORIGINAL uploader; tombstones from the
 * uploader or a curator; strangers never verify), the anti-spoof glyph gate
 * at PACK-VALIDATION time, the glyph-XOR-asset shape, row serde totality,
 * deterministic per-identity lww resolution with moderation tombstones that
 * cannot be outrun, the 64-slot cap (resolution AND apply time), the pack
 * reaction token grammar riding the v2 react intent, apply-time validation
 * (forgery dies before INSERT, raw DELETE rejected), and the frozen fixture.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createCommunity, upsertCommunity } from '../protocol/community';
import { createChannelMessageV2, isPackReactionToken, packReactionToken, parsePackReactionToken, verifyChannelMessage } from '../protocol/channel-message';
import { SYNC_RESERVED_SPOOF_GLYPHS } from '../protocol/community-badges';
import {
  COMMUNITY_ASSET_PACKS_TABLE,
  SYNC_ASSET_PACK_ITEM_CAP,
  SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK,
  SYNC_ASSET_PACK_STICKER_MAX_BYTES,
  SYNC_ASSET_PACK_EMOJI_MAX_BYTES,
  assetPackEventFromRow,
  assetPackEventId,
  assetPackEventToRow,
  createAssetPackEvent,
  createAssetPackItemEvent,
  deriveAssetPackId,
  packIdBoundToOwner,
  resolveCommunityAssetPacks,
  signAssetPackEvent,
  validateAssetPackRow,
  verifyAssetPackEvent,
} from '../protocol/community-asset-packs';
import { isSignedRowTable, validateSignedInboundRow } from '../protocol/inbound-row-validators';
import packFixture from './fixtures/legacy-community-asset-pack-events.json';

const owner = generateDeviceIdentity('Owner');
const admin = generateDeviceIdentity('Admin');
const member = generateDeviceIdentity('Member');
const stranger = generateDeviceIdentity('Stranger');

const signed = createCommunity(owner, {
  name: 'Burrow',
  channels: [{ id: 'general', name: 'general' }],
  members: [
    { deviceId: admin.publicKey, role: 'admin' },
    { deviceId: member.publicKey, role: 'member' },
  ],
});
const d = signed.descriptor;
const communityId = d.communityId;
// A packId is now owner-bound (commits to its creator's key). The member owns
// this one; no other signer can author live content under it.
const PACK_ID = deriveAssetPackId(member.publicKey, 'ab'.repeat(16));

const VALID_ASSET = {
  cid: 'cd'.repeat(16),
  keyEpoch: 1,
  wrappedKey: 'ef'.repeat(48),
  manifestJson: JSON.stringify({
    // A sealed asset MUST declare a present, integer, non-negative size within
    // the hard ceiling (fail-closed, DEFECT 2); a real NodeManifest always has one.
    manifest: { contentId: 'cd'.repeat(16), size: 1000 },
    manifestSignature: '12'.repeat(64),
    sealedChunkIds: ['34'.repeat(16)],
  }),
};

describe('shapes + authority', () => {
  it('members sign packs and items; strangers never verify; shapes are exclusive', () => {
    const pack = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Meerkat faces', packKind: 'emoji' });
    expect(verifyAssetPackEvent(pack, d)).toBe(true);
    const item = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', glyph: '🦫' });
    expect(verifyAssetPackEvent(item, d)).toBe(true);
    const sealed = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'dance', asset: VALID_ASSET });
    expect(verifyAssetPackEvent(sealed, d)).toBe(true);
    // A stranger cannot author live content under the member's owner-bound
    // packId at all: the create refuses it, and a stranger's OWN bound pack
    // fails verify because they are not a member.
    expect(() => createAssetPackEvent(stranger, { communityId, packId: PACK_ID, name: 'Fake', packKind: 'emoji' }))
      .toThrow(/derived from your own key/);
    const strangerOwn = createAssetPackEvent(stranger, { communityId, packId: deriveAssetPackId(stranger.publicKey, 'cc'.repeat(16)), name: 'Own', packKind: 'emoji' });
    expect(verifyAssetPackEvent(strangerOwn, d)).toBe(false);
    // Cross-shape payloads never verify.
    expect(verifyAssetPackEvent({ ...pack, slug: 'x2' }, d)).toBe(false);
    expect(verifyAssetPackEvent({ ...item, name: 'renamed' }, d)).toBe(false);
    // Glyph XOR asset.
    expect(() => createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'both', glyph: '🦫', asset: VALID_ASSET })).toThrow(/exactly one/);
    expect(() => createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'none' })).toThrow(/exactly one/);
  });

  it('rejects every reserved trust glyph at pack-validation time (7.4)', () => {
    for (const glyph of SYNC_RESERVED_SPOOF_GLYPHS) {
      expect(() => createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'sneaky', glyph }))
        .toThrow(/reserved/);
    }
  });

  it('row serde is total', () => {
    const item = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', asset: VALID_ASSET });
    expect(assetPackEventFromRow(assetPackEventToRow(item))).toEqual(item);
    expect(assetPackEventFromRow({ ...assetPackEventToRow(item), entry_version: 'one' })).toBeNull();
    expect(assetPackEventFromRow({ ...assetPackEventToRow(item), kind: 'steal' })).toBeNull();
    // The sealed manifest rides asset_manifest_json (the collectBlobRefs convention).
    expect(assetPackEventToRow(item).asset_manifest_json).toBe(VALID_ASSET.manifestJson);
  });
});

describe('resolution (owner-bound identity + moderation)', () => {
  it('higher entryVersion wins; owner-binding blocks slug hijack even with a backdated timestamp', () => {
    const t = (n: number) => `2026-08-29T10:0${n}:00.000Z`;
    const pack = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Faces v1', packKind: 'emoji', createdAt: t(0) });
    const rename = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Faces v2', packKind: 'emoji', entryVersion: 2, createdAt: t(1) });
    const item1 = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', glyph: '🦫', createdAt: t(2) });
    const item1b = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', glyph: '🌿', entryVersion: 2, createdAt: t(3) });
    // Slug hijack is now structurally impossible: admin cannot even MINT a live
    // item under the member's owner-bound packId (the fix; a backdated
    // createdAt no longer buys ownership), and the binding is one-way.
    expect(() => createAssetPackItemEvent(admin, { communityId, packId: PACK_ID, slug: 'happy', glyph: '⭐', createdAt: '2000-01-01T00:00:00.000Z' }))
      .toThrow(/derived from your own key/);
    expect(packIdBoundToOwner(PACK_ID, member.publicKey)).toBe(true);
    expect(packIdBoundToOwner(PACK_ID, admin.publicKey)).toBe(false);
    const resolved = resolveCommunityAssetPacks([pack, rename, item1, item1b], d);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.name).toBe('Faces v2');
    expect(resolved[0]!.items).toHaveLength(1);
    expect(resolved[0]!.items[0]).toMatchObject({ slug: 'happy', glyph: '🌿', uploadedBy: member.publicKey });
  });

  it('a curator moderation tombstone is PERMANENT; an owner self-tombstone is LWW', () => {
    const t = (n: number) => `2026-08-29T10:0${n}:00.000Z`;
    const pack = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Faces', packKind: 'emoji', createdAt: t(0) });
    // 'loud' is moderated by the admin (a curator who is NOT the pack owner):
    // the member cannot resurrect it, at ANY entryVersion.
    const loud = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'loud', glyph: '📢', createdAt: t(1) });
    const modKill = createAssetPackItemEvent(admin, { communityId, packId: PACK_ID, slug: 'loud', tombstone: true, entryVersion: 3, createdAt: t(2) });
    const loudReupload = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'loud', glyph: '📢', entryVersion: 99, createdAt: t(3) });
    // 'happy' is deleted by its OWNER, then re-added at a higher version: LWW
    // lets the owner bring their own content back.
    const happy = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', glyph: '🦫', createdAt: t(1) });
    const happyKill = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', tombstone: true, entryVersion: 2, createdAt: t(2) });
    const happyReadd = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', glyph: '🌿', entryVersion: 3, createdAt: t(3) });
    const resolved = resolveCommunityAssetPacks([pack, loud, modKill, loudReupload, happy, happyKill, happyReadd], d);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.items).toHaveLength(1);
    expect(resolved[0]!.items[0]).toMatchObject({ slug: 'happy', glyph: '🌿' });
  });

  it('orders packs deterministically regardless of arrival order (equal createdAt tie-break)', () => {
    // Two DISTINCT owner-bound packs by two members sharing the exact same
    // createdAt string. The pack listing must converge on every device no
    // matter the order the events arrive in; a createdAt-only comparator is
    // inconsistent on the tie and returns arrival-order-dependent output.
    const sameTs = '2026-08-29T10:00:00.000Z';
    const packA = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'A', packKind: 'emoji', createdAt: sameTs });
    const ADMIN_PACK_ID = deriveAssetPackId(admin.publicKey, 'ba'.repeat(16));
    const packB = createAssetPackEvent(admin, { communityId, packId: ADMIN_PACK_ID, name: 'B', packKind: 'emoji', createdAt: sameTs });
    const forward = resolveCommunityAssetPacks([packA, packB], d).map((p) => p.packId);
    const reverse = resolveCommunityAssetPacks([packB, packA], d).map((p) => p.packId);
    expect(forward).toEqual(reverse);
  });

  it('honors only the first 64 slots deterministically', () => {
    const events = [createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Big', packKind: 'emoji', createdAt: '2026-08-29T10:00:00.000Z' })];
    for (let i = 0; i < SYNC_ASSET_PACK_ITEM_CAP + 5; i += 1) {
      events.push(createAssetPackItemEvent(member, {
        communityId, packId: PACK_ID, slug: `e${String(i).padStart(3, '0')}`, glyph: '🦫',
        createdAt: `2026-08-29T11:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`,
      }));
    }
    const resolved = resolveCommunityAssetPacks(events, d);
    expect(resolved[0]!.items).toHaveLength(SYNC_ASSET_PACK_ITEM_CAP);
  });

  it('converges: 65 distinct slugs resolve to the SAME first 64 (createdAt, id) in any delivery order (DEFECT 1)', () => {
    const pack = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Big', packKind: 'emoji', createdAt: '2026-08-29T10:00:00.000Z' });
    const items = [];
    for (let i = 0; i < SYNC_ASSET_PACK_ITEM_CAP + 1; i += 1) {
      items.push(createAssetPackItemEvent(member, {
        communityId, packId: PACK_ID, slug: `s${String(i).padStart(3, '0')}`, glyph: '🦫',
        createdAt: `2026-08-29T11:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`,
      }));
    }
    const forward = resolveCommunityAssetPacks([pack, ...items], d);
    const reverse = resolveCommunityAssetPacks([pack, ...[...items].reverse()], d);
    const forwardSlugs = forward[0]!.items.map((it) => it.slug);
    const reverseSlugs = reverse[0]!.items.map((it) => it.slug);
    expect(forwardSlugs).toHaveLength(SYNC_ASSET_PACK_ITEM_CAP);
    // Same set AND same order on every device: the first 64 by (createdAt, id),
    // i.e. s000..s063; s064 (the latest) is the one dropped, on BOTH orderings.
    expect(forwardSlugs).toEqual(reverseSlugs);
    expect(forwardSlugs).not.toContain('s064');
    expect(forwardSlugs[0]).toBe('s000');
  });

  it('a tombstoned slug does not consume a rendered slot (frees a slot for the 65th) (DEFECT 1)', () => {
    const pack = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Big', packKind: 'emoji', createdAt: '2026-08-29T10:00:00.000Z' });
    const items = [];
    for (let i = 0; i < SYNC_ASSET_PACK_ITEM_CAP + 1; i += 1) {
      items.push(createAssetPackItemEvent(member, {
        communityId, packId: PACK_ID, slug: `s${String(i).padStart(3, '0')}`, glyph: '🦫',
        createdAt: `2026-08-29T11:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`,
      }));
    }
    // Without a tombstone s064 is dropped (65th). Tombstone s000: its slot frees
    // and s064 now renders -- proof the killed slug consumes no rendered slot.
    const killS000 = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 's000', tombstone: true, entryVersion: 2, createdAt: '2026-08-29T12:00:00.000Z' });
    const resolved = resolveCommunityAssetPacks([pack, ...items, killS000], d);
    const slugs = resolved[0]!.items.map((it) => it.slug);
    expect(slugs).toHaveLength(SYNC_ASSET_PACK_ITEM_CAP);
    expect(slugs).not.toContain('s000');
    expect(slugs).toContain('s064');
  });

  it('storage boundary: 1025 valid items render the identical first 64 in any delivery order (abuse-regime storage caveat)', () => {
    // At the per-pack STORAGE boundary (SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK
    // + 1 distinct owner-signed items), the resolver -- the deterministic RENDER
    // authority -- still converges on the same first 64 by (createdAt, id)
    // regardless of delivery order. This asserts below-cap render convergence.
    //
    // ACKNOWLEDGED, NOT ASSERTED (the abuse-regime caveat): the storage cap is a
    // SEPARATE append-only anti-DoS bound. ABOVE the cap, WHICH surplus rows a
    // given device happens to store is delivery-order dependent (deliberately,
    // matching the canvas COUNT caps), so two devices that each dropped different
    // surplus rows at apply time could diverge in the abuse regime. That storage
    // behaviour is the accepted weakening; only the render convergence of the
    // delivered set is pinned here.
    const total = SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK + 1; // 1025
    const base = Date.UTC(2026, 7, 29, 9, 0, 0);
    const pack = createAssetPackEvent(member, { communityId, packId: PACK_ID, name: 'Boundary', packKind: 'emoji', createdAt: new Date(base).toISOString() });
    const items = [];
    for (let i = 0; i < total; i += 1) {
      items.push(createAssetPackItemEvent(member, {
        communityId, packId: PACK_ID, slug: `s${String(i).padStart(4, '0')}`, glyph: '🦫',
        createdAt: new Date(base + (i + 1) * 1000).toISOString(),
      }));
    }
    const forward = resolveCommunityAssetPacks([pack, ...items], d)[0]!.items.map((it) => it.slug);
    const reverse = resolveCommunityAssetPacks([pack, ...[...items].reverse()], d)[0]!.items.map((it) => it.slug);
    expect(forward).toHaveLength(SYNC_ASSET_PACK_ITEM_CAP);
    expect(forward).toEqual(reverse);
    // The first 64 by createdAt are s0000..s0063 on both orderings.
    expect(forward[0]).toBe('s0000');
    expect(forward).not.toContain(`s${String(total - 1).padStart(4, '0')}`);
  }, 60000);
});

describe('sealed asset byte caps (DEFECT 2)', () => {
  const assetWithManifest = (extra: Record<string, unknown>) => {
    const cid = 'cd'.repeat(16);
    return {
      cid,
      keyEpoch: 1,
      wrappedKey: 'ef'.repeat(48),
      manifestJson: JSON.stringify({
        manifest: { contentId: cid, ...extra },
        manifestSignature: '12'.repeat(64),
        sealedChunkIds: ['34'.repeat(16)],
      }),
    };
  };

  it('rejects a declared plaintext size above the hard 512 KB protocol ceiling at create AND verify (2a)', () => {
    const oversized = assetWithManifest({ size: SYNC_ASSET_PACK_STICKER_MAX_BYTES + 1 });
    // create refuses to mint it.
    expect(() => createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'big', asset: oversized }))
      .toThrow(/out-of-range size/);
    // verify must reject it too. Build a PROPERLY-SIGNED event whose id AND
    // signature MATCH the oversized asset (create won't, so sign it directly via
    // the signAssetPackEvent seam) so the size gate is the ONLY thing that can
    // fail: if the declared-size check were removed this event WOULD verify. (A
    // naive { ...ok, asset: oversized } fails the id check first and would pass
    // even with the size gate deleted -- it does not isolate the gate.)
    const signedOversize = signAssetPackEvent(member, {
      version: 1, communityId, kind: 'item', packId: PACK_ID,
      name: null, packKind: null, slug: 'big', glyph: null, asset: oversized,
      entryVersion: 1, tombstone: false,
      createdAt: '2026-08-29T10:00:00.000Z', signedBy: member.publicKey,
    });
    // The event is internally self-consistent; only the size is out of range.
    expect(signedOversize.id).toBe(assetPackEventId(signedOversize));
    expect(verifyAssetPackEvent(signedOversize, d)).toBe(false);
    // Control: the SAME event shape with an in-range size verifies, proving the
    // size gate is what rejects the oversized one (nothing else structural).
    const signedInRange = signAssetPackEvent(member, {
      version: 1, communityId, kind: 'item', packId: PACK_ID,
      name: null, packKind: null, slug: 'big', glyph: null,
      asset: assetWithManifest({ size: 1000 }),
      entryVersion: 1, tombstone: false,
      createdAt: '2026-08-29T10:00:00.000Z', signedBy: member.publicKey,
    });
    expect(verifyAssetPackEvent(signedInRange, d)).toBe(true);
    // And a MISSING declared size is now malformed (fail-closed, DEFECT 2).
    expect(() => createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'nosize', asset: assetWithManifest({}) }))
      .toThrow(/out-of-range size/);
  });

  it('drops an emoji-pack item whose declared size exceeds the 256 KB per-kind cap, but keeps it in a sticker pack (2a)', () => {
    // 300 KB: under the 512 KB ceiling (so create/verify pass) but over the
    // 256 KB emoji cap -- must be dropped at resolve for an emoji pack only.
    const midSize = assetWithManifest({ size: SYNC_ASSET_PACK_EMOJI_MAX_BYTES + 1024 });
    const emojiPackId = deriveAssetPackId(member.publicKey, 'a1'.repeat(16));
    const emojiPack = createAssetPackEvent(member, { communityId, packId: emojiPackId, name: 'E', packKind: 'emoji' });
    const emojiItem = createAssetPackItemEvent(member, { communityId, packId: emojiPackId, slug: 'big', asset: midSize });
    const emojiResolved = resolveCommunityAssetPacks([emojiPack, emojiItem], d);
    expect(emojiResolved[0]!.items).toHaveLength(0);

    const stickerPackId = deriveAssetPackId(member.publicKey, 'a2'.repeat(16));
    const stickerPack = createAssetPackEvent(member, { communityId, packId: stickerPackId, name: 'S', packKind: 'sticker' });
    const stickerItem = createAssetPackItemEvent(member, { communityId, packId: stickerPackId, slug: 'big', asset: midSize });
    const stickerResolved = resolveCommunityAssetPacks([stickerPack, stickerItem], d);
    expect(stickerResolved[0]!.items).toHaveLength(1);
  });

  it('measures the manifest cap in ENCODED bytes, not UTF-16 length (2b)', () => {
    // ~7000 multibyte chars: UTF-16 .length ~7000 (< 16384, so the old buggy
    // check passed) but encoded bytes ~21000 (> 16384, the real cap).
    const padded = assetWithManifest({ pad: '✿'.repeat(7000) });
    expect(padded.manifestJson.length).toBeLessThan(16 * 1024);
    expect(new TextEncoder().encode(padded.manifestJson).length).toBeGreaterThan(16 * 1024);
    expect(() => createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'padded', asset: padded }))
      .toThrow(/manifest is too large/);
  });
});

describe('pack reaction tokens (v2 react intent)', () => {
  it('grammar is bounded and deterministic; parse round-trips', () => {
    const token = packReactionToken(PACK_ID, 'happy');
    expect(isPackReactionToken(token)).toBe(true);
    expect(parsePackReactionToken(token)).toEqual({ packId: PACK_ID, slug: 'happy' });
    expect(isPackReactionToken('mkpack:xyz:happy')).toBe(false);
    expect(isPackReactionToken('mkpack:' + PACK_ID + ':Bad Slug')).toBe(false);
    expect(isPackReactionToken('🦫')).toBe(false);
    expect(parsePackReactionToken('🦫')).toBeNull();
  });

  it('a react event with a pack token verifies; garbage bodies still fail', () => {
    const hlc = { wall: '2026-08-29T12:00:00.000Z', counter: 0 };
    const root = createChannelMessageV2(member, { communityId, channelId: 'general', body: 'root post', hlc });
    const react = createChannelMessageV2(member, {
      communityId, channelId: 'general', body: packReactionToken(PACK_ID, 'happy'),
      intent: 'react', parentId: root.id, hlc,
    });
    expect(verifyChannelMessage(react)).toBe(true);
    const junk = createChannelMessageV2(member, {
      communityId, channelId: 'general', body: 'not an emoji', intent: 'react', parentId: root.id, hlc,
    });
    expect(verifyChannelMessage(junk)).toBe(false);
  });
});

describe('apply-time validator', () => {
  let testDb: InMemoryTestDatabase | null = null;
  afterEach(() => { testDb?.close(); testDb = null; });

  const createPacksTable = (db: InMemoryTestDatabase['adapter']) => {
    db.execute(`CREATE TABLE ${COMMUNITY_ASSET_PACKS_TABLE} (
      id TEXT PRIMARY KEY, community_id TEXT NOT NULL, kind TEXT NOT NULL, pack_id TEXT NOT NULL,
      name TEXT, pack_kind TEXT, slug TEXT, glyph TEXT,
      asset_cid TEXT, asset_key_epoch INTEGER, asset_wrapped_key TEXT, asset_manifest_json TEXT,
      entry_version INTEGER NOT NULL, tombstone INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, signed_by TEXT NOT NULL, signature TEXT NOT NULL
    )`);
  };

  it('accepts real rows, rejects forgeries, admits the 65th slug (render cap is at resolve), rejects raw DELETE', () => {
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    createSyncTables(db);
    createPacksTable(db);
    upsertCommunity(db, signed, owner.publicKey);
    expect(isSignedRowTable(COMMUNITY_ASSET_PACKS_TABLE)).toBe(true);
    const item = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'happy', glyph: '🦫' });
    expect(validateAssetPackRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: item.id, operation: 'INSERT', data: assetPackEventToRow(item) }))
      .toEqual({ ok: true });
    // A stranger cannot mint under the member's packId (binding blocks it), so
    // the wire forgery they COULD craft is under their own bound packId -- and
    // that fails at verify because they are not a community member.
    const forged = createAssetPackItemEvent(stranger, { communityId, packId: deriveAssetPackId(stranger.publicKey, 'ee'.repeat(16)), slug: 'evil', glyph: '🦫' });
    expect(validateAssetPackRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: forged.id, operation: 'INSERT', data: assetPackEventToRow(forged) }))
      .toEqual({ ok: false, reason: 'asset_pack_signature_invalid' });
    // Store 64 distinct slugs, then the 65th is now ACCEPTED at apply time: the
    // 64-slot cap is enforced deterministically at RESOLVE, not by an
    // order-dependent apply-time DISTINCT reject (codex DEFECT 1).
    for (let i = 0; i < SYNC_ASSET_PACK_ITEM_CAP; i += 1) {
      const slot = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: `s${String(i).padStart(3, '0')}`, glyph: '🦫' });
      const row = assetPackEventToRow(slot);
      db.execute(
        `INSERT INTO ${COMMUNITY_ASSET_PACKS_TABLE} (id, community_id, kind, pack_id, name, pack_kind, slug, glyph, asset_cid, asset_key_epoch, asset_wrapped_key, asset_manifest_json, entry_version, tombstone, created_at, signed_by, signature)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.community_id, row.kind, row.pack_id, row.name, row.pack_kind, row.slug, row.glyph, row.asset_cid, row.asset_key_epoch, row.asset_wrapped_key, row.asset_manifest_json, row.entry_version, row.tombstone, row.created_at, row.signed_by, row.signature],
      );
    }
    const past64 = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 's064', glyph: '🦫' });
    expect(validateAssetPackRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: past64.id, operation: 'INSERT', data: assetPackEventToRow(past64) }))
      .toEqual({ ok: true });
    expect(validateSignedInboundRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: 'x', operation: 'DELETE', data: null }))
      .toEqual({ ok: false, reason: 'signed_row_delete_rejected' });
  });

  it('enforces the order-independent per-pack STORAGE cap (DoS bound), never the render cap', () => {
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    createSyncTables(db);
    createPacksTable(db);
    upsertCommunity(db, signed, owner.publicKey);
    // Cheaply saturate the pack to the stored-item ceiling with placeholder item
    // rows (COUNT-only; their signatures are irrelevant to the storage gate).
    const insert = db.execute.bind(db);
    for (let i = 0; i < SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK; i += 1) {
      insert(
        `INSERT INTO ${COMMUNITY_ASSET_PACKS_TABLE} (id, community_id, kind, pack_id, name, pack_kind, slug, glyph, asset_cid, asset_key_epoch, asset_wrapped_key, asset_manifest_json, entry_version, tombstone, created_at, signed_by, signature)
         VALUES (?, ?, 'item', ?, NULL, NULL, ?, '🦫', NULL, NULL, NULL, NULL, 1, 0, ?, ?, 'sig')`,
        [`fill${i}`, communityId, PACK_ID, `slug${i}`, '2026-08-29T10:00:00.000Z', member.publicKey],
      );
    }
    const overflow = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'overflow', glyph: '🦫' });
    expect(validateAssetPackRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: overflow.id, operation: 'INSERT', data: assetPackEventToRow(overflow) }))
      .toEqual({ ok: false, reason: 'asset_pack_storage_cap' });
    // Storage is APPEND-ONLY and the gate now covers ALL item inserts (LIVE and
    // TOMBSTONE alike) counting ALL item rows (DEFECT 1, tombstone-accounting
    // fix): a tombstone is itself a stored row, so at the ceiling even a
    // moderation/self tombstone is refused. Tombstoning frees a RENDER slot (the
    // resolver drops it) but NOT a STORAGE slot. This is the accepted anti-DoS
    // weakening, deliberately consistent with the canvas COUNT caps.
    const kill = createAssetPackItemEvent(member, { communityId, packId: PACK_ID, slug: 'overflow', tombstone: true, entryVersion: 2 });
    expect(validateAssetPackRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: kill.id, operation: 'INSERT', data: assetPackEventToRow(kill) }))
      .toEqual({ ok: false, reason: 'asset_pack_storage_cap' });
    // Below the ceiling a tombstone still lands: drop one stored row, then the
    // same tombstone is accepted -- proving the gate is a pure storage bound,
    // not a moderation block.
    db.execute(`DELETE FROM ${COMMUNITY_ASSET_PACKS_TABLE} WHERE id = 'fill0'`);
    expect(validateAssetPackRow(db, { table: COMMUNITY_ASSET_PACKS_TABLE, rowId: kill.id, operation: 'INSERT', data: assetPackEventToRow(kill) }))
      .toEqual({ ok: true });
  });
});

describe('frozen fixture (canonical-bytes lock)', () => {
  it('the frozen pack + item still verify byte-for-byte', () => {
    const f = packFixture as {
      descriptor: { descriptor: typeof d };
      pack: Parameters<typeof verifyAssetPackEvent>[0];
      item: Parameters<typeof verifyAssetPackEvent>[0];
    };
    expect(verifyAssetPackEvent(f.pack, f.descriptor.descriptor)).toBe(true);
    expect(verifyAssetPackEvent(f.item, f.descriptor.descriptor)).toBe(true);
    expect(verifyAssetPackEvent({ ...f.item, glyph: '👿' }, f.descriptor.descriptor)).toBe(false);
  });
});
