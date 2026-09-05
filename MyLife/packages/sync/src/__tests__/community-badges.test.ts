/**
 * Plan 56 C2: badge mints + awards. Proves the authority matrix (mint =
 * owner only; award = owner/admin; members and strangers never verify), the
 * anti-spoof glyph exclusion at the PROTOCOL layer, kind/shape discipline,
 * row serde totality, deterministic resolution honoring ONLY the signed
 * supply cap with per-recipient dedupe, apply-time validation (forgery dies
 * before INSERT, raw DELETE rejected), and the frozen fixture lock.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createCommunity, upsertCommunity } from '../protocol/community';
import {
  COMMUNITY_BADGES_TABLE,
  SYNC_RESERVED_SPOOF_GLYPHS,
  badgeEventFromRow,
  badgeEventToRow,
  badgeGlyphAllowed,
  createBadgeAwardEvent,
  createBadgeMintEvent,
  resolveCommunityBadges,
  validateBadgeRow,
  verifyBadgeEvent,
} from '../protocol/community-badges';
import { isSignedRowTable, validateSignedInboundRow } from '../protocol/inbound-row-validators';
import badgeFixture from './fixtures/legacy-community-badge-events.json';

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
const BADGE_ID = 'a1'.repeat(16);

describe('glyph gate (7.4 at the protocol layer)', () => {
  it('rejects every reserved trust glyph, alone and embedded', () => {
    for (const glyph of SYNC_RESERVED_SPOOF_GLYPHS) {
      expect(badgeGlyphAllowed(glyph)).toBe(false);
      expect(badgeGlyphAllowed(`x${glyph}`)).toBe(false);
      expect(() => createBadgeMintEvent(owner, { communityId, badgeId: BADGE_ID, name: 'Sneaky', glyph, supplyCap: 5 }))
        .toThrow(/reserved/);
    }
    expect(badgeGlyphAllowed('🦫')).toBe(true);
  });
});

describe('authority + shape', () => {
  it('mints bind to the owner; awards to owner/admin; shapes are exclusive', () => {
    const mint = createBadgeMintEvent(owner, { communityId, badgeId: BADGE_ID, name: 'Founding Beaver', glyph: '🦫', supplyCap: 3 });
    expect(verifyBadgeEvent(mint, d)).toBe(true);
    const forgedMint = createBadgeMintEvent(admin, { communityId, badgeId: BADGE_ID, name: 'Fake', glyph: '🦫', supplyCap: 3 });
    expect(verifyBadgeEvent(forgedMint, d)).toBe(false);
    const award = createBadgeAwardEvent(admin, { communityId, badgeId: BADGE_ID, recipientDevice: member.publicKey });
    expect(verifyBadgeEvent(award, d)).toBe(true);
    const memberAward = createBadgeAwardEvent(member, { communityId, badgeId: BADGE_ID, recipientDevice: member.publicKey });
    expect(verifyBadgeEvent(memberAward, d)).toBe(false);
    const strangerAward = createBadgeAwardEvent(stranger, { communityId, badgeId: BADGE_ID, recipientDevice: member.publicKey });
    expect(verifyBadgeEvent(strangerAward, d)).toBe(false);
    // Cross-shape payloads never verify.
    expect(verifyBadgeEvent({ ...mint, recipientDevice: member.publicKey }, d)).toBe(false);
    expect(verifyBadgeEvent({ ...award, supplyCap: 99 }, d)).toBe(false);
  });

  it('row serde is total', () => {
    const mint = createBadgeMintEvent(owner, { communityId, badgeId: BADGE_ID, name: 'B', glyph: '🌿', supplyCap: 10 });
    expect(badgeEventFromRow(badgeEventToRow(mint))).toEqual(mint);
    expect(badgeEventFromRow({ ...badgeEventToRow(mint), supply_cap: 'ten' })).toBeNull();
    expect(badgeEventFromRow({ ...badgeEventToRow(mint), kind: 'steal' })).toBeNull();
  });
});

describe('resolution (verifiable scarcity, 7.6)', () => {
  it('honors ONLY the signed supply cap, dedupes recipients, ignores forgeries', () => {
    const mint = createBadgeMintEvent(owner, { communityId, badgeId: BADGE_ID, name: 'Rare', glyph: '⭐', supplyCap: 2, createdAt: '2026-08-29T10:00:00.000Z' });
    const extras: ReturnType<typeof createBadgeAwardEvent>[] = [];
    const recipients = [member.publicKey, admin.publicKey, owner.publicKey];
    recipients.forEach((recipient, index) => {
      extras.push(createBadgeAwardEvent(owner, {
        communityId, badgeId: BADGE_ID, recipientDevice: recipient,
        createdAt: `2026-08-29T10:0${index + 1}:00.000Z`,
      }));
    });
    // Duplicate award to the first recipient: deduped, not double-counted.
    extras.push(createBadgeAwardEvent(admin, {
      communityId, badgeId: BADGE_ID, recipientDevice: member.publicKey,
      createdAt: '2026-08-29T10:00:30.000Z',
    }));
    const forged = createBadgeAwardEvent(stranger, { communityId, badgeId: BADGE_ID, recipientDevice: stranger.publicKey });
    const resolved = resolveCommunityBadges([mint, ...extras, forged], d);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.supplyCap).toBe(2);
    // Deterministic order: earliest awards win, only 2 honored.
    expect(resolved[0]!.awardedTo).toEqual([member.publicKey, admin.publicKey]);
  });
});

describe('apply-time validator', () => {
  let testDb: InMemoryTestDatabase | null = null;
  afterEach(() => { testDb?.close(); testDb = null; });

  it('accepts real events, rejects forgeries before INSERT, rejects raw DELETE', () => {
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    createSyncTables(db);
    upsertCommunity(db, signed, owner.publicKey);
    expect(isSignedRowTable(COMMUNITY_BADGES_TABLE)).toBe(true);
    const mint = createBadgeMintEvent(owner, { communityId, badgeId: BADGE_ID, name: 'Real', glyph: '🪺', supplyCap: 5 });
    expect(validateBadgeRow(db, { table: COMMUNITY_BADGES_TABLE, rowId: mint.id, operation: 'INSERT', data: badgeEventToRow(mint) }))
      .toEqual({ ok: true });
    const forged = createBadgeMintEvent(member, { communityId, badgeId: 'b2'.repeat(16), name: 'Fake', glyph: '🪺', supplyCap: 5 });
    expect(validateBadgeRow(db, { table: COMMUNITY_BADGES_TABLE, rowId: forged.id, operation: 'INSERT', data: badgeEventToRow(forged) }))
      .toEqual({ ok: false, reason: 'badge_signature_invalid' });
    expect(validateSignedInboundRow(db, { table: COMMUNITY_BADGES_TABLE, rowId: 'x', operation: 'DELETE', data: null }))
      .toEqual({ ok: false, reason: 'signed_row_delete_rejected' });
  });
});

describe('frozen fixture (canonical-bytes lock)', () => {
  it('the frozen mint + award still verify byte-for-byte', () => {
    const f = badgeFixture as {
      descriptor: { descriptor: typeof d };
      mint: Parameters<typeof verifyBadgeEvent>[0];
      award: Parameters<typeof verifyBadgeEvent>[0];
    };
    expect(verifyBadgeEvent(f.mint, f.descriptor.descriptor)).toBe(true);
    expect(verifyBadgeEvent(f.award, f.descriptor.descriptor)).toBe(true);
    expect(verifyBadgeEvent({ ...f.mint, supplyCap: 999 }, f.descriptor.descriptor)).toBe(false);
  });
});
