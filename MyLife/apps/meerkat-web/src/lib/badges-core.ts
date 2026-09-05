// Plan 56 C2 (features 37-38): the badges app core. This is the WEB twin of
// apps/meerkat/app/(root)/data/badges-core.ts, byte-identical
// below the import preamble, parity-locked (CORE_TWINS). Reads resolve
// VERIFIED rows only through @mylife/sync resolveCommunityBadges (scarcity is
// the signed supply cap, 7.6); writes ride the engine recordChange rail.

import type { DatabaseAdapter } from '@mylife/db';
import {
  badgeEventFromRow,
  badgeEventToRow,
  createBadgeAwardEvent,
  createBadgeMintEvent,
  getCommunity,
  resolveCommunityBadges,
  verifyBadgeEvent,
  type CommunityBadgeEvent,
  type DeviceIdentity,
  type ResolvedBadge,
} from '@mylife/sync';
import { CM_BADGES_TABLE } from './meerkat-data';
import { generateCanvasId, type CanvasRecordChange } from './canvas-core';

// --------------------------------------------------------------------------
// Shared logic below this line is byte-identical with the web twin
// (CORE_TWINS lock, anchored at listBadgeEvents).
// --------------------------------------------------------------------------

function listBadgeEvents(db: DatabaseAdapter, communityId: string): CommunityBadgeEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_BADGES_TABLE} WHERE community_id = ?`,
    [communityId],
  );
  const events: CommunityBadgeEvent[] = [];
  for (const row of rows) {
    const event = badgeEventFromRow(row);
    if (event) events.push(event);
  }
  return events;
}

/** All verified badges with their honored award lists. */
export function listCommunityBadges(db: DatabaseAdapter, communityId: string): ResolvedBadge[] {
  const stored = getCommunity(db, communityId);
  if (!stored) return [];
  return resolveCommunityBadges(listBadgeEvents(db, communityId), stored.descriptor);
}

/** The badges a member verifiably holds (for avatar chips + badge cases). */
export function badgesForMember(db: DatabaseAdapter, communityId: string, deviceId: string): ResolvedBadge[] {
  return listCommunityBadges(db, communityId).filter((badge) => badge.awardedTo.includes(deviceId));
}

function insertBadgeRow(db: DatabaseAdapter, event: CommunityBadgeEvent): void {
  const row = badgeEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO ${CM_BADGES_TABLE} (id, community_id, kind, badge_id, name, glyph, color_token, supply_cap, recipient_device, created_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.community_id, row.kind, row.badge_id, row.name, row.glyph, row.color_token, row.supply_cap, row.recipient_device, row.created_at, row.signed_by, row.signature],
  );
}

/** Owner-only: mint a badge with a SIGNED supply cap. Honest errors otherwise. */
export function mintCommunityBadge(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; name: string; glyph: string; colorToken?: string; supplyCap: number },
  recordChange?: CanvasRecordChange,
): CommunityBadgeEvent {
  const stored = getCommunity(db, input.communityId);
  if (!stored) throw new Error('Community not found on this device.');
  const event = createBadgeMintEvent(identity, {
    communityId: input.communityId,
    badgeId: generateCanvasId(),
    name: input.name,
    glyph: input.glyph,
    colorToken: input.colorToken,
    supplyCap: input.supplyCap,
  });
  if (!verifyBadgeEvent(event, stored.descriptor)) {
    throw new Error('Only the community owner can mint badges.');
  }
  insertBadgeRow(db, event);
  recordChange?.(CM_BADGES_TABLE, 'INSERT', event.id, badgeEventToRow(event));
  return event;
}

/** Owner/admin: award a badge (the resolver honors only the signed cap). */
export function awardCommunityBadge(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; badgeId: string; recipientDevice: string },
  recordChange?: CanvasRecordChange,
): CommunityBadgeEvent {
  const stored = getCommunity(db, input.communityId);
  if (!stored) throw new Error('Community not found on this device.');
  const badge = listCommunityBadges(db, input.communityId).find((b) => b.badgeId === input.badgeId);
  if (!badge) throw new Error('That badge is not on this device.');
  if (badge.awardedTo.length >= badge.supplyCap) {
    throw new Error(`All ${badge.supplyCap} of this badge are already awarded.`);
  }
  if (badge.awardedTo.includes(input.recipientDevice)) {
    throw new Error('That member already holds this badge.');
  }
  const event = createBadgeAwardEvent(identity, {
    communityId: input.communityId,
    badgeId: input.badgeId,
    recipientDevice: input.recipientDevice,
  });
  if (!verifyBadgeEvent(event, stored.descriptor)) {
    throw new Error('Only the owner or an admin can award badges.');
  }
  insertBadgeRow(db, event);
  recordChange?.(CM_BADGES_TABLE, 'INSERT', event.id, badgeEventToRow(event));
  return event;
}
