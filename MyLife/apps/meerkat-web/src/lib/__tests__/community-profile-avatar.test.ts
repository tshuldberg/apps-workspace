// Plan 32 T2.2 (web twin): a v2 community profile avatar survives a real row
// round-trip on the browser adapter. The KEY BUG this guards: without a persisted
// version + avatar_image, a stored v2 event reconstructs as v1, its canonical bytes
// differ, verifyCommunityProfileEvent fails on read, and the avatar is dropped.

import { afterEach, describe, expect, it } from 'vitest';
import { createCommunityProfileEvent, verifyCommunityProfileEvent } from '@mylife/sync';
import {
  communityProfileEventFromRow,
  insertCommunityProfileRow,
  type CommunityProfileRow,
} from '../meerkat-data';
import { buildWebNode, destroyNode, type WebNode } from './support/web-node-harness';

const JPEG = '/9j/4AAQSkZJRgAA'; // valid base64 JPEG magic prefix, well under the cap

let node: WebNode | null = null;

afterEach(async () => {
  await destroyNode(node);
  node = null;
});

describe('community profile v2 avatar round-trip (web twin)', () => {
  it('persists version + avatar_image so a stored v2 event verifies on reload', async () => {
    node = await buildWebNode('AvatarWeb');
    const db = node.db;
    const member = node.identity;

    const selectRow = (id: string) => db.query<CommunityProfileRow>(
      `SELECT id, community_id, member_device_id, display_name, avatar_initial, avatar_image, version, updated_at, signature
       FROM cm_profiles WHERE id = ?`,
      [id],
    );

    const v2 = createCommunityProfileEvent(member, {
      communityId: 'community-web',
      displayName: 'Photo Member',
      avatarImage: JPEG,
      updatedAt: '2026-07-01T10:05:00.000Z',
    });
    expect(v2.version).toBe(2);
    insertCommunityProfileRow(db, v2);

    const v2Rows = selectRow(v2.id);
    expect(v2Rows).toHaveLength(1);
    expect(v2Rows[0]!.version).toBe(2);
    const reconstructed = communityProfileEventFromRow(v2Rows[0]!);
    expect(reconstructed.version).toBe(2);
    expect(reconstructed.avatarImage).toBe(JPEG);
    expect(verifyCommunityProfileEvent(reconstructed)).toBe(true);

    // A v1 profile row still round-trips unchanged.
    const v1 = createCommunityProfileEvent(member, {
      communityId: 'community-web',
      displayName: 'Photo Member',
      updatedAt: '2026-07-01T10:06:00.000Z',
    });
    expect(v1.version).toBe(1);
    insertCommunityProfileRow(db, v1);
    const v1Reconstructed = communityProfileEventFromRow(selectRow(v1.id)[0]!);
    expect(v1Reconstructed.version).toBe(1);
    expect(v1Reconstructed.avatarImage).toBeUndefined();
    expect(verifyCommunityProfileEvent(v1Reconstructed)).toBe(true);
  });
});
