/**
 * Plan 38 Phase 0/1 -- cm_community_identity protocol (owner-signed cosmetic
 * identity). The avatar rule applies throughout: an UNVERIFIED event renders
 * NOTHING, and every cap is enforced at create AND verify (fail-closed).
 * Icon = in-row base64 JPEG (avatar gate); banner = sealed library object
 * referenced by cid + epoch-wrapped DEK + manifest JSON (all-or-nothing).
 */

import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { generateDeviceIdentity } from '../identity/device-identity';
import { sealLibraryObject } from '../protocol/library-objects';
import {
  COMMUNITY_BANNER_MANIFEST_MAX_CHARS,
  COMMUNITY_BANNER_MAX_BYTES,
  COMMUNITY_DESCRIPTION_MAX_CHARS,
  COMMUNITY_THEME_BLOB_MAX_CHARS,
  communityIdentityEventFromRow,
  communityIdentityEventToRow,
  createCommunityIdentityEvent,
  isValidCommunityIdentityBanner,
  isValidCommunityThemeBlob,
  resolveCommunityIdentity,
  verifyCommunityIdentityEvent,
  type CommunityIdentityBanner,
  type CommunityIdentityEvent,
} from '../protocol/community-identity';

const owner = generateDeviceIdentity('Owner');
const stranger = generateDeviceIdentity('Stranger');
const COMMUNITY_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';
const ICON = '/9j/AAAA'; // base64 JPEG SOI prefix, in-cap

function makeBanner(): CommunityIdentityBanner {
  const sealed = sealLibraryObject(new TextEncoder().encode('banner image bytes'), {
    workspaceId: COMMUNITY_ID, epoch: 1, epochSecret: nacl.randomBytes(32),
    name: 'banner.jpg', identity: owner, createdAt: '2026-07-05T00:00:00.000Z',
  });
  return {
    cid: sealed.contentId,
    keyEpoch: sealed.keyEpoch,
    wrappedKey: sealed.wrappedKey,
    manifestJson: JSON.stringify({
      manifest: sealed.share.manifest,
      manifestSignature: sealed.share.manifestSignature,
      sealedChunkIds: sealed.share.sealedChunks.map((c) => c.sealedId),
    }),
  };
}
const BANNER = makeBanner();

function baseEvent(overrides: Partial<Parameters<typeof createCommunityIdentityEvent>[1]> = {}): CommunityIdentityEvent {
  return createCommunityIdentityEvent(owner, {
    communityId: COMMUNITY_ID,
    revision: 1,
    description: 'A cozy space for the crew',
    accentColor: '#0E7C66',
    iconImage: ICON,
    banner: BANNER,
    themeBlob: 'MKTHEME1:eyJ2IjoxfQ',
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...overrides,
  });
}

describe('create + verify round trip', () => {
  it('verifies an owner-signed identity event', () => {
    const event = baseEvent();
    expect(verifyCommunityIdentityEvent(event, owner.publicKey)).toBe(true);
    expect(event.accentColor).toBe('#0e7c66'); // normalized lowercase
    expect(event.iconImage).toBe(ICON);
    expect(event.banner?.cid).toBe(BANNER.cid);
  });

  it('rejects the same event against a DIFFERENT owner (signer-owner binding)', () => {
    const event = baseEvent();
    expect(verifyCommunityIdentityEvent(event, stranger.publicKey)).toBe(false);
  });

  it('rejects a forged event signed by a non-owner even when signedBy claims the owner', () => {
    const forged = createCommunityIdentityEvent(stranger, {
      communityId: COMMUNITY_ID, revision: 2, description: 'hostile takeover',
    });
    expect(verifyCommunityIdentityEvent(forged, owner.publicKey)).toBe(false);
    const impersonated = { ...forged, signedBy: owner.publicKey };
    expect(verifyCommunityIdentityEvent(impersonated as CommunityIdentityEvent, owner.publicKey)).toBe(false);
  });

  it('breaks on tamper of every payload field', () => {
    const event = baseEvent();
    const tampers: Array<Partial<CommunityIdentityEvent>> = [
      { description: 'edited' },
      { accentColor: '#ff0000' },
      { iconImage: '/9j/BBBB' },
      { banner: null },
      { banner: { ...BANNER, wrappedKey: 'ab'.repeat(72) } },
      { themeBlob: 'MKTHEME1:tampered' },
      { revision: 9 },
      { updatedAt: '2027-01-01T00:00:00.000Z' },
      { tombstone: true },
    ];
    for (const patch of tampers) {
      expect(verifyCommunityIdentityEvent({ ...event, ...patch }, owner.publicKey)).toBe(false);
    }
  });
});

