import { describe, expect, it } from 'vitest';
import {
  getBestChefAuthRedirectUrl,
  getBestChefCloudConfig,
  getBestChefLaunchEnv,
  getBestChefProviderBrokerPolicy,
  getBestChefSupabaseProjectRef,
  isBestChefPublicLaunchBuild,
  shouldAllowBestChefByoProviderKeys,
  shouldEnableBestChefMeshSync,
  shouldUseBestChefProviderBroker,
  type BestChefLaunchEnv,
} from '../launch-environment';

const stagingEnv: BestChefLaunchEnv = {
  NODE_ENV: 'development',
  EXPO_PUBLIC_SUPABASE_URL: 'https://tcikvihyjetsfkjjpljv.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
};

describe('BestChef launch environment helpers', () => {
  it('detects public launch builds from explicit flag or production mode', () => {
    expect(isBestChefPublicLaunchBuild({ NODE_ENV: 'development' })).toBe(false);
    expect(isBestChefPublicLaunchBuild({ NODE_ENV: 'production' })).toBe(true);
    expect(isBestChefPublicLaunchBuild({ EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1' })).toBe(true);
  });

  it('disables mesh sync for public launch builds', () => {
    expect(shouldEnableBestChefMeshSync({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldEnableBestChefMeshSync({ NODE_ENV: 'development', EXPO_PUBLIC_BESTCHEF_ENABLE_MESH_SYNC: '0' })).toBe(false);
    expect(shouldEnableBestChefMeshSync({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldEnableBestChefMeshSync({ EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1' })).toBe(false);
  });

  it('infers the staging Supabase project ref and blocks it for public launch', () => {
    expect(getBestChefSupabaseProjectRef(stagingEnv.EXPO_PUBLIC_SUPABASE_URL!)).toBe('tcikvihyjetsfkjjpljv');

    const internalResult = getBestChefCloudConfig(stagingEnv);
    expect(internalResult).toMatchObject({
      ok: true,
      config: { environment: 'staging', projectRef: 'tcikvihyjetsfkjjpljv' },
    });

    expect(getBestChefCloudConfig({ ...stagingEnv, NODE_ENV: 'production' })).toMatchObject({
      ok: false,
      error: 'Public BestChef builds must use a production Supabase project.',
    });
  });

  it('infers the production Supabase project ref for TestFlight public launch builds', () => {
    expect(getBestChefCloudConfig({
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://zjxabnazbdocrqpyixgo.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    })).toMatchObject({
      ok: true,
      config: { environment: 'production', projectRef: 'zjxabnazbdocrqpyixgo' },
    });
  });

  it('builds the default launch environment from direct Expo public env references', () => {
    const restoreEnv = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    const previous = {
      publicLaunch: process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH,
      cloudEnv: process.env.EXPO_PUBLIC_BESTCHEF_CLOUD_ENV,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    };

    process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH = '1';
    process.env.EXPO_PUBLIC_BESTCHEF_CLOUD_ENV = 'production';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://zjxabnazbdocrqpyixgo.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';

    try {
      expect(getBestChefLaunchEnv()).toMatchObject({
        EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
        EXPO_PUBLIC_BESTCHEF_CLOUD_ENV: 'production',
        EXPO_PUBLIC_SUPABASE_URL: 'https://zjxabnazbdocrqpyixgo.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      });
      expect(getBestChefCloudConfig()).toMatchObject({
        ok: true,
        config: { environment: 'production', projectRef: 'zjxabnazbdocrqpyixgo' },
      });
    } finally {
      restoreEnv('EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH', previous.publicLaunch);
      restoreEnv('EXPO_PUBLIC_BESTCHEF_CLOUD_ENV', previous.cloudEnv);
      restoreEnv('EXPO_PUBLIC_SUPABASE_URL', previous.supabaseUrl);
      restoreEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', previous.anonKey);
    }
  });

  it('allows an explicit internal staging override for non-public production builds', () => {
    const result = getBestChefCloudConfig({
      ...stagingEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD: '1',
    });

    expect(result).toMatchObject({ ok: true });
  });

  it('rejects staging override when the public launch flag is explicit', () => {
    const result = getBestChefCloudConfig({
      ...stagingEnv,
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD: '1',
    });

    expect(result).toMatchObject({ ok: false });
  });

  it('forces the provider broker for public launch builds and disallows BYO keys', () => {
    const policy = getBestChefProviderBrokerPolicy({ NODE_ENV: 'production' });
    expect(policy).toEqual({
      isPublicLaunch: true,
      shouldUseBroker: true,
      allowByoProviderKeys: false,
      reason: 'public_launch',
    });

    expect(shouldUseBestChefProviderBroker({ EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1' })).toBe(true);
    expect(shouldAllowBestChefByoProviderKeys({ EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1' })).toBe(false);

    // Public launch ignores BYO override.
    expect(shouldAllowBestChefByoProviderKeys({
      NODE_ENV: 'production',
      EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS: '1',
    })).toBe(false);
  });

  it('allows BYO keys in internal beta by default and honors explicit overrides', () => {
    expect(getBestChefProviderBrokerPolicy({ NODE_ENV: 'development' })).toEqual({
      isPublicLaunch: false,
      shouldUseBroker: false,
      allowByoProviderKeys: true,
      reason: 'internal_beta_default',
    });

    expect(getBestChefProviderBrokerPolicy({
      NODE_ENV: 'development',
      EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS: '0',
    })).toEqual({
      isPublicLaunch: false,
      shouldUseBroker: true,
      allowByoProviderKeys: false,
      reason: 'internal_beta_byo_disabled',
    });

    expect(getBestChefProviderBrokerPolicy({
      NODE_ENV: 'development',
      EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS: '1',
    })).toEqual({
      isPublicLaunch: false,
      shouldUseBroker: false,
      allowByoProviderKeys: true,
      reason: 'explicit_byo',
    });
  });

  it('uses configured auth redirect URLs or falls back to the native callback', () => {
    expect(getBestChefAuthRedirectUrl({
      EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL: 'bestchef://auth-callback',
    })).toBe('bestchef://auth-callback');

    expect(getBestChefAuthRedirectUrl({}, (path) => `bestchef://${path}`)).toBe('bestchef://auth-callback');
    expect(() => getBestChefAuthRedirectUrl({
      EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL: 'ftp://example.com/callback',
    })).toThrow(/redirect URL/);
  });
});
