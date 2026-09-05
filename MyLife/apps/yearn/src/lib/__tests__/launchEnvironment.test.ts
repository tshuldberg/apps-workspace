import { describe, expect, it } from 'vitest';
import {
  canShowYearnDevSurfaces,
  getYearnAuthRedirectUrl,
  getYearnCloudConfig,
  getYearnSupabaseProjectRef,
  isYearnPublicBetaBuild,
} from '../launchEnvironment';

describe('Yearn launch environment', () => {
  it('treats explicit public beta builds as public', () => {
    expect(isYearnPublicBetaBuild({ EXPO_PUBLIC_YEARN_PUBLIC_BETA: '1' })).toBe(true);
    expect(isYearnPublicBetaBuild({ NODE_ENV: 'production' })).toBe(true);
    expect(isYearnPublicBetaBuild({ NODE_ENV: 'development' })).toBe(false);
  });

  it('hides development surfaces in public beta and production builds', () => {
    expect(canShowYearnDevSurfaces({ NODE_ENV: 'development' })).toBe(true);
    expect(canShowYearnDevSurfaces({ EXPO_PUBLIC_YEARN_PUBLIC_BETA: '1' })).toBe(false);
    expect(canShowYearnDevSurfaces({ NODE_ENV: 'production' })).toBe(false);
  });

  it('extracts Supabase project refs from standard project URLs', () => {
    expect(getYearnSupabaseProjectRef('https://kclsicgiutrtymjtuizq.supabase.co')).toBe(
      'kclsicgiutrtymjtuizq',
    );
    expect(getYearnSupabaseProjectRef('https://example.com')).toBeNull();
    expect(getYearnSupabaseProjectRef('not a url')).toBeNull();
  });

  it('returns no cloud config when secrets are absent', () => {
    expect(getYearnCloudConfig({})).toEqual({ ok: false, error: null });
  });

  it('requires HTTPS Supabase URLs', () => {
    expect(
      getYearnCloudConfig({
        EXPO_PUBLIC_YEARN_SUPABASE_URL: 'http://kclsicgiutrtymjtuizq.supabase.co',
        EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({ ok: false, error: 'Yearn Supabase URL must use HTTPS.' });
  });

  it('rejects non-production projects for public beta builds', () => {
    expect(
      getYearnCloudConfig({
        EXPO_PUBLIC_YEARN_PUBLIC_BETA: '1',
        EXPO_PUBLIC_YEARN_CLOUD_ENV: 'staging',
        EXPO_PUBLIC_YEARN_SUPABASE_URL: 'https://stagingref.supabase.co',
        EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({
      ok: false,
      error: 'Public Yearn beta builds must use the production Supabase project.',
    });
  });

  it('accepts the production project for public beta builds', () => {
    expect(
      getYearnCloudConfig({
        EXPO_PUBLIC_YEARN_PUBLIC_BETA: '1',
        EXPO_PUBLIC_YEARN_SUPABASE_URL: 'https://kclsicgiutrtymjtuizq.supabase.co',
        EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({
      ok: true,
      config: {
        url: 'https://kclsicgiutrtymjtuizq.supabase.co',
        anonKey: 'anon',
        environment: 'production',
        projectRef: 'kclsicgiutrtymjtuizq',
      },
    });
  });

  it('uses an explicit safe auth redirect or falls back to Expo linking', () => {
    expect(
      getYearnAuthRedirectUrl(
        { EXPO_PUBLIC_YEARN_AUTH_REDIRECT_URL: 'yearn://auth-callback' },
        () => 'yearn://fallback',
      ),
    ).toBe('yearn://auth-callback');
    expect(
      getYearnAuthRedirectUrl(
        { EXPO_PUBLIC_YEARN_AUTH_REDIRECT_URL: 'javascript:alert(1)' },
        () => 'yearn://fallback',
      ),
    ).toBe('yearn://fallback');
  });
});
