// Plan 56 C2 (feature 5): the asset-packs app core. This is the WEB twin of
// apps/meerkat/app/(root)/data/asset-packs-core.ts, byte-identical below the
// import preamble, parity-locked (CORE_TWINS). Reads resolve
// VERIFIED rows only through @mylife/sync resolveCommunityAssetPacks (7.5
// fail-closed per row); writes ride the engine recordChange rail. A custom
// reaction is the deterministic token `mkpack:<packId>:<slug>` riding the
// existing v2 react intent; builds without packs drop it fail-closed.

import type { DatabaseAdapter } from '@mylife/db';
import {
  assetPackEventFromRow,
  assetPackEventToRow,
  createAssetPackEvent,
  createAssetPackItemEvent,
  deriveAssetPackId,
  getCommunity,
  packReactionToken,
  parsePackReactionToken,
  resolveCommunityAssetPacks,
  type AssetPackKind,
  type CanvasNodeAsset,
  type CommunityAssetPackEvent,
  type DeviceIdentity,
  type ResolvedAssetPack,
  type ResolvedAssetPackItem,
} from '@mylife/sync';
import { CM_ASSET_PACKS_TABLE } from './meerkat-data';
import { generateCanvasId, type CanvasRecordChange } from './canvas-core';

// --------------------------------------------------------------------------
// Shared logic below this line is byte-identical with the web twin
// (CORE_TWINS lock, anchored at listAssetPackEvents).
// --------------------------------------------------------------------------

