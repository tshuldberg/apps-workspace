/**
 * Community badges (Plan 56 features 37-38, C2): owner-minted, verifiably
 * scarce collectibles. Two event kinds in one or_set table (cm_badges), on
 * the same signed spine as the canvas events:
 *
 *   - MINT (owner-signed): defines a badge -- name, glyph, color token, and a
 *     SIGNED supply cap. Scarcity is verifiable, not promised (the Habbo
 *     rares lesson): every member can count the awards against the cap.
 *   - AWARD (owner/admin-signed): grants one badge to one member. Resolution
 *     orders verified awards deterministically and honors only the first
 *     `supplyCap` of them, so an over-issued badge can never display more
 *     copies than its mint promised.
 *
 * Anti-spoofing (7.4): a badge glyph renders NEXT TO avatars and names, the
 * highest-risk spoof surface, so the reserved trust-glyph set is enforced at
 * the PROTOCOL layer here (not only in the app registry); the app's sticker
 * exclusion list mirrors it and a test pins the two together.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import { communityRole, getCommunity, type CommunityDescriptor } from './community';

const encoder = new TextEncoder();

export const COMMUNITY_BADGES_TABLE = 'cm_badges';

export const BADGE_NAME_MAX_CHARS = 60;
export const BADGE_SUPPLY_MIN = 1;
export const BADGE_SUPPLY_MAX = 10_000;

/** The protocol-level reserved trust glyphs (mirrors the app registry's list). */
export const SYNC_RESERVED_SPOOF_GLYPHS = [
  '\u{1F512}', '\u{1F513}', '\u{1F50F}', '\u{1F510}', '\u{1F6E1}',
  '\u{2705}', '\u{2714}', '\u{2611}', '\u{1F6C2}', '\u{2696}',
] as const;

export function badgeGlyphAllowed(glyph: string): boolean {
  if (!glyph || glyph.length > 16) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(glyph)) return false;
  return !SYNC_RESERVED_SPOOF_GLYPHS.some((reserved) => glyph.includes(reserved));
}

const ID_PATTERN = /^[0-9a-f]{16,64}$/;
const COLOR_TOKENS = ['text', 'muted', 'accent', 'paper', 'surface', 'success', 'warning', 'danger', 'info'] as const;

export type CommunityBadgeEventKind = 'mint' | 'award';

export interface CommunityBadgeEvent {
  version: 1;
  /** Content-addressed event id. */
  id: string;
  communityId: string;
  kind: CommunityBadgeEventKind;
  /** The badge identity (mint chooses it; awards reference it). */
  badgeId: string;
  /** mint: the badge name; null on awards. */
  name: string | null;
  /** mint: the badge glyph (reserved trust glyphs excluded); null on awards. */
  glyph: string | null;
  /** mint: closed color token; null on awards. */
  colorToken: string | null;
  /** mint: the SIGNED supply cap; null on awards. */
  supplyCap: number | null;
  /** award: the recipient member device; null on mints. */
  recipientDevice: string | null;
  createdAt: string;
  signedBy: string;
  signature: string;
}

type UnsignedBadgeEvent = Omit<CommunityBadgeEvent, 'id' | 'signature'>;
type SignedBadgeEventWithoutId = Omit<CommunityBadgeEvent, 'id'>;

function canonicalBadge(event: UnsignedBadgeEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-community-badge-v1',
    event.version,
    event.communityId,
    event.kind,
    event.badgeId,
    event.name,
    event.glyph,
    event.colorToken,
    event.supplyCap,
    event.recipientDevice,
    event.createdAt,
    event.signedBy,
  ]));
}

