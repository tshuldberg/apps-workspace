// DoWork app smoke test.
//
// This is the lightweight contract: the app's package metadata, brand
// tokens, and database wiring should resolve without runtime errors.
// Full route + provider rendering requires a React Native renderer
// harness which is out of scope for v1; the parity script covers file
// presence, this test covers static contract.

import { describe, expect, it } from 'vitest';
import {
  DW_ACCENT,
  DW_ACCENT_DARK,
  DW_ACCENT_LIGHT,
  DW_BORDER,
  DW_GLASS,
  DW_ON_ACCENT,
  DW_SURFACES,
  DW_TEXT,
} from '../(root)/theme/tokens';
import {
  isDoWorkPublicLaunchBuild,
  getDoWorkCloudConfig,
  getDoWorkAuthRedirectUrl,
} from '../(root)/data/launch-environment';

describe('DoWork brand tokens', () => {
  it('exposes the iron orange accent', () => {
    expect(DW_ACCENT).toBe('#FF6B00');
    expect(DW_ACCENT_LIGHT).toMatch(/^#/);
    expect(DW_ACCENT_DARK).toMatch(/^#/);
    expect(DW_ON_ACCENT).toBe('#0B0B0E');
  });

  it('exposes 6 surface tiers', () => {
    expect(Object.keys(DW_SURFACES)).toEqual([
      'lowest',
      'base',
      'low',
      'mid',
      'high',
      'highest',
    ]);
    expect(DW_SURFACES.base).toBe('#0B0B0E');
  });

  it('exposes a glass token with blur metadata', () => {
    expect(DW_GLASS.blur).toBeGreaterThan(0);
    expect(DW_GLASS.backgroundColor).toMatch(/rgba/);
  });

  it('exposes text + border tokens', () => {
    expect(DW_TEXT.primary).toMatch(/^#/);
    expect(DW_BORDER.subtle).toMatch(/rgba/);
  });
});

describe('DoWork launch-environment policy', () => {
  it('treats explicit public-launch flag as public', () => {
    expect(isDoWorkPublicLaunchBuild({ EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1' })).toBe(true);
  });

  it('treats NODE_ENV=production as public', () => {
    expect(isDoWorkPublicLaunchBuild({ NODE_ENV: 'production' })).toBe(true);
  });

  it('returns ok=false with a silent (null) error when env is empty', () => {
    const result = getDoWorkCloudConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Missing config is an expected build state, not an error; screens
      // render their own "not configured" copy from the null.
      expect(result.error).toBeNull();
    }
  });

  it('rejects non-https Supabase URLs', () => {
    const result = getDoWorkCloudConfig({
      EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'http://example.supabase.co',
      EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY: 'fake',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('HTTPS');
    }
  });

  it('blocks public launch with a non-prod project ref', () => {
    const result = getDoWorkCloudConfig({
      NODE_ENV: 'production',
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_DOWORK_SUPABASE_URL: 'https://stagingref.supabase.co',
      EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY: 'fake',
      EXPO_PUBLIC_DOWORK_CLOUD_ENV: 'staging',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('production');
    }
  });

  it('falls back to provided callback when redirect env is unset', () => {
    const url = getDoWorkAuthRedirectUrl({}, (path) => `dowork://${path.replace(/^\//, '')}`);
    expect(url).toBe('dowork://auth-callback');
  });

  it('honours an explicit allowed redirect URL', () => {
    const url = getDoWorkAuthRedirectUrl(
      { EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'dowork://auth-callback' },
      () => 'fallback',
    );
    expect(url).toBe('dowork://auth-callback');
  });

  it('rejects malicious redirect protocols', () => {
    const url = getDoWorkAuthRedirectUrl(
      { EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL: 'javascript:alert(1)' },
      (path) => `dowork://${path.replace(/^\//, '')}`,
    );
    expect(url).toBe('dowork://auth-callback');
  });
});
