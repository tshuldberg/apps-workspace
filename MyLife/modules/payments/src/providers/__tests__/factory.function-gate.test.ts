import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { createPaymentsProviderBundle } from '../factory';
import type { PaymentsProviderProfile } from '../types';

const SUPABASE_URL = 'https://example.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'service-role';

const LIVE_PROFILES: PaymentsProviderProfile[] = [
  'fake',
  'unit',
  'stripe_treasury',
  'synctera',
];

function makeConfig(profile: PaymentsProviderProfile, environment: 'sandbox' | 'production') {
  return {
    boundary: 'split' as const,
    providerMode: profile,
    environment,
    supabaseUrl: SUPABASE_URL,
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    stripeSecretKey: profile === 'stripe_treasury' ? 'sk_test_123' : null,
    stripeWebhookSecret: profile === 'stripe_treasury' ? 'whsec_123' : null,
    operatorApprovalRequired: environment === 'production',
    featureFlags: {
      wallet: true,
      cards: true,
      remittances: profile !== 'fake',
      disputes: true,
      fakeFunding: profile === 'fake',
    },
  };
}

describe('createPaymentsProviderBundle function quality gate', () => {
  it('matches contract behavior for known runtime modes', () => {
    expect(createPaymentsProviderBundle(makeConfig('fake', 'sandbox')).kind).toBe('fake');
    expect(createPaymentsProviderBundle(makeConfig('unit', 'sandbox')).kind).toBe('sandbox');
    expect(createPaymentsProviderBundle(makeConfig('synctera', 'production')).kind).toBe('live');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createPaymentsProviderBundle fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => {
        const profile = LIVE_PROFILES[randomInt(rng, 0, LIVE_PROFILES.length - 1)];
        const environment = rng() >= 0.5 ? 'sandbox' : 'production';
        return makeConfig(profile, environment);
      },
      assertCase: async (config) => {
        const bundle = createPaymentsProviderBundle(config);
        expect(bundle.profile).toBe(config.providerMode);
        expect(bundle.kind).toBe(
          config.providerMode === 'fake'
            ? 'fake'
            : config.environment === 'sandbox'
              ? 'sandbox'
              : 'live',
        );
        expect(bundle.domesticWallets.providerName).toBe(config.providerMode);
      },
    });
  });

  it('stays within linear complexity slope budget for batched bundle construction', async () => {
    await assertComplexitySlope({
      label: 'createPaymentsProviderBundle',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 5,
      maxRatios: [6.0, 6.0],
      setup: (size) =>
        Array.from({ length: size }, (_, index) =>
          makeConfig(
            LIVE_PROFILES[index % LIVE_PROFILES.length]!,
            index % 2 === 0 ? 'sandbox' : 'production',
          ),
        ),
      run: async (configs) => {
        for (let batch = 0; batch < 10; batch += 1) {
          for (const config of configs) {
            createPaymentsProviderBundle(config);
          }
        }
      },
    });
  });

  it('stays within memory budget under repeated bundle construction', async () => {
    await assertMemoryBudget({
      label: 'createPaymentsProviderBundle',
      repeats: 10,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () =>
        Array.from({ length: 200 }, (_, index) =>
          makeConfig(
            LIVE_PROFILES[index % LIVE_PROFILES.length]!,
            index % 2 === 0 ? 'sandbox' : 'production',
          ),
        ),
      run: async (configs) => {
        for (const config of configs) {
          createPaymentsProviderBundle(config);
        }
      },
    });
  });
});
