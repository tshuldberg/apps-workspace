// DoWork launch-environment policy contract tests.

import { describe, expect, it } from 'vitest';
import {
  getDoWorkAuthRedirectUrl,
  getDoWorkCloudConfig,
  getDoWorkSupabaseProjectRef,
  isDoWorkPublicLaunchBuild,
  type DoWorkLaunchEnv,
} from '../launch-environment';

describe('isDoWorkPublicLaunchBuild', () => {
  it('is true when the explicit public-launch flag is set', () => {
    expect(isDoWorkPublicLaunchBuild({ EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1' })).toBe(true);
  });

  it('is true for a production NODE_ENV', () => {
    expect(isDoWorkPublicLaunchBuild({ NODE_ENV: 'production' })).toBe(true);
  });

  it('is false for a plain internal/dev build', () => {
    expect(isDoWorkPublicLaunchBuild({ NODE_ENV: 'development' })).toBe(false);
    expect(isDoWorkPublicLaunchBuild({})).toBe(false);
  });
});

describe('getDoWorkSupabaseProjectRef', () => {
  it('extracts the project ref from a supabase.co URL', () => {
    expect(getDoWorkSupabaseProjectRef('https://abcdefgh.supabase.co')).toBe('abcdefgh');
  });

  it('returns null for a non-supabase host', () => {
    expect(getDoWorkSupabaseProjectRef('https://example.com')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(getDoWorkSupabaseProjectRef('not a url')).toBeNull();
  });
});

describe('getDoWorkCloudConfig', () => {
  const BASE: DoWorkLaunchEnv = {
    EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'https://abcdefgh.supabase.co',
    EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY: 'anon-key',
  };

  it('fails silently (no error) when url or anon key is missing', () => {
    expect(getDoWorkCloudConfig({})).toEqual({ ok: false, error: null });
    expect(
      getDoWorkCloudConfig({ EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'https://x.supabase.co' }),
    ).toEqual({ ok: false, error: null });
  });

  it('rejects a non-HTTPS URL', () => {
    const result = getDoWorkCloudConfig({
      ...BASE,
      EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'http://abcdefgh.supabase.co',
    });
    expect(result).toEqual({ ok: false, error: 'DoWork Supabase URL must use HTTPS.' });
  });

  it('rejects an invalid URL', () => {
    const result = getDoWorkCloudConfig({ ...BASE, EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'not a url' });
    expect(result).toEqual({ ok: false, error: 'DoWork Supabase URL is invalid.' });
  });

  it('resolves a valid internal-build config with unknown environment', () => {
    const result = getDoWorkCloudConfig(BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.url).toBe(BASE.EXPO_PUBLIC_DOWORK_SUPABASE_URL);
      expect(result.config.projectRef).toBe('abcdefgh');
      expect(result.config.environment).toBe('unknown');
    }
  });

  it('honors an explicit cloud environment flag', () => {
    const result = getDoWorkCloudConfig({ ...BASE, EXPO_PUBLIC_DOWORK_CLOUD_ENV: 'production' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.environment).toBe('production');
  });

  it('blocks a public-launch build on a non-production project without an override', () => {
    const result = getDoWorkCloudConfig({
      ...BASE,
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
    });
    expect(result).toEqual({
      ok: false,
      error: 'Public DoWork builds must use a production Supabase project.',
    });
  });

  it('allows a public-launch build when the project is explicitly production', () => {
    const result = getDoWorkCloudConfig({
      ...BASE,
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_DOWORK_CLOUD_ENV: 'production',
    });
    expect(result.ok).toBe(true);
  });

  it('does not allow the internal-build override once EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH is explicit', () => {
    const result = getDoWorkCloudConfig({
      ...BASE,
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD: '1',
    });
    expect(result.ok).toBe(false);
  });

  it('allows a NODE_ENV=production build to use a non-production project via the internal override', () => {
    const result = getDoWorkCloudConfig({
      ...BASE,
      NODE_ENV: 'production',
      EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD: '1',
    });
    expect(result.ok).toBe(true);
  });
});

describe('getDoWorkAuthRedirectUrl', () => {
  const fallback = (path: string) => `dowork://fallback${path}`;

  it('uses an explicit allowed redirect URL', () => {
    const url = getDoWorkAuthRedirectUrl(
      { EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'dowork://auth-callback' },
      fallback,
    );
    expect(url).toBe('dowork://auth-callback');
  });

  it('accepts https, exp, and exps schemes', () => {
    expect(
      getDoWorkAuthRedirectUrl({ EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'https://example.com/cb' }, fallback),
    ).toBe('https://example.com/cb');
    expect(
      getDoWorkAuthRedirectUrl({ EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'exp://127.0.0.1:19000' }, fallback),
    ).toBe('exp://127.0.0.1:19000');
  });

  it('falls back to the default path for a disallowed scheme', () => {
    const url = getDoWorkAuthRedirectUrl(
      { EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'javascript://evil' },
      fallback,
    );
    expect(url).toBe('dowork://fallback/auth-callback');
  });

  it('falls back when no explicit redirect is set', () => {
    const url = getDoWorkAuthRedirectUrl({}, fallback);
    expect(url).toBe('dowork://fallback/auth-callback');
  });
});
