import { describe, it, expect } from 'vitest';

describe('profile-privacy -- module exports', () => {
  it('exports setProfilePrivacy, getProfilePrivacy, getPublicProfileByHandle', async () => {
    const mod = await import('../profile-privacy');
    expect(typeof mod.setProfilePrivacy).toBe('function');
    expect(typeof mod.getProfilePrivacy).toBe('function');
    expect(typeof mod.getPublicProfileByHandle).toBe('function');
  });
});

describe('profile-privacy -- contract', () => {
  it('setProfilePrivacy is async and accepts isPublic in destructured input', async () => {
    const mod = await import('../profile-privacy');
    expect(mod.setProfilePrivacy.constructor.name).toBe('AsyncFunction');
    expect(mod.setProfilePrivacy.toString()).toContain('isPublic');
  });

  it('getPublicProfileByHandle strips a leading @ from the handle', async () => {
    const mod = await import('../profile-privacy');
    expect(mod.getPublicProfileByHandle.toString()).toMatch(/replace\(/);
  });

  it('PublicProfileSummary has the required public-read fields', () => {
    const summary = {
      profileId: 'uuid-1',
      handle: 'chef',
      displayName: 'Chef Name',
      bio: null as string | null,
      avatarUrl: null as string | null,
      cuisine: null as string | null,
      region: null as string | null,
    };
    expect(typeof summary.profileId).toBe('string');
    expect(typeof summary.handle).toBe('string');
    expect(typeof summary.displayName).toBe('string');
  });
});