export function badgeEventId(event: SignedBadgeEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalBadge(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

export interface MintBadgeInput {
  communityId: string;
  badgeId: string;
  name: string;
  glyph: string;
  colorToken?: string;
  supplyCap: number;
  createdAt?: string;
}

export function createBadgeMintEvent(owner: DeviceIdentity, input: MintBadgeInput): CommunityBadgeEvent {
  if (!ID_PATTERN.test(input.badgeId)) throw new Error('A badge id must be 16-64 hex characters.');
  const name = input.name.trim();
  if (!name || name.length > BADGE_NAME_MAX_CHARS) throw new Error('A badge name must be 1-60 characters.');
  if (!badgeGlyphAllowed(input.glyph)) throw new Error('That glyph is reserved or invalid.');
  const colorToken = input.colorToken ?? 'accent';
  if (!(COLOR_TOKENS as readonly string[]).includes(colorToken)) throw new Error('Unknown color token.');
  if (!Number.isInteger(input.supplyCap) || input.supplyCap < BADGE_SUPPLY_MIN || input.supplyCap > BADGE_SUPPLY_MAX) {
    throw new Error('A badge supply cap must be 1-10000.');
  }
  const unsigned: UnsignedBadgeEvent = {
    version: 1,
    communityId: input.communityId,
    kind: 'mint',
    badgeId: input.badgeId,
    name,
    glyph: input.glyph,
    colorToken,
    supplyCap: input.supplyCap,
    recipientDevice: null,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signedBy: owner.publicKey,
  };
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(owner.privateKeyRef), canonicalBadge(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: badgeEventId(withoutId) };
}

export interface AwardBadgeInput {
  communityId: string;
  badgeId: string;
  recipientDevice: string;
  createdAt?: string;
}

export function createBadgeAwardEvent(curator: DeviceIdentity, input: AwardBadgeInput): CommunityBadgeEvent {
  if (!ID_PATTERN.test(input.badgeId)) throw new Error('A badge id must be 16-64 hex characters.');
  if (!input.recipientDevice) throw new Error('A recipient is required.');
  const unsigned: UnsignedBadgeEvent = {
    version: 1,
    communityId: input.communityId,
    kind: 'award',
    badgeId: input.badgeId,
    name: null,
    glyph: null,
    colorToken: null,
    supplyCap: null,
    recipientDevice: input.recipientDevice,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signedBy: curator.publicKey,
  };
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(curator.privateKeyRef), canonicalBadge(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: badgeEventId(withoutId) };
}

/**
 * Verify a badge event against the descriptor. Mints bind to the OWNER;
 * awards bind to the owner or an admin. Fail-closed on any structural, cap,
 * glyph, authority, id, or signature violation.
 */
export function verifyBadgeEvent(event: CommunityBadgeEvent, descriptor: CommunityDescriptor): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.communityId || event.communityId !== descriptor.communityId) return false;
  if (!ID_PATTERN.test(event.badgeId ?? '')) return false;
  if (!event.createdAt || !event.signedBy) return false;
  if (event.kind === 'mint') {
    if (event.signedBy !== descriptor.ownerDeviceId) return false;
    if (typeof event.name !== 'string' || !event.name || event.name.length > BADGE_NAME_MAX_CHARS) return false;
    if (typeof event.glyph !== 'string' || !badgeGlyphAllowed(event.glyph)) return false;
    if (typeof event.colorToken !== 'string' || !(COLOR_TOKENS as readonly string[]).includes(event.colorToken)) return false;
    if (!Number.isInteger(event.supplyCap) || (event.supplyCap as number) < BADGE_SUPPLY_MIN || (event.supplyCap as number) > BADGE_SUPPLY_MAX) return false;
    if (event.recipientDevice !== null) return false;
  } else if (event.kind === 'award') {
    const role = communityRole(descriptor, event.signedBy);
    if (role !== 'owner' && role !== 'admin') return false;
    if (event.name !== null || event.glyph !== null || event.colorToken !== null || event.supplyCap !== null) return false;
    if (typeof event.recipientDevice !== 'string' || !event.recipientDevice) return false;
  } else {
    return false;
  }
  if (event.id !== badgeEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalBadge(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function badgeEventToRow(event: CommunityBadgeEvent): Record<string, unknown> {
  return {
    id: event.id,
    community_id: event.communityId,
    kind: event.kind,
    badge_id: event.badgeId,
    name: event.name,
    glyph: event.glyph,
    color_token: event.colorToken,
    supply_cap: event.supplyCap,
    recipient_device: event.recipientDevice,
    created_at: event.createdAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

function rowString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

export function badgeEventFromRow(data: Record<string, unknown>): CommunityBadgeEvent | null {
  const id = rowString(data.id);
  const communityId = rowString(data.community_id);
  const kind = rowString(data.kind);
  const badgeId = rowString(data.badge_id);
  const createdAt = rowString(data.created_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !communityId || !kind || !badgeId || !createdAt || !signedBy || !signature) return null;
  if (kind !== 'mint' && kind !== 'award') return null;
  const name = rowString(data.name);
  const glyph = rowString(data.glyph);
  const colorToken = rowString(data.color_token);
  const recipientDevice = rowString(data.recipient_device);
  if (name === undefined || glyph === undefined || colorToken === undefined || recipientDevice === undefined) return null;
  const supplyRaw = data.supply_cap;
  const supplyCap = supplyRaw === null || supplyRaw === undefined
    ? null
    : (typeof supplyRaw === 'number' && Number.isInteger(supplyRaw) ? supplyRaw : undefined);
  if (supplyCap === undefined) return null;
  return {
    version: 1,
    id,
    communityId,
    kind: kind as CommunityBadgeEventKind,
    badgeId,
    name,
    glyph,
    colorToken,
    supplyCap,
    recipientDevice,
    createdAt,
    signedBy,
    signature,
  };
}

export interface ResolvedBadge {
  badgeId: string;
  name: string;
  glyph: string;
  colorToken: string;
  supplyCap: number;
  /** VERIFIED awards honored within the cap, in deterministic order. */
  awardedTo: string[];
}

/**
 * Resolve a community's badges from candidate events. Mints dedupe per
 * badgeId (earliest verified mint wins, ties by id); awards are ordered
 * (createdAt, then id), deduped per recipient, and honored only up to the
 * SIGNED supply cap. Every count shown derives from this (7.6).
 */
export function resolveCommunityBadges(
  events: readonly CommunityBadgeEvent[],
  descriptor: CommunityDescriptor,
): ResolvedBadge[] {
  const verified = events.filter((event) => verifyBadgeEvent(event, descriptor));
  const mints = new Map<string, CommunityBadgeEvent>();
  for (const event of verified) {
    if (event.kind !== 'mint') continue;
    const existing = mints.get(event.badgeId);
    if (!existing
      || event.createdAt < existing.createdAt
      || (event.createdAt === existing.createdAt && event.id < existing.id)) {
      mints.set(event.badgeId, event);
    }
  }
  const badges: ResolvedBadge[] = [];
  for (const mint of [...mints.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    const awards = verified
      .filter((event) => event.kind === 'award' && event.badgeId === mint.badgeId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
    const awardedTo: string[] = [];
    const seen = new Set<string>();
    for (const award of awards) {
      if (awardedTo.length >= (mint.supplyCap as number)) break;
      const recipient = award.recipientDevice as string;
      if (seen.has(recipient)) continue;
      seen.add(recipient);
      awardedTo.push(recipient);
    }
    badges.push({
      badgeId: mint.badgeId,
      name: mint.name as string,
      glyph: mint.glyph as string,
      colorToken: mint.colorToken as string,
      supplyCap: mint.supplyCap as number,
      awardedTo,
    });
  }
  return badges;
}

// --- apply-time validator --------------------------------------------------

export type BadgeRowVerdict = { ok: true } | { ok: false; reason: string };

export function validateBadgeRow(
  db: DatabaseAdapter,
  change: { table: string; rowId: string; operation: string; data: Record<string, unknown> | null | undefined },
): BadgeRowVerdict {
  if (!change.data) return { ok: false, reason: 'badge_row_malformed' };
  const event = badgeEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'badge_row_malformed' };
  const community = getCommunity(db, event.communityId);
  if (!community) return { ok: false, reason: 'badge_community_unknown' };
  if (!verifyBadgeEvent(event, community.descriptor)) return { ok: false, reason: 'badge_signature_invalid' };
  return { ok: true };
}
