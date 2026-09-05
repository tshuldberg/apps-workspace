// Plan 31 P5 (web): the add-friend zero-transport helpers. The needs-a-server line
// is the single honest fallback (no roadmap promise). isPlausibleFriendCode is a
// cheap front gate, not a trust decision.

import { describe, expect, it } from 'vitest';
import { generateFriendCode } from '@mylife/sync';
import { ADD_FRIEND_NEEDS_SERVER_LINE, isPlausibleFriendCode } from '../add-friend-core';

describe('web add-friend honest line', () => {
  it('is the single honest needs-a-server line with no roadmap promise', () => {
    expect(ADD_FRIEND_NEEDS_SERVER_LINE).toBe('Adding a friend needs a connection server.');
    expect(ADD_FRIEND_NEEDS_SERVER_LINE.toLowerCase()).not.toContain('coming');
    expect(ADD_FRIEND_NEEDS_SERVER_LINE.toLowerCase()).not.toContain('soon');
    expect(ADD_FRIEND_NEEDS_SERVER_LINE.toLowerCase()).not.toContain('free default');
  });
});

describe('web isPlausibleFriendCode', () => {
  it('accepts a real generated friend code', () => {
    expect(isPlausibleFriendCode(generateFriendCode().code)).toBe(true);
  });

  it('rejects obvious garbage', () => {
    expect(isPlausibleFriendCode('not-a-code')).toBe(false);
    expect(isPlausibleFriendCode('')).toBe(false);
  });
});
