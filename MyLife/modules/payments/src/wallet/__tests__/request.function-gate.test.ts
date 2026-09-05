import { describe, expect, it } from 'vitest';

import {
  buildPaymentsProfile,
} from '../../compliance/profile';
import type {
  PaymentsWalletSnapshot,
} from '../../engine/types';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildPaymentsRequestFlowViewModel,
} from '../request';
import type {
  PaymentsRequestAntiAbuseConstraints,
  PaymentsRequestFlowSnapshot,
  PaymentsRequestTargetCandidate,
} from '../request';

const PROFILE = buildPaymentsProfile({
  ownerUserId: 'user_request_fn_gate',
  primaryWalletId: 'wallet_request_fn_gate',
  handle: '@requestgate',
  displayName: 'Request Gate',
  identityStatus: 'verified',
  verificationState: 'verified',
  approvedTier: 'basic',
  fields: {
    legalName: 'Request Gate',
    email: 'requestgate@example.com',
    phoneE164: '+15555550123',
  },
});

const ANTI_ABUSE: PaymentsRequestAntiAbuseConstraints = {
  maxUses: 1,
  maxAmountCents: 75_000,
  expiresWithinHours: 72,
  reminderCooldownHours: 24,
  maxReminders: 2,
  rateLimitKey: 'requestgate:user_request_fn_gate',
};

function makeWallet(
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId: 'wallet_request_fn_gate',
    ownerUserId: 'user_request_fn_gate',
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: 10_000,
      pending: 0,
      reserved: 0,
      escrow: 0,
      ...(overrides.balances ?? {}),
    },
    complianceHold: 'none',
    sendLimitRemainingCents: 50_000,
    receiveLimitRemainingCents: 75_000,
    ...overrides,
  };
}

function makeTargets(size: number): PaymentsRequestTargetCandidate[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `target_${index}`,
    walletId: `wallet_target_${index}`,
    ownerUserId: `user_target_${index}`,
    displayName: `Target ${index}`,
    handle: `@target${index}`,
    email: `target${index}@example.com`,
    phone: `+1555555${String(1000 + index).slice(-4)}`,
    source:
      index % 3 === 0
        ? 'previous_counterparty'
        : index % 3 === 1
          ? 'contact'
          : 'known_user',
    verificationState: index % 5 === 0 ? 'review' : 'verified',
  }));
}

function makeSnapshot(input: {
  targetCount?: number;
  selectedTargetIndex?: number;
  amountCents?: number;
  receiveLimitRemainingCents?: number;
  mode?: 'known_user' | 'payment_link';
  degraded?: boolean;
  held?: boolean;
  missingExpiry?: boolean;
  invalidLinkPolicy?: boolean;
} = {}): PaymentsRequestFlowSnapshot {
  const targetCount = input.targetCount ?? 4;
  const targets = makeTargets(targetCount);
  const selectedIndex = Math.min(
    input.selectedTargetIndex ?? 0,
    Math.max(targets.length - 1, 0),
  );
  const selected = targets[selectedIndex] ?? null;
  const mode = input.mode ?? 'known_user';

  return {
    requesterProfile: PROFILE,
    wallet: makeWallet({
      complianceHold: input.held ? 'freeze' : 'none',
      receiveLimitRemainingCents: input.receiveLimitRemainingCents ?? 75_000,
    }),
    targets,
    serverNow: '2026-04-24T16:00:00.000Z',
    systemMode: input.degraded ? 'degraded' : 'operational',
    antiAbuse: input.invalidLinkPolicy
      ? {
          ...ANTI_ABUSE,
          maxUses: 3,
        }
      : ANTI_ABUSE,
    draft: {
      mode,
      targetQuery: mode === 'known_user' ? selected?.handle ?? '' : '',
      selectedTargetId: mode === 'known_user' ? selected?.id ?? null : null,
      amountText: String((input.amountCents ?? 1_250) / 100),
      note: 'Function gate request',
      expiresAt: input.missingExpiry ? null : '2026-04-25T16:00:00.000Z',
      clientSubmissionId: 'function-gate-request',
    },
  };
}

describe('buildPaymentsRequestFlowViewModel function quality gate', () => {
  it('matches contract behavior for direct, link, and blocked states', () => {
    const direct = buildPaymentsRequestFlowViewModel(makeSnapshot());
    const link = buildPaymentsRequestFlowViewModel(makeSnapshot({
      mode: 'payment_link',
    }));
    const blocked = buildPaymentsRequestFlowViewModel(makeSnapshot({
      receiveLimitRemainingCents: 100,
    }));

    expect(direct.state).toBe('ready_to_create');
    expect(direct.canCreate).toBe(true);
    expect(direct.commandPreview?.command.payerWalletId).toBe('wallet_target_0');
    expect(link.state).toBe('ready_to_create');
    expect(link.commandPreview?.command.payerWalletId).toBeNull();
    expect(link.preview.guardrailDisclosure.body).toContain('Single-use link');
    expect(blocked.blockReason?.code).toBe('limit_blocked');
    expect(blocked.canCreate).toBe(false);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsRequestFlowViewModel fuzz',
      iterations: 80,
      seed: 43,
      makeCase: (rng) => makeSnapshot({
        targetCount: randomInt(rng, 1, 24),
        selectedTargetIndex: randomInt(rng, 0, 20),
        amountCents: randomInt(rng, 1, 100_000),
        receiveLimitRemainingCents: randomInt(rng, 0, 120_000),
        mode: rng() > 0.68 ? 'payment_link' : 'known_user',
        degraded: rng() > 0.94,
        held: rng() > 0.92,
        missingExpiry: rng() > 0.96,
        invalidLinkPolicy: rng() > 0.96,
      }),
      assertCase: async (input) => {
        const result = buildPaymentsRequestFlowViewModel(input);

        expect(result.targetSearch.results.length).toBeLessThanOrEqual(6);
        expect(result.legalCopyBlocks.length).toBeGreaterThan(0);
        expect(result.preview.lines.length).toBeGreaterThanOrEqual(4);
        if (result.canCreate) {
          expect(result.commandPreview).not.toBeNull();
          expect(result.blockReason).toBeNull();
        }
        if (result.blockReason) {
          expect(result.canCreate).toBe(false);
          expect(result.policyNotice?.blocking).toBe(true);
        }
        if (input.draft.mode === 'payment_link' && result.canCreate) {
          expect(result.commandPreview?.command.payerWalletId).toBeNull();
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsRequestFlowViewModel',
      sizes: [100, 200, 400],
      expected: 'linear',
      sampleRuns: 4,
      maxRatios: [5.0, 5.0],
      setup: (size) => makeSnapshot({
        targetCount: size,
        selectedTargetIndex: Math.floor(size / 2),
      }),
      run: async (input) => {
        for (let index = 0; index < 10; index += 1) {
          buildPaymentsRequestFlowViewModel(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsRequestFlowViewModel',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeSnapshot({
        targetCount: 240,
        selectedTargetIndex: 100,
      }),
      run: async (input) => {
        buildPaymentsRequestFlowViewModel(input);
      },
    });
  });
});
