// Plan 32 P4 follow-up (FIX 1, AC-6 mobile): the feed card resolves the author's
// SIGNED community avatar and feeds it into the FeedAvatar imageUri slot, exactly
// like the web feed. This proves the data path the card wires:
// avatarImageUri(resolveCommunityAvatarImage(db, communityId, authorDeviceId)).
// A member WITH a verified v2 photo profile yields a data URI (the image slot is
// used); a member WITHOUT one yields null (FeedAvatar falls back to the initial).
// Node-only: it asserts resolveCommunityAvatarImage + the exact data-URI shape that
// components/Avatar.avatarImageUri produces (that helper imports react-native, so it
// is not imported here; the shape is reproduced verbatim). getCommunityProfile only
// trusts descriptor members, so a real stored community backs the resolve.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createCommunity,
  createCommunityProfileEvent,
  createSyncTables,
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  ensureCommunityTables,
  insertCommunityProfileRow,
  resolveCommunityAvatarImage,
  storeOwnedCommunity,
} from '../(root)/data/community-core';

const JPEG = '/9j/4AAQSkZJRgAA'; // valid base64 JPEG magic prefix, well under the cap

// Verbatim twin of components/Avatar.avatarImageUri (not imported: it pulls in
// react-native). The FeedCard passes this exact value into FeedAvatar's imageUri.
function avatarImageUri(imageBase64: string | null): string | null {
  if (!imageBase64) return null;
  return `data:image/jpeg;base64,${imageBase64}`;
}

describe('feed card avatar wiring (AC-6, mobile)', () => {
  let db: InMemoryTestDatabase;
  let photoMember: DeviceIdentity;
  let plainMember: DeviceIdentity;
  let communityId: string;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    ensureCommunityTables(db.adapter);
    photoMember = generateDeviceIdentity('Photo');
    plainMember = generateDeviceIdentity('Plain');
    // photoMember owns the community; plainMember is a member. getCommunityProfile
    // only returns a profile for a descriptor member, so both must be listed.
    const signed = createCommunity(photoMember, {
      name: 'Trail Cooks',
      channels: [{ id: 'general', name: 'general' }],
      members: [
        { deviceId: plainMember.publicKey, role: 'member', displayName: 'Plain', dhPublicKey: plainMember.dhPublicKey },
      ],
      now: '2026-07-03T09:00:00.000Z',
    });
    storeOwnedCommunity(db.adapter, photoMember, signed);
    communityId = signed.descriptor.communityId;
  });

  afterEach(() => db.close());

  it('feeds a data URI into the image slot when the author set a photo', () => {
    const event = createCommunityProfileEvent(photoMember, {
      communityId,
      displayName: 'Photo Member',
      avatarImage: JPEG,
      updatedAt: '2026-07-03T10:00:00.000Z',
    });
    expect(event.version).toBe(2);
    insertCommunityProfileRow(db.adapter, event);

    const resolved = resolveCommunityAvatarImage(db.adapter, communityId, photoMember.publicKey);
    expect(resolved).toBe(JPEG);
    expect(avatarImageUri(resolved)).toBe(`data:image/jpeg;base64,${JPEG}`);
  });

  it('feeds null (initial fallback) when the author has no photo or no profile', () => {
    const v1 = createCommunityProfileEvent(plainMember, {
      communityId,
      displayName: 'Plain Member',
      updatedAt: '2026-07-03T10:01:00.000Z',
    });
    expect(v1.version).toBe(1);
    insertCommunityProfileRow(db.adapter, v1);

    expect(resolveCommunityAvatarImage(db.adapter, communityId, plainMember.publicKey)).toBeNull();
    expect(avatarImageUri(resolveCommunityAvatarImage(db.adapter, communityId, plainMember.publicKey))).toBeNull();

    // An author with no profile row at all (e.g. a public-item author) also falls back.
    const stranger = generateDeviceIdentity('Stranger');
    expect(resolveCommunityAvatarImage(db.adapter, communityId, stranger.publicKey)).toBeNull();
  });
});
