import { describe, expect, it } from 'vitest';
import { createPaymentsRuntime, resolvePaymentsRuntimeConfig } from '../index';

describe('payments runtime config', () => {
  it('defaults to a split fake sandbox runtime', () => {
    const config = resolvePaymentsRuntimeConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    });

    expect(config.boundary).toBe('split');
    expect(config.providerMode).toBe('fake');
    expect(config.environment).toBe('sandbox');
    expect(config.featureFlags.fakeFunding).toBe(true);
  });

  it('requires supabase credentials for split and supabase boundaries', () => {
    expect(() => resolvePaymentsRuntimeConfig({})).toThrow(
      /requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('requires stripe secrets in stripe mode', () => {
    expect(() =>
      resolvePaymentsRuntimeConfig({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        MYPAY_PROVIDER_MODE: 'stripe_treasury',
      }),
    ).toThrow(/requires MYPAY_STRIPE_SECRET_KEY and MYPAY_STRIPE_WEBHOOK_SECRET/);
  });

  it('accepts the legacy stripe alias and normalizes it to stripe_treasury', () => {
    const config = resolvePaymentsRuntimeConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      MYPAY_PROVIDER_MODE: 'stripe',
      MYPAY_STRIPE_SECRET_KEY: 'sk_test_123',
      MYPAY_STRIPE_WEBHOOK_SECRET: 'whsec_123',
    });

    expect(config.providerMode).toBe('stripe_treasury');
  });

  it('builds a fake runtime with clear boundary responsibilities', () => {
    const runtime = createPaymentsRuntime({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        MYPAY_RUNTIME_BOUNDARY: 'split',
        MYPAY_PROVIDER_MODE: 'fake',
      },
    });

    expect(runtime.provider.kind).toBe('fake');
    expect(runtime.providers.kind).toBe('fake');
    expect(runtime.responsibilities.nextRoutes).toContain('provider orchestration');
    expect(runtime.responsibilities.supabase).toContain('append-only ledger writes');
    expect(runtime.usesLiveMoneyRails).toBe(false);
  });

  it('builds sandbox adapters for non-fake providers outside production', () => {
    const runtime = createPaymentsRuntime({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        MYPAY_RUNTIME_BOUNDARY: 'split',
        MYPAY_PROVIDER_MODE: 'unit',
      },
    });

    expect(runtime.provider.kind).toBe('unit');
    expect(runtime.providers.kind).toBe('sandbox');
    expect(runtime.providers.profile).toBe('unit');
  });
});
