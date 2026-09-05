import { describe, expect, it } from 'vitest';
import { checkBuildEnv } from '../check-build-env.mjs';

describe('checkBuildEnv', () => {
  it('skips non-production profiles', () => {
    expect(checkBuildEnv({ EAS_BUILD_PROFILE: 'development' })).toMatchObject({
      ok: true,
      skipped: true,
    });
    expect(checkBuildEnv({})).toMatchObject({ ok: true, skipped: true });
  });

  it('fails a production build with no RevenueCat key', () => {
    const result = checkBuildEnv({
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'ios',
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS');
  });

  it('passes a production build with a matching platform key', () => {
    expect(checkBuildEnv({
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'android',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_ANDROID: 'goog_live',
    })).toMatchObject({ ok: true, skipped: false });
  });

  it('fails when the key prefix does not match the platform', () => {
    const result = checkBuildEnv({
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'ios',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: 'goog_wrong',
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('expected appl_*');
  });

  it('fails when secrets or test mode leak into production', () => {
    const secret = checkBuildEnv({
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'ios',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: 'sk_oops',
    });
    expect(secret.ok).toBe(false);

    const testMode = checkBuildEnv({
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'ios',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS: 'appl_live',
      EXPO_PUBLIC_MANHATTAN_ENTITLEMENTS_TEST_MODE: 'true',
    });
    expect(testMode.ok).toBe(false);
    expect(testMode.errors[0]).toContain('TEST_MODE');
  });

  it('warns on half-configured Supabase env without failing', () => {
    const result = checkBuildEnv({
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'ios',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS: 'appl_live',
      EXPO_PUBLIC_MANHATTAN_SUPABASE_URL: 'https://x.supabase.co',
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });
});
