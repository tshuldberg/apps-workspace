import { describe, expect, it } from 'vitest';
import {
  createCommunityProfileEvent,
  generateDeviceIdentity,
  isValidCommunityAvatarImage,
  verifyCommunityProfileEvent,
} from '../index';
import { verifySignature } from '../identity/device-identity';
import { hexToBytes } from '../encryption/keys';

// A tiny well-formed base64 JPEG fixture. The `/9j/` prefix is the base64 encoding
// of the JPEG SOI magic bytes (FF D8 FF), which is exactly the data-shape gate the
// verifier enforces. Both fixtures are valid base64 under the 32 KB cap.
function jpegFixture(fill: string): string {
  let body = `/9j/4AAQSkZJRg${fill}`;
  while (body.length % 4 !== 0) body += 'A';
  return body;
}
const VALID_JPEG_B64 = jpegFixture('AAAA');
const OTHER_JPEG_B64 = jpegFixture('BBBB');

describe('community profile events', () => {
  it('signs a per-community display name with the member device key', () => {
    const member = generateDeviceIdentity('Global Name');
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: '  River   Person  ',
      avatarInitial: 'r',
      updatedAt: '2026-06-24T12:00:00.000Z',
    });

    expect(event.memberDeviceId).toBe(member.publicKey);
    expect(event.displayName).toBe('River Person');
    expect(event.avatarInitial).toBe('R');
    expect(event.version).toBe(1);
    expect(event.avatarImage).toBeUndefined();
    expect(verifyCommunityProfileEvent(event)).toBe(true);
  });

  it('rejects tampered display names and forged member ids', () => {
    const member = generateDeviceIdentity('Global Name');
    const other = generateDeviceIdentity('Other');
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      updatedAt: '2026-06-24T12:00:00.000Z',
    });

    expect(verifyCommunityProfileEvent({ ...event, displayName: 'Different' })).toBe(false);
    expect(verifyCommunityProfileEvent({ ...event, memberDeviceId: other.publicKey })).toBe(false);
  });

  // TC-1: the v1 canonical form must never drift once v2 exists. We independently
  // rebuild the exact array the signature must cover; if the v1 canonical shape,
  // tag, or field order changed, this reconstruction no longer matches the signed
  // bytes and verifySignature fails.
  it('keeps v1 canonical bytes byte-identical to the pre-v2 form (regression)', () => {
    const member = generateDeviceIdentity('Fixture');
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-fix',
      displayName: 'River',
      avatarInitial: 'R',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(event.version).toBe(1);
    expect(event.avatarImage).toBeUndefined();
    const expected = new TextEncoder().encode(JSON.stringify([
      'meerkat-community-profile-v1',
      1,
      'community-fix',
      member.publicKey,
      'River',
      'R',
      '2026-07-01T00:00:00.000Z',
    ]));
    expect(verifySignature(member.publicKey, expected, hexToBytes(event.signature))).toBe(true);
    expect(verifyCommunityProfileEvent(event)).toBe(true);
  });

  it('signs and verifies a v2 event carrying a base64 JPEG avatar', () => {
    const member = generateDeviceIdentity('Photo');
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      avatarImage: VALID_JPEG_B64,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(event.version).toBe(2);
    expect(event.avatarImage).toBe(VALID_JPEG_B64);
    expect(verifyCommunityProfileEvent(event)).toBe(true);
  });

  it('rejects an oversized avatar at create and at verify (fail-closed)', () => {
    const member = generateDeviceIdentity('Big');
    const oversized = `/9j/${'A'.repeat(44_000)}`; // > 43,690 chars -> > 32 KB decoded
    expect(isValidCommunityAvatarImage(oversized)).toBe(false);
    expect(() => createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      avatarImage: oversized,
    })).toThrow();

    const valid = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      avatarImage: VALID_JPEG_B64,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(verifyCommunityProfileEvent({ ...valid, avatarImage: oversized })).toBe(false);
  });

  it('rejects a non-JPEG (magic-byte) avatar shape', () => {
    const member = generateDeviceIdentity('Shape');
    // Valid base64, correct length, but not the /9j/ SOI prefix.
    expect(isValidCommunityAvatarImage('AAAABBBBCCCC')).toBe(false);
    expect(() => createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      avatarImage: 'AAAABBBBCCCC',
    })).toThrow();
  });

  it('fails verification when the avatar image is tampered after signing', () => {
    const member = generateDeviceIdentity('Tamper');
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      avatarImage: VALID_JPEG_B64,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(verifyCommunityProfileEvent({ ...event, avatarImage: OTHER_JPEG_B64 })).toBe(false);
  });

  it('rejects a v1 event that carries an avatar image (outside the signature)', () => {
    const member = generateDeviceIdentity('V1');
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(event.version).toBe(1);
    expect(verifyCommunityProfileEvent({ ...event, avatarImage: VALID_JPEG_B64 })).toBe(false);
  });
});

