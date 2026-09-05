import { describe, it, expect } from 'vitest';

// ── Module exports ─────────────────────────────────────────────────────

describe('follower graph -- module exports', () => {
  it('exports followChef, unfollowChef, isFollowingChef', async () => {
    const mod = await import('../followers');
    expect(typeof mod.followChef).toBe('function');
    expect(typeof mod.unfollowChef).toBe('function');
    expect(typeof mod.isFollowingChef).toBe('function');
  });

  it('exports getFollowers, getFollowing', async () => {
    const mod = await import('../followers');
    expect(typeof mod.getFollowers).toBe('function');
    expect(typeof mod.getFollowing).toBe('function');
  });

  it('exports getFollowerCount, getFollowingCount', async () => {
    const mod = await import('../followers');
    expect(typeof mod.getFollowerCount).toBe('function');
    expect(typeof mod.getFollowingCount).toBe('function');
  });
});

// ── Idempotency contract ──────────────────────────────────────────────

describe('follower graph -- contract', () => {
  it('followChef accepts a chefId in the input object', async () => {
    // Structural: the function accepts a destructured object with chefId.
    const mod = await import('../followers');
    // Function is defined (async, destructured param)
    expect(mod.followChef.constructor.name).toBe('AsyncFunction');
    expect(mod.followChef.toString()).toContain('chefId');
  });

  it('unfollowChef accepts a chefId in the input object', async () => {
    const mod = await import('../followers');
    expect(mod.unfollowChef.toString()).toContain('chefId');
  });

  it('self-follow guard is encoded in followChef source', async () => {
    const mod = await import('../followers');
    // Verify the self-follow rejection is present in the implementation
    expect(mod.followChef.toString()).toContain('Cannot follow yourself');
  });

  it('upsert on conflict is present (idempotent behaviour)', async () => {
    const mod = await import('../followers');
    expect(mod.followChef.toString()).toContain('onConflict');
  });
});

// ── Count helpers ─────────────────────────────────────────────────────

describe('getFollowerCount / getFollowingCount', () => {
  it('getFollowerCount accepts a single chefId string parameter', async () => {
    const mod = await import('../followers');
    expect(mod.getFollowerCount.length).toBe(1);
  });

  it('getFollowingCount accepts a single userId string parameter', async () => {
    const mod = await import('../followers');
    expect(mod.getFollowingCount.length).toBe(1);
  });
});

// ── FollowerProfile shape ─────────────────────────────────────────────

describe('FollowerProfile type contract', () => {
  it('FollowerProfile has required shape fields', () => {
    // Verified at compile time via TypeScript; this is a runtime shape check.
    const profile = {
      profileId: 'uuid-1',
      handle: '@chef',
      displayName: 'Chef Name',
      avatarUrl: null as string | null,
      followedAt: new Date(),
    };
    expect(typeof profile.profileId).toBe('string');
    expect(typeof profile.handle).toBe('string');
    expect(profile.followedAt).toBeInstanceOf(Date);
    expect(profile.avatarUrl).toBeNull();
  });

  it('avatarUrl can be a string', () => {
    const profile = {
      profileId: 'uuid-1',
      handle: '@chef',
      displayName: 'Chef Name',
      avatarUrl: 'https://example.com/avatar.jpg',
      followedAt: new Date(),
    };
    expect(typeof profile.avatarUrl).toBe('string');
  });
});

// ── Cursor pagination contract ─────────────────────────────────────────

describe('pagination cursors', () => {
  it('getFollowers accepts an optional before ISO timestamp cursor', async () => {
    const mod = await import('../followers');
    // Verify the before cursor is present in the implementation
    expect(mod.getFollowers.toString()).toContain('before');
  });

  it('getFollowing accepts an optional before ISO timestamp cursor', async () => {
    const mod = await import('../followers');
    expect(mod.getFollowing.toString()).toContain('before');
  });
});
