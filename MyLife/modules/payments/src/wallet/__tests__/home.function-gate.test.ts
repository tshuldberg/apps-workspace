import { describe, expect, it } from 'vitest';

import {
  buildPaymentsProfile,
} from '../../compliance/profile';
import type {
  PaymentsWalletSnapshot,
} from '../../engine/types';
import type {
  PaymentActivityItem,
} from '../../types';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildPaymentsWalletHomeViewModel,
} from '../home';
import type {
  PaymentsWalletHomeSnapshot,
  PaymentsWalletLinkedAccount,
} from '../home';

const PROFILE = buildPaymentsProfile({
  ownerUserId: 'user_fn_gate',
  primaryWalletId: 'wallet_fn_gate',
  handle: '@functiongate',
  displayName: 'Function Gate',
  identityStatus: 'verified',
  verificationState: 'verified',
  approvedTier: 'basic',
  fields: {
    legalName: 'Function Gate',
    email: 'functiongate@example.com',
    phoneE164: '+15555550123',
    dateOfBirth: '1990-01-01',
    addressLine1: '1 Main St',
    city: 'Austin',
    regionCode: 'TX',
    postalCode: '78701',
    governmentIdLast4: '1234',
  },
});

function makeWallet(
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId: 'wallet_fn_gate',
    ownerUserId: 'user_fn_gate',
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: 10_000,
      pending: 0,
      reserved: 0,
      escrow: 0,
    },
    complianceHold: 'none',
    sendLimitRemainingCents: 50_000,
    receiveLimitRemainingCents: 75_000,
    ...overrides,
  };
}

function makeLinkedAccounts(size: number): PaymentsWalletLinkedAccount[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `linked_${index}`,
    label: `Checking ${index}`,
    institutionName: 'Thread Bank',
    kind: 'bank',
    verificationState: index === 0 ? 'verified' : 'review',
    last4: `${1000 + index}`.slice(-4),
    primary: index === 0,
  }));
}

function makeActivity(size: number): PaymentActivityItem[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `activity_${index}`,
    title: index % 2 === 0 ? 'Payment received' : 'Add money',
    amountCents: 1_000 + index,
    currency: 'USD',
    direction: index % 2 === 0 ? 'incoming' : 'outgoing',
    status: index % 3 === 0 ? 'pending' : 'posted',
    rail: index % 2 === 0 ? 'wallet' : 'bank',
    occurredAt: '2026-04-24T12:00:00.000Z',
  }));
}

function makeSnapshot(input: {
  linkedAccountCount?: number;
  activityCount?: number;
  availableCents?: number;
  pendingCents?: number;
  held?: boolean;
  degraded?: boolean;
} = {}): PaymentsWalletHomeSnapshot {
  return {
    profile: PROFILE,
    wallet: makeWallet({
      status: input.held ? 'restricted' : 'active',
      complianceHold: input.held ? 'freeze' : 'none',
      balances: {
        available: input.availableCents ?? 10_000,
        pending: input.pendingCents ?? 0,
        reserved: 0,
        escrow: 0,
      },
    }),
    linkedAccounts: makeLinkedAccounts(input.linkedAccountCount ?? 1),
    recentActivity: makeActivity(input.activityCount ?? 2),
    serverRefreshedAt: '2026-04-24T12:00:00.000Z',
    systemMode: input.degraded ? 'degraded' : 'operational',
    realtime: {
      connected: true,
      lastEventAt: '2026-04-24T12:00:00.000Z',
    },
  };
}

describe('buildPaymentsWalletHomeViewModel function quality gate', () => {
  it('matches contract behavior for send readiness and pending balance', () => {
    const ready = buildPaymentsWalletHomeViewModel(makeSnapshot());
    const pendingOnly = buildPaymentsWalletHomeViewModel(
      makeSnapshot({
        availableCents: 0,
        pendingCents: 2_500,
      }),
    );

    expect(ready.balanceHero.canSend).toBe(true);
    expect(ready.quickActions.find((action) => action.id === 'send')?.enabled).toBe(true);
    expect(pendingOnly.balanceHero.state).toBe('pending');
    expect(pendingOnly.balanceHero.canSend).toBe(false);
    expect(pendingOnly.balanceHero.disclosure.id).toContain('custodial_account');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsWalletHomeViewModel fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => makeSnapshot({
        linkedAccountCount: randomInt(rng, 0, 12),
        activityCount: randomInt(rng, 0, 12),
        availableCents: randomInt(rng, 0, 100_000),
        pendingCents: randomInt(rng, 0, 25_000),
        held: rng() > 0.86,
        degraded: rng() > 0.9,
      }),
      assertCase: async (input) => {
        const result = buildPaymentsWalletHomeViewModel(input);
        const sendAction = result.quickActions.find((action) => action.id === 'send');

        expect(result.quickActions).toHaveLength(4);
        expect(result.recentActivity.length).toBeLessThanOrEqual(4);
        expect(result.balanceHero.legalCopyBlocks.length).toBeGreaterThan(0);
        expect(sendAction?.enabled).toBe(result.balanceHero.canSend);
        expect(result.realtimePath.lastRefreshedAt).toBe(input.serverRefreshedAt);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsWalletHomeViewModel',
      sizes: [100, 200, 400],
      expected: 'linear',
      sampleRuns: 4,
      maxRatios: [4.0, 4.0],
      setup: (size) => makeSnapshot({
        linkedAccountCount: size,
        activityCount: size,
      }),
      run: async (input) => {
        for (let index = 0; index < 10; index += 1) {
          buildPaymentsWalletHomeViewModel(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsWalletHomeViewModel',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeSnapshot({
        linkedAccountCount: 200,
        activityCount: 200,
      }),
      run: async (input) => {
        buildPaymentsWalletHomeViewModel(input);
      },
    });
  });
});
