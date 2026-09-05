import { describe, expect, it } from 'vitest';
import { checkBuildEnv } from '../check-build-env.mjs';

const GOOD_PROD_IOS = {
  EAS_BUILD_PROFILE: 'production',
  EAS_BUILD_PLATFORM: 'ios',
  EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'appl_abc123',
  EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'https://prod.supabase.co',
  EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY: 'anon-key',
  EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'dowork://auth-callback',
};

describe('checkBuildEnv', () => {
  it('skips non-production profiles', () => {
    const result = checkBuildEnv({ EAS_BUILD_PROFILE: 'development' });
    expect(result.skipped).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('passes a fully configured ios production build', () => {
    const result = checkBuildEnv(GOOD_PROD_IOS);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes a fully configured android production build', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EAS_BUILD_PLATFORM: 'android',
      EXPO_PUBLIC_DOWORK_RC_KEY_IOS: undefined,
      EXPO_PUBLIC_DOWORK_RC_KEY_ANDROID: 'goog_abc123',
    });
    expect(result.ok).toBe(true);
  });

  it('fails a production build with no RevenueCat key (dead paywall)', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_RC_KEY_IOS: undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/dead paywall/);
  });

  it('fails when the key is not a public SDK key', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'sk_secret',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/public SDK key/);
  });

  it('fails on a platform prefix mismatch', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'goog_abc123',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/prefix does not match/);
  });

  it('fails without the Supabase env (dead trainer platform)', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_SUPABASE_URL: undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/trainer platform is dead/);
  });

  it('fails on a non-https Supabase URL', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'http://prod.supabase.co',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/https/);
  });

  it('fails when the staging-cloud override leaks into production', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD: '1',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/never reach a production build/);
  });

  it('warns (not fails) on a missing auth redirect URL', () => {
    const result = checkBuildEnv({
      ...GOOD_PROD_IOS,
      EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/auth deep links/i);
  });
});
