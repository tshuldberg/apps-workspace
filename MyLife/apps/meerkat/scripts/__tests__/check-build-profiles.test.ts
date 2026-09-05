import { describe, expect, it, vi } from 'vitest';

// Fixture-only config injection; the checked-in EAS profiles are never mutated.
vi.mock('node:fs', () => ({
  readFileSync: () => JSON.stringify({
    build: {
      store: {},
      internal: { distribution: 'internal' },
      inheritedStore: { extends: 'store' },
      inheritedInternal: { extends: 'internal' },
      childStore: { extends: 'internal', distribution: 'store' },
      childInternal: { extends: 'store', distribution: 'internal' },
      mixed: { distribution: 'internal', ios: { distribution: 'store' } },
      inheritedMixed: { extends: 'mixed', distribution: 'internal' },
      platformInternal: { extends: 'mixed', ios: { distribution: 'internal' } },
      cycleA: { extends: 'cycleB', distribution: 'internal' },
      cycleB: { extends: 'cycleA' },
      broken: { extends: 'missing', distribution: 'internal' },
      level2: { extends: 'internal' },
      level3: { extends: 'level2' },
      level4: { extends: 'level3' },
      level5: { extends: 'level4' },
      level6: { extends: 'level5' },
    },
  }),
}));

import { checkBuildEnv } from '../check-build-env.mjs';

const run = (profile: string, platform = 'ios') => checkBuildEnv({
  EAS_BUILD_PROFILE: profile,
  EAS_BUILD_PLATFORM: platform,
});

describe('EAS build profile resolution', () => {
  it.each(['store', 'inheritedStore', 'childStore'])(
    'validates inherited and explicit store distribution: %s', (profile) => {
      expect(run(profile)).toMatchObject({ ok: false, skipped: false });
      expect(run(profile).errors.join('\n')).toContain('EXPO_PUBLIC_MEERKAT_RC_KEY_IOS');
    },
  );

  it.each(['internal', 'inheritedInternal', 'childInternal', 'platformInternal'])(
    'allows internal distributions to omit store services: %s', (profile) => {
      expect(run(profile)).toMatchObject({ ok: true, skipped: true });
    },
  );

  it('applies inherited platform settings after common child settings', () => {
    expect(run('inheritedMixed', 'ios')).toMatchObject({ ok: false, skipped: false });
    expect(run('inheritedMixed', 'android')).toMatchObject({ ok: true, skipped: true });
    const result = run('inheritedMixed', '');
    expect(result.errors.join('\n')).toContain('EXPO_PUBLIC_MEERKAT_RC_KEY_IOS');
    expect(result.errors.join('\n')).not.toContain('EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID');
  });

  it.each(['cycleA', 'broken', 'missing', 'toString', 'level6'])(
    'rejects unresolved or invalid inheritance even when partially internal: %s', (profile) => {
      expect(run(profile)).toMatchObject({ ok: false, skipped: false });
      expect(run(profile).errors.join('\n')).toContain('must resolve to known profiles');
    },
  );

  it('accepts the five-profile inheritance limit used by EAS', () => {
    expect(run('level5')).toMatchObject({ ok: true, skipped: true });
  });
});