// Plan 56 C2 (feature 53): persona fields ride ONLY a v3 signature.
describe('v3 persona fields', () => {
  const member = generateDeviceIdentity('Persona');

  it('signs and verifies bio + pronouns + nameColor on a v3 event', () => {
    const event = createCommunityProfileEvent(member, {
      communityId: 'community-a',
      displayName: 'River',
      avatarImage: VALID_JPEG_B64,
      bio: '  Burrow architect. Ask me about dams.  ',
      pronouns: 'they/them',
      nameColor: 'success',
      updatedAt: '2026-08-29T12:00:00.000Z',
    });
    expect(event.version).toBe(3);
    expect(event.bio).toBe('Burrow architect. Ask me about dams.');
    expect(event.pronouns).toBe('they/them');
    expect(event.nameColor).toBe('success');
    expect(event.avatarImage).toBe(VALID_JPEG_B64);
    expect(verifyCommunityProfileEvent(event)).toBe(true);
    expect(verifyCommunityProfileEvent({ ...event, bio: 'Edited after signing' })).toBe(false);
    expect(verifyCommunityProfileEvent({ ...event, nameColor: 'danger' })).toBe(false);
  });

  it('any persona field alone selects v3; none keeps v1/v2 bytes untouched', () => {
    expect(createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R', pronouns: 'she/her' }).version).toBe(3);
    expect(createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R', nameColor: 'info' }).version).toBe(3);
    expect(createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R' }).version).toBe(1);
    expect(createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R', avatarImage: VALID_JPEG_B64 }).version).toBe(2);
  });

  it('rejects persona fields riding a non-v3 signature (fail-closed both directions)', () => {
    const v1 = createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R', updatedAt: '2026-08-29T12:00:00.000Z' });
    expect(verifyCommunityProfileEvent({ ...v1, bio: 'smuggled' })).toBe(false);
    expect(verifyCommunityProfileEvent({ ...v1, nameColor: 'accent' })).toBe(false);
    const v2 = createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R', avatarImage: VALID_JPEG_B64, updatedAt: '2026-08-29T12:00:00.000Z' });
    expect(verifyCommunityProfileEvent({ ...v2, pronouns: 'they/them' })).toBe(false);
  });

  it('rejects an unknown nameColor at create and at verify', () => {
    expect(() => createCommunityProfileEvent(member, {
      communityId: 'c', displayName: 'R', nameColor: '#ff0000' as never,
    })).toThrow(/name color/i);
    const event = createCommunityProfileEvent(member, { communityId: 'c', displayName: 'R', nameColor: 'accent' });
    expect(verifyCommunityProfileEvent({ ...event, nameColor: '#ff0000' as never })).toBe(false);
  });

  it('caps bio and pronouns lengths at create; oversized values never verify', () => {
    const event = createCommunityProfileEvent(member, {
      communityId: 'c', displayName: 'R', bio: 'x'.repeat(500), pronouns: 'y'.repeat(90),
    });
    expect(event.bio).toHaveLength(280);
    expect(event.pronouns).toHaveLength(40);
    expect(verifyCommunityProfileEvent(event)).toBe(true);
    expect(verifyCommunityProfileEvent({ ...event, bio: 'z'.repeat(281) })).toBe(false);
    expect(verifyCommunityProfileEvent({ ...event, pronouns: 'z'.repeat(41) })).toBe(false);
  });
});
