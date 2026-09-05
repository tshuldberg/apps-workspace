// AC-9 (web): the People list resolves a friend's signed community avatar across
// the viewer's communities (image -> initial -> ?). resolveFriendAvatarImage
// returns the first signature-verified v2 avatar found among the given community
// ids, or null when the friend has set no photo anywhere. Twin of the mobile
// resolveFriendAvatarImage in community-core.ts.

import { afterEach, describe, expect, it } from 'vitest';
import {
  createCommunity,
  createCommunityProfileEvent,
  generateDeviceIdentity,
  upsertCommunity,
  type DeviceIdentity,
} from '@mylife/sync';
import { insertCommunityProfileRow, resolveFriendAvatarImage } from '../meerkat-data';
import { buildWebNode, destroyNode, type WebNode } from './support/web-node-harness';

const JPEG = '/9j/4AAQSkZJRgAA'; // valid base64 JPEG magic prefix, well under the cap

let node: WebNode | null = null;

afterEach(async () => {
  await destroyNode(node);
  node = null;
});

// Persist a community that both the viewer (owner) and the friend belong to, so
// the friend's profile events are trusted (listCommunityProfileEvents requires a
// stored community whose descriptor lists the member).
function seedSharedCommunity(node: WebNode, friend: DeviceIdentity, name: string): string {
  const signed = createCommunity(node.identity, {
    name,
    channels: [{ id: 'general', name: 'general' }],
    members: [{ deviceId: friend.publicKey, role: 'member', displayName: 'Friend', dhPublicKey: friend.dhPublicKey }],
    now: '2026-07-01T10:00:00.000Z',
  });
  upsertCommunity(node.db, signed, node.identity.publicKey, '2026-07-01T10:00:00.000Z');
  return signed.descriptor.communityId;
}

describe('resolveFriendAvatarImage (web People list, AC-9)', () => {
  it('returns the first verified v2 avatar found across the given communities', async () => {
    node = await buildWebNode('FriendAvatarWeb');
    const friend = generateDeviceIdentity('Friend');
    const communityA = seedSharedCommunity(node, friend, 'No photo here');
    const communityB = seedSharedCommunity(node, friend, 'Photo here');

    // The friend signs a v2 profile (with a photo) in community B only.
    insertCommunityProfileRow(node.db, createCommunityProfileEvent(friend, {
      communityId: communityB,
      displayName: 'Friend',
      avatarImage: JPEG,
      updatedAt: '2026-07-01T10:05:00.000Z',
    }));

    // Searching A -> B finds the photo in B (first verified avatar across the list).
    expect(resolveFriendAvatarImage(node.db, [communityA, communityB], friend.publicKey)).toBe(JPEG);
  });

  it('falls back to null when the friend has no photo in any shared community', async () => {
    node = await buildWebNode('FriendAvatarWebNone');
    const friend = generateDeviceIdentity('Friend');
    const communityA = seedSharedCommunity(node, friend, 'No photo');

    // A v1 profile (no photo) yields no image; the People row uses the initial.
    insertCommunityProfileRow(node.db, createCommunityProfileEvent(friend, {
      communityId: communityA,
      displayName: 'Friend',
      updatedAt: '2026-07-01T10:05:00.000Z',
    }));

    expect(resolveFriendAvatarImage(node.db, [communityA], friend.publicKey)).toBeNull();
    // An unknown device and an empty community list both resolve to null.
    expect(resolveFriendAvatarImage(node.db, [communityA], generateDeviceIdentity('Other').publicKey)).toBeNull();
    expect(resolveFriendAvatarImage(node.db, [], friend.publicKey)).toBeNull();
  });
});
