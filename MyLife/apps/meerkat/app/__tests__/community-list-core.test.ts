// Communities LIST + settings role gating (Plan 31 Phase 2, T2.5). Plus the
// route-collision reserved-id + deep-link prefix helpers (T1.3) and a disk-read
// assertion that the new community routes are registered/hidden in the tab
// layout (static route wins the `community/join` collision).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { totalUnreadCount, communityAdminCaps } from '../(root)/data/community-list-core';
import {
  COMMUNITY_INVITE_URL_PREFIX,
  isCommunityInviteUrl,
  isReservedCommunityId,
} from '../(root)/data/join-flow';

const appRoot = resolve(__dirname, '..');

describe('totalUnreadCount', () => {
  it('sums positive per-channel unreads and ignores non-positive', () => {
    expect(totalUnreadCount({ a: 3, b: 0, c: 5 })).toBe(8);
    expect(totalUnreadCount({})).toBe(0);
    expect(totalUnreadCount({ a: -1, b: 2 })).toBe(2);
  });

  it('excludes muted channels from the community card sum', () => {
    expect(totalUnreadCount({ a: 3, b: 4, c: 5 }, new Set(['b']))).toBe(8);
    expect(totalUnreadCount({ a: 3 }, new Set(['a']))).toBe(0);
    expect(totalUnreadCount({ a: 3, b: 4 }, new Set())).toBe(7);
  });
});

describe('communityAdminCaps role gating (TC-4)', () => {
  it('owner sees owner-only rows and can invite', () => {
    expect(communityAdminCaps('owner')).toEqual({ isOwner: true, canInvite: true });
  });
  it('admin can invite but is not owner', () => {
    expect(communityAdminCaps('admin')).toEqual({ isOwner: false, canInvite: true });
  });
  it('member/reader/null get no admin surface', () => {
    expect(communityAdminCaps('member')).toEqual({ isOwner: false, canInvite: false });
    expect(communityAdminCaps(null)).toEqual({ isOwner: false, canInvite: false });
  });
});

describe('deep-link + reserved-id guards (T1.3)', () => {
  it('recognizes only the fixed community invite wire prefix', () => {
    expect(COMMUNITY_INVITE_URL_PREFIX).toBe('meerkat://community/join#');
    expect(isCommunityInviteUrl('meerkat://community/join#abc')).toBe(true);
    expect(isCommunityInviteUrl('meerkat://theme/import#abc')).toBe(false);
    expect(isCommunityInviteUrl('https://example.com')).toBe(false);
  });
  it('reserves the join id so the dynamic community route never matches it', () => {
    expect(isReservedCommunityId('join')).toBe(true);
    expect(isReservedCommunityId('some-real-community-id')).toBe(false);
  });
});

describe('route registration (T2.5)', () => {
  const layout = readFileSync(resolve(appRoot, '(root)/(tabs)/_layout.tsx'), 'utf8');
  it('registers the hidden community routes (list detail, settings, static join)', () => {
    expect(layout).toContain('name="community/join"');
    expect(layout).toContain('name="community/[communityId]"');
    expect(layout).toContain('name="community/[communityId]/settings"');
  });
  it('keeps the dynamic community route guarding the reserved id', () => {
    const dyn = readFileSync(resolve(appRoot, '(root)/(tabs)/community/[communityId].tsx'), 'utf8');
    expect(dyn).toContain('isReservedCommunityId');
  });
});
