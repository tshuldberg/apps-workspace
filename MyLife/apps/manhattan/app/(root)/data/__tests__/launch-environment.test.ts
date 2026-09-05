import { describe, expect, it } from 'vitest';
import {
  getManhattanBillingConfig,
  shouldEnableManhattanEntitlementsTestMode,
} from '../launch-environment';

describe('Manhattan billing launch environment', () => {
  it('returns unconfigured when no RevenueCat key is present', () => {
    expect(getManhattanBillingConfig({})).toEqual({ ok: false, error: null });
  });

  it('accepts Manhattan-specific RevenueCat app store keys first', () => {
    const result = getManhattanBillingConfig({
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: '  appl_manhattan ',
      EXPO_PUBLIC_REVENUECAT_API_KEY: 'goog_shared',
    });

    expect(result).toEqual({
      ok: true,
      config: { revenueCatApiKey: 'appl_manhattan' },
    });
  });

  it('accepts shared Google Play RevenueCat keys', () => {
    const result = getManhattanBillingConfig({
      EXPO_PUBLIC_REVENUECAT_API_KEY: 'goog_shared',
    });

    expect(result).toEqual({
      ok: true,
      config: { revenueCatApiKey: 'goog_shared' },
    });
  });

  it('rejects malformed public SDK keys', () => {
    const result = getManhattanBillingConfig({
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: 'sk_secret',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Manhattan RevenueCat public SDK key must start with appl_ or goog_.',
    });
  });

  it('prefers the platform-specific key for the build platform', () => {
    const env = {
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS: 'appl_specific',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_ANDROID: 'goog_specific',
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: 'appl_generic',
    };

    expect(getManhattanBillingConfig(env, 'ios')).toEqual({
      ok: true,
      config: { revenueCatApiKey: 'appl_specific' },
    });
    expect(getManhattanBillingConfig(env, 'android')).toEqual({
      ok: true,
      config: { revenueCatApiKey: 'goog_specific' },
    });
  });

  it('falls back to generic keys when no platform-specific key exists', () => {
    expect(getManhattanBillingConfig({
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: 'goog_generic',
    }, 'android')).toEqual({
      ok: true,
      config: { revenueCatApiKey: 'goog_generic' },
    });
  });

  it('rejects a key whose store prefix does not match the build platform', () => {
    expect(getManhattanBillingConfig({
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY: 'goog_wrongstore',
    }, 'ios')).toEqual({
      ok: false,
      error: 'Manhattan RevenueCat key goog_* does not match the ios build; expected an appl_ key.',
    });
    expect(getManhattanBillingConfig({
      EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_ANDROID: 'appl_wrongstore',
    }, 'android')).toEqual({
      ok: false,
      error: 'Manhattan RevenueCat key appl_* does not match the android build; expected a goog_ key.',
    });
  });

  it('keeps legacy platformless behavior for callers that omit platform', () => {
    expect(getManhattanBillingConfig({
      EXPO_PUBLIC_REVENUECAT_API_KEY: 'goog_shared',
    })).toEqual({
      ok: true,
      config: { revenueCatApiKey: 'goog_shared' },
    });
  });

  it('only enables entitlement test mode in dev with explicit opt-in', () => {
    expect(shouldEnableManhattanEntitlementsTestMode({}, true)).toBe(false);
    expect(shouldEnableManhattanEntitlementsTestMode({
      EXPO_PUBLIC_MANHATTAN_ENTITLEMENTS_TEST_MODE: 'true',
    }, false)).toBe(false);
    expect(shouldEnableManhattanEntitlementsTestMode({
      EXPO_PUBLIC_MANHATTAN_ENTITLEMENTS_TEST_MODE: 'true',
    }, true)).toBe(true);
  });
});
