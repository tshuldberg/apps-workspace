import { describe, expect, it } from 'vitest';
import {
  getMyNewsPaymentsRuntimeConfig,
  getMyNewsRuntimeCapabilities,
  getMyNewsRuntimeLegalContent,
} from '../(root)/data/runtime-capabilities';

const CONFIGURED = {
  EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED: 'true',
  EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER: 'stripe',
  EXPO_PUBLIC_MYNEWS_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: 'sb_publishable_live_1234567890',
  EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1',
};

describe('MyNews runtime capabilities', () => {
  it('keeps payments and legal support claims off by default', () => {
    expect(getMyNewsRuntimeCapabilities({}, 'ios').payments).toBe(false);
    expect(JSON.stringify(getMyNewsRuntimeLegalContent({}))).not.toMatch(/2% platform fee/i);
  });

  it('returns a normalized payment config only when every input is configured', () => {
    expect(getMyNewsPaymentsRuntimeConfig({})).toEqual({
      ok: false,
      reason: 'Journalist support is not available in this build.',
    });
    expect(
      getMyNewsPaymentsRuntimeConfig({
        ...CONFIGURED,
        EXPO_PUBLIC_MYNEWS_SUPABASE_URL: `${CONFIGURED.EXPO_PUBLIC_MYNEWS_SUPABASE_URL}/`,
        EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: `${CONFIGURED.EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL}/`,
      }),
    ).toEqual({
      ok: true,
      config: {
        baseUrl: CONFIGURED.EXPO_PUBLIC_MYNEWS_SUPABASE_URL,
        anonKey: CONFIGURED.EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY,
        functionsUrl: CONFIGURED.EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL,
      },
    });
  });

  it('enables controlled legal contacts without publishing placeholder addresses', () => {
    const env = {
      ...CONFIGURED,
      EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL: 'legal@controlled.news',
      EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL: 'safety@controlled.news',
      EXPO_PUBLIC_MYNEWS_DMCA_EMAIL: 'copyright@controlled.news',
    };
    expect(getMyNewsRuntimeCapabilities(env, 'ios').emailContact).toBe(true);
    const copy = JSON.stringify(getMyNewsRuntimeLegalContent(env));
    expect(copy).toContain('legal@controlled.news');
    expect(copy).not.toContain('@mynews.app');
  });
});

