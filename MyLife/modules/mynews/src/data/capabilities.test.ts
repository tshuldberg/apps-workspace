import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MYNEWS_CAPABILITIES,
  detectMyNewsCapabilities,
} from './capabilities';

const CLOUD = {
  supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
  supabaseAnonKey: 'sb_publishable_live_1234567890',
  functionsUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1',
};

describe('detectMyNewsCapabilities', () => {
  it('fails closed when the build is unconfigured', () => {
    expect(detectMyNewsCapabilities({})).toEqual(DEFAULT_MYNEWS_CAPABILITIES);
  });

  it('requires the explicit Stripe switch and complete cloud config for payments', () => {
    expect(detectMyNewsCapabilities({ ...CLOUD, paymentsEnabled: true }).payments).toBe(false);
    expect(
      detectMyNewsCapabilities({
        ...CLOUD,
        paymentsEnabled: 'true',
        paymentProvider: 'stripe',
      }).payments,
    ).toBe(true);
  });

  it('rejects an incomplete or insecure payments environment', () => {
    const base = { ...CLOUD, paymentsEnabled: true, paymentProvider: 'stripe' };
    expect(detectMyNewsCapabilities({ ...base, functionsUrl: undefined }).payments).toBe(false);
    expect(detectMyNewsCapabilities({ ...base, supabaseUrl: 'http://local' }).payments).toBe(false);
    expect(detectMyNewsCapabilities({ ...base, supabaseAnonKey: 'replace-me' }).payments).toBe(false);
  });

  it('checks RevenueCat prefixes against the store platform', () => {
    expect(
      detectMyNewsCapabilities({ revenueCatApiKey: 'appl_live', subscriptionPlatform: 'ios' })
        .subscriptions,
    ).toBe(true);
    expect(
      detectMyNewsCapabilities({ revenueCatApiKey: 'goog_live', subscriptionPlatform: 'ios' })
        .subscriptions,
    ).toBe(false);
    expect(
      detectMyNewsCapabilities({ revenueCatApiKey: 'goog_live', subscriptionPlatform: 'android' })
        .subscriptions,
    ).toBe(true);
    expect(
      detectMyNewsCapabilities({ revenueCatApiKey: 'appl_replace-me', subscriptionPlatform: 'ios' })
        .subscriptions,
    ).toBe(false);
  });

  it('requires every published contact address to be controlled', () => {
    expect(
      detectMyNewsCapabilities({ contactEmails: ['legal@controlled.news', 'safety@controlled.news'] })
        .emailContact,
    ).toBe(true);
    expect(
      detectMyNewsCapabilities({ contactEmails: ['legal@controlled.news', 'safety@mynews.app'] })
        .emailContact,
    ).toBe(false);
  });

  it('requires an explicit switch and cloud function boundary for web reporting', () => {
    expect(detectMyNewsCapabilities({ ...CLOUD, webReportingEnabled: false }).webReporting).toBe(false);
    expect(detectMyNewsCapabilities({ ...CLOUD, webReportingEnabled: 'true' }).webReporting).toBe(true);
  });
});