describe('caps and normalization (fail-closed at create AND verify)', () => {
  it('slices an over-cap description at create; rejects a non-normalized one at verify', () => {
    const long = 'x'.repeat(COMMUNITY_DESCRIPTION_MAX_CHARS + 50);
    const event = baseEvent({ description: long });
    expect(event.description).toHaveLength(COMMUNITY_DESCRIPTION_MAX_CHARS);
    expect(verifyCommunityIdentityEvent(event, owner.publicKey)).toBe(true);
    const smuggled = { ...event, description: `  ${event.description}  ` };
    expect(verifyCommunityIdentityEvent(smuggled, owner.publicKey)).toBe(false);
  });

  it('throws at create on a malformed accent color or icon image', () => {
    expect(() => baseEvent({ accentColor: 'sea green' })).toThrow();
    expect(() => baseEvent({ accentColor: '#0E7C6' })).toThrow();
    expect(() => baseEvent({ iconImage: 'not-a-jpeg' })).toThrow();
    expect(() => baseEvent({ iconImage: `/9j/${'A'.repeat(64 * 1024)}` })).toThrow();
  });

  it('rejects an over-cap or control-character theme blob at both layers', () => {
    expect(isValidCommunityThemeBlob('a'.repeat(COMMUNITY_THEME_BLOB_MAX_CHARS + 1))).toBe(false);
    expect(isValidCommunityThemeBlob('MKTHEME1: bad')).toBe(false);
    expect(isValidCommunityThemeBlob('MKTHEME1:with\nnewline')).toBe(false);
    expect(() => baseEvent({ themeBlob: 'MKTHEME1: bad' })).toThrow();
    const event = baseEvent();
    expect(verifyCommunityIdentityEvent(
      { ...event, themeBlob: 'a'.repeat(COMMUNITY_THEME_BLOB_MAX_CHARS + 1) },
      owner.publicKey,
    )).toBe(false);
  });

  it('rejects invalid revisions at create and verify', () => {
    expect(() => baseEvent({ revision: 0 })).toThrow();
    expect(() => baseEvent({ revision: 1.5 })).toThrow();
    const event = baseEvent();
    expect(verifyCommunityIdentityEvent({ ...event, revision: -1 }, owner.publicKey)).toBe(false);
  });
});

describe('banner validation (sealed-object reference, all-or-nothing)', () => {
  it('accepts the genuine banner and rejects structural tampering', () => {
    expect(isValidCommunityIdentityBanner(BANNER)).toBe(true);
    expect(isValidCommunityIdentityBanner({ ...BANNER, cid: 'not-hex!' })).toBe(false);
    expect(isValidCommunityIdentityBanner({ ...BANNER, keyEpoch: 0 })).toBe(false);
    expect(isValidCommunityIdentityBanner({ ...BANNER, wrappedKey: 'short' })).toBe(false);
    expect(isValidCommunityIdentityBanner({ ...BANNER, manifestJson: '{not json' })).toBe(false);
    expect(isValidCommunityIdentityBanner({
      ...BANNER, manifestJson: 'x'.repeat(COMMUNITY_BANNER_MANIFEST_MAX_CHARS + 1),
    })).toBe(false);
  });

  it('rejects a manifest whose contentId mismatches the cid or whose size busts the cap', () => {
    const parsed = JSON.parse(BANNER.manifestJson) as { manifest: { contentId: string; size: number } };
    const wrongCid = { ...parsed, manifest: { ...parsed.manifest, contentId: 'ab'.repeat(16) } };
    expect(isValidCommunityIdentityBanner({ ...BANNER, manifestJson: JSON.stringify(wrongCid) })).toBe(false);
    const oversized = { ...parsed, manifest: { ...parsed.manifest, size: COMMUNITY_BANNER_MAX_BYTES + 1 } };
    expect(isValidCommunityIdentityBanner({ ...BANNER, manifestJson: JSON.stringify(oversized) })).toBe(false);
  });

  it('row round-trips, and a PARTIAL banner row is malformed (all-or-nothing)', () => {
    const event = baseEvent();
    const row = communityIdentityEventToRow(event);
    expect(row.banner_manifest_json).toBe(BANNER.manifestJson);
    const back = communityIdentityEventFromRow(row);
    expect(back).toEqual(event);
    expect(verifyCommunityIdentityEvent(back!, owner.publicKey)).toBe(true);

    const partial = { ...row, banner_wrapped_key: null };
    expect(communityIdentityEventFromRow(partial)).toBeNull();
  });
});

describe('tombstone', () => {
  it('creates a payload-free tombstone that verifies', () => {
    const tomb = baseEvent({ revision: 2, tombstone: true });
    expect(tomb.description).toBeNull();
    expect(tomb.iconImage).toBeNull();
    expect(tomb.banner).toBeNull();
    expect(tomb.themeBlob).toBeNull();
    expect(verifyCommunityIdentityEvent(tomb, owner.publicKey)).toBe(true);
  });

  it('rejects a tombstone smuggling payload fields', () => {
    const tomb = baseEvent({ revision: 2, tombstone: true });
    expect(verifyCommunityIdentityEvent({ ...tomb, description: 'ghost' }, owner.publicKey)).toBe(false);
    expect(verifyCommunityIdentityEvent({ ...tomb, banner: BANNER }, owner.publicKey)).toBe(false);
  });
});

describe('resolveCommunityIdentity (latest-owner-signed-wins)', () => {
  it('picks the highest verified revision and skips forged candidates', () => {
    const rev1 = baseEvent();
    const rev2 = baseEvent({ revision: 2, description: 'Updated look' });
    const forgedRev9 = createCommunityIdentityEvent(stranger, { communityId: COMMUNITY_ID, revision: 9, description: 'fake' });
    const resolved = resolveCommunityIdentity([forgedRev9, rev1, rev2], owner.publicKey);
    expect(resolved?.revision).toBe(2);
    expect(resolved?.description).toBe('Updated look');
  });

  it('returns null when nothing verifies or the winner is a tombstone', () => {
    expect(resolveCommunityIdentity([], owner.publicKey)).toBeNull();
    const rev1 = baseEvent();
    const tomb2 = baseEvent({ revision: 2, tombstone: true });
    expect(resolveCommunityIdentity([rev1, tomb2], owner.publicKey)).toBeNull();
  });

  it('breaks revision ties by updatedAt for determinism', () => {
    const a = baseEvent({ revision: 3, description: 'earlier', updatedAt: '2026-07-05T01:00:00.000Z' });
    const b = baseEvent({ revision: 3, description: 'later', updatedAt: '2026-07-05T02:00:00.000Z' });
    expect(resolveCommunityIdentity([a, b], owner.publicKey)?.description).toBe('later');
    expect(resolveCommunityIdentity([b, a], owner.publicKey)?.description).toBe('later');
  });
});
