// Plan 31 P5 (web): unread aggregation + admin capability gating for the
// community list + settings surfaces. Pure; no DB.

import { describe, expect, it } from 'vitest';
import { communityAdminCaps, totalUnreadCount } from '../community-list-core';

describe('web totalUnreadCount', () => {
  it('sums positive per-channel counts', () => {
    expect(totalUnreadCount({ general: 2, trips: 3, quiet: 0 })).toBe(5);
  });

  it('excludes muted channels from the total', () => {
    expect(totalUnreadCount({ general: 2, trips: 3 }, new Set(['trips']))).toBe(2);
  });

  it('is zero for an empty count map', () => {
    expect(totalUnreadCount({})).toBe(0);
  });
});

describe('web communityAdminCaps', () => {
  it('grants owner both isOwner and canInvite', () => {
    expect(communityAdminCaps('owner')).toEqual({ isOwner: true, canInvite: true });
  });

  it('grants an admin canInvite but not isOwner', () => {
    expect(communityAdminCaps('admin')).toEqual({ isOwner: false, canInvite: true });
  });

  it('denies a plain member and a pending (null) role', () => {
    expect(communityAdminCaps('member')).toEqual({ isOwner: false, canInvite: false });
    expect(communityAdminCaps(null)).toEqual({ isOwner: false, canInvite: false });
  });
});