function listAssetPackEvents(db: DatabaseAdapter, communityId: string): CommunityAssetPackEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_ASSET_PACKS_TABLE} WHERE community_id = ?`,
    [communityId],
  );
  const events: CommunityAssetPackEvent[] = [];
  for (const row of rows) {
    const event = assetPackEventFromRow(row);
    if (event) events.push(event);
  }
  return events;
}

/** All verified packs with their honored item slots. */
export function listCommunityAssetPacks(db: DatabaseAdapter, communityId: string): ResolvedAssetPack[] {
  const stored = getCommunity(db, communityId);
  if (!stored) return [];
  return resolveCommunityAssetPacks(listAssetPackEvents(db, communityId), stored.descriptor);
}

/** The emoji-kind pack items available as custom reactions here. */
export function listReactionPackItems(
  db: DatabaseAdapter,
  communityId: string,
): Array<{ token: string; packId: string; packName: string; item: ResolvedAssetPackItem }> {
  const out: Array<{ token: string; packId: string; packName: string; item: ResolvedAssetPackItem }> = [];
  for (const pack of listCommunityAssetPacks(db, communityId)) {
    if (pack.packKind !== 'emoji') continue;
    for (const item of pack.items) {
      out.push({ token: packReactionToken(pack.packId, item.slug), packId: pack.packId, packName: pack.name, item });
    }
  }
  return out;
}

/** The sticker-kind pack items (the sticker layer + canvas palettes read these). */
export function listStickerPackItems(
  db: DatabaseAdapter,
  communityId: string,
): Array<{ packId: string; packName: string; item: ResolvedAssetPackItem }> {
  const out: Array<{ packId: string; packName: string; item: ResolvedAssetPackItem }> = [];
  for (const pack of listCommunityAssetPacks(db, communityId)) {
    if (pack.packKind !== 'sticker') continue;
    for (const item of pack.items) {
      out.push({ packId: pack.packId, packName: pack.name, item });
    }
  }
  return out;
}

export type PackReactionDisplay =
  | { kind: 'glyph'; glyph: string }
  | { kind: 'asset'; asset: CanvasNodeAsset; uploadedBy: string; slug: string }
  | { kind: 'missing'; slug: string };

/**
 * What a pack reaction token renders as HERE: a glyph, a sealed image (the
 * caller resolves bytes through the store), or the honest slug fallback when
 * the pack has not arrived on this device (never a fabricated image).
 */
export function resolvePackReactionDisplay(
  db: DatabaseAdapter,
  communityId: string,
  token: string,
): PackReactionDisplay | null {
  const parsed = parsePackReactionToken(token);
  if (!parsed) return null;
  for (const pack of listCommunityAssetPacks(db, communityId)) {
    if (pack.packId !== parsed.packId) continue;
    const item = pack.items.find((candidate) => candidate.slug === parsed.slug);
    if (!item) break;
    if (item.glyph) return { kind: 'glyph', glyph: item.glyph };
    if (item.asset) return { kind: 'asset', asset: item.asset, uploadedBy: item.uploadedBy, slug: item.slug };
  }
  return { kind: 'missing', slug: parsed.slug };
}

function insertAssetPackRow(db: DatabaseAdapter, event: CommunityAssetPackEvent): void {
  const row = assetPackEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO ${CM_ASSET_PACKS_TABLE} (id, community_id, kind, pack_id, name, pack_kind, slug, glyph, asset_cid, asset_key_epoch, asset_wrapped_key, asset_manifest_json, entry_version, tombstone, created_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.community_id, row.kind, row.pack_id, row.name, row.pack_kind, row.slug, row.glyph, row.asset_cid, row.asset_key_epoch, row.asset_wrapped_key, row.asset_manifest_json, row.entry_version, row.tombstone, row.created_at, row.signed_by, row.signature],
  );
}

function recordPackChange(db: DatabaseAdapter, event: CommunityAssetPackEvent, recordChange?: CanvasRecordChange): void {
  insertAssetPackRow(db, event);
  recordChange?.(CM_ASSET_PACKS_TABLE, 'INSERT', event.id, assetPackEventToRow(event));
}

/** Define a new pack (any member). Returns the signed pack event. */
export function defineAssetPack(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; name: string; packKind: AssetPackKind },
  recordChange?: CanvasRecordChange,
): CommunityAssetPackEvent {
  const stored = getCommunity(db, input.communityId);
  if (!stored) throw new Error('Community not found on this device.');
  const event = createAssetPackEvent(identity, {
    communityId: input.communityId,
    // The packId commits to this creator's key (deriveAssetPackId), so no other
    // member can author live content under it -- the slug-hijack fix.
    packId: deriveAssetPackId(identity.publicKey, generateCanvasId()),
    name: input.name,
    packKind: input.packKind,
  });
  recordPackChange(db, event, recordChange);
  return event;
}

function nextEntryVersion(db: DatabaseAdapter, communityId: string, packId: string, slug: string | null): number {
  const rows = slug === null
    ? db.query<{ v: number }>(
      `SELECT MAX(entry_version) AS v FROM ${CM_ASSET_PACKS_TABLE} WHERE community_id = ? AND pack_id = ? AND kind = 'pack'`,
      [communityId, packId],
    )
    : db.query<{ v: number }>(
      `SELECT MAX(entry_version) AS v FROM ${CM_ASSET_PACKS_TABLE} WHERE community_id = ? AND pack_id = ? AND kind = 'item' AND slug = ?`,
      [communityId, packId, slug],
    );
  return (rows[0]?.v ?? 0) + 1;
}

/** Add (or replace, same slug) a pack item: a unicode glyph OR a sealed asset. */
export function addAssetPackItem(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; packId: string; slug: string; glyph?: string | null; asset?: CanvasNodeAsset | null },
  recordChange?: CanvasRecordChange,
): CommunityAssetPackEvent {
  const stored = getCommunity(db, input.communityId);
  if (!stored) throw new Error('Community not found on this device.');
  const event = createAssetPackItemEvent(identity, {
    communityId: input.communityId,
    packId: input.packId,
    slug: input.slug,
    glyph: input.glyph ?? null,
    asset: input.asset ?? null,
    entryVersion: nextEntryVersion(db, input.communityId, input.packId, input.slug),
  });
  recordPackChange(db, event, recordChange);
  return event;
}

/** Tombstone a whole pack (uploader, or curator as moderation). */
export function tombstoneAssetPack(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; packId: string; name: string; packKind: AssetPackKind },
  recordChange?: CanvasRecordChange,
): CommunityAssetPackEvent {
  const event = createAssetPackEvent(identity, {
    communityId: input.communityId,
    packId: input.packId,
    name: input.name,
    packKind: input.packKind,
    entryVersion: nextEntryVersion(db, input.communityId, input.packId, null),
    tombstone: true,
  });
  recordPackChange(db, event, recordChange);
  return event;
}

/** Tombstone one pack item (uploader, or curator as moderation). */
export function tombstoneAssetPackItem(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; packId: string; slug: string },
  recordChange?: CanvasRecordChange,
): CommunityAssetPackEvent {
  const event = createAssetPackItemEvent(identity, {
    communityId: input.communityId,
    packId: input.packId,
    slug: input.slug,
    entryVersion: nextEntryVersion(db, input.communityId, input.packId, input.slug),
    tombstone: true,
  });
  recordPackChange(db, event, recordChange);
  return event;
}
