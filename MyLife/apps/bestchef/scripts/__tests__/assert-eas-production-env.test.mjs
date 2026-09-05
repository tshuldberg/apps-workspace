import { describe, expect, it } from 'vitest';
import { evaluateEasProductionEnv, PRODUCTION_SUPABASE_REF } from '../assert-eas-production-env.mjs';

const PROD_URL = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;
const STAGING_URL = 'https://tcikvihyjetsfkjjpljv.supabase.co';

describe('evaluateEasProductionEnv', () => {
  it('skips non-production profiles', () => {
    for (const profile of [undefined, '', 'development', 'preview']) {
      const result = evaluateEasProductionEnv({ EAS_BUILD_PROFILE: profile });
      expect(result.skipped).toBe(true);
      expect(result.ok).toBe(true);
    }
  });

  it('passes a correctly wired production profile', () => {
    const result = evaluateEasProductionEnv({
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_SUPABASE_URL: PROD_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('fails a production build wired to staging', () => {
    const result = evaluateEasProductionEnv({
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_SUPABASE_URL: STAGING_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(PRODUCTION_SUPABASE_REF);
  });

  it('fails when url or anon key are missing', () => {
    const result = evaluateEasProductionEnv({ EAS_BUILD_PROFILE: 'production' });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('warns (not fails) when the explicit public-launch flag is absent', () => {
    const result = evaluateEasProductionEnv({
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_SUPABASE_URL: PROD_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });
});
