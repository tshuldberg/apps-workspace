import { describe, expect, it } from 'vitest';
import {
  getMyNewsCloudConfig,
  getMyNewsSubscriptionConfig,
} from '../(root)/data/launch-environment';

const URL = 'https://project.supabase.co';
const ANON = 'anon-key-123';

describe('getMyNewsCloudConfig', () => {
  it('reports not-connected when the vars are absent', () => {
    const res = getMyNewsCloudConfig({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('Not connected to a MyNews server yet.');
  });

  it('reports not-connected when only the URL is present', () => {
    const res = getMyNewsCloudConfig({ EXPO_PUBLIC_MYNEWS_SUPABASE_URL: URL });
    expect(res.ok).toBe(false);
  });

  it('rejects a non-https server URL', () => {
    const res = getMyNewsCloudConfig({
      EXPO_PUBLIC_MYNEWS_SUPABASE_URL: 'http://project.supabase.co',
      EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: ANON,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('HTTPS');
  });

  it('rejects a non-https functions URL when provided', () => {
    const res = getMyNewsCloudConfig({
      EXPO_PUBLIC_MYNEWS_SUPABASE_URL: URL,
      EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: ANON,
      EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: 'http://project.functions.dev',
    });
    expect(res.ok).toBe(false);
  });

  it('strips a trailing slash from the base URL', () => {
    const res = getMyNewsCloudConfig({
      EXPO_PUBLIC_MYNEWS_SUPABASE_URL: `${URL}/`,
      EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: ANON,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.config.baseUrl).toBe(URL);
  });

  it('trims surrounding whitespace on values', () => {
    const res = getMyNewsCloudConfig({
      EXPO_PUBLIC_MYNEWS_SUPABASE_URL: `  ${URL}  `,
      EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: `  ${ANON}  `,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.baseUrl).toBe(URL);
      expect(res.config.anonKey).toBe(ANON);
    }
  });

  it('returns the full config including an optional functions URL', () => {
    const res = getMyNewsCloudConfig({
      EXPO_PUBLIC_MYNEWS_SUPABASE_URL: URL,
      EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: ANON,
      EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: 'https://project.functions.dev/',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config).toEqual({
        baseUrl: URL,
        anonKey: ANON,
        functionsUrl: 'https://project.functions.dev',
      });
    }
  });

  it('omits functionsUrl when not provided', () => {
    const res = getMyNewsCloudConfig({
      EXPO_PUBLIC_MYNEWS_SUPABASE_URL: URL,
      EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: ANON,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.config.functionsUrl).toBeUndefined();
  });
});

describe('getMyNewsSubscriptionConfig', () => {
  it('returns the explicit unavailable state when no store key exists', () => {
    expect(getMyNewsSubscriptionConfig({}, 'ios')).toEqual({
      ok: false,
      reason: 'Subscriptions are not available in this build.',
    });
  });

  it('resolves each platform-specific public key', () => {
    expect(
      getMyNewsSubscriptionConfig(
        { EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: 'appl_live' },
        'ios',
      ),
    ).toEqual({ ok: true, config: { revenueCatApiKey: 'appl_live' } });
    expect(
      getMyNewsSubscriptionConfig(
        { EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID: 'goog_live' },
        'android',
      ),
    ).toEqual({ ok: true, config: { revenueCatApiKey: 'goog_live' } });
  });

  it('rejects a public key for the wrong store', () => {
    const result = getMyNewsSubscriptionConfig(
      { EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: 'goog_wrong' },
      'ios',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Subscriptions are not available in this build.');
  });

  it('treats a prefixed placeholder as unconfigured', () => {
    expect(
      getMyNewsSubscriptionConfig(
        { EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: 'appl_replace-me' },
        'ios',
      ),
    ).toEqual({ ok: false, reason: 'Subscriptions are not available in this build.' });
  });
});
