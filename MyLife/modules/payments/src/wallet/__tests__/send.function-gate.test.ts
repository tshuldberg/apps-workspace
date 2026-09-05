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
  buildPaymentsSendFlowViewModel,
} from '../send';
import type {
  PaymentsSendFlowSnapshot,
  PaymentsSendRecipientCandidate,
} from '../send';

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
      ...(overrides.balances ?? {}),
    },
    complianceHold: 'none',
    sendLimitRemainingCents: 50_000,
    receiveLimitRemainingCents: 75_000,
    ...overrides,
  };
}

function makeRecipients(size: number): PaymentsSendRecipientCandidate[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `recipient_${index}`,
    walletId: `wallet_recipient_${index}`,
    ownerUserId: `user_recipient_${index}`,
    displayName: `Recipient ${index}`,
    handle: `@recipient${index}`,
    email: `recipient${index}@example.com`,
    phone: `+1555555${String(1000 + index).slice(-4)}`,
    source:
      index % 3 === 0
        ? 'previous_counterparty'
        : index % 3 === 1
          ? 'contact'
          : 'handle',
    verificationState: index % 5 === 0 ? 'review' : 'verified',
    lastInteractionAt: '2026-04-24T12:00:00.000Z',
  }));
}

function makeSnapshot(input: {
  recipientCount?: number;
  selectedRecipientIndex?: number;
  amountCents?: number;
  availableCents?: number;
  authSatisfied?: boolean;
  degraded?: boolean;
  held?: boolean;
} = {}): PaymentsSendFlowSnapshot {
  const recipientCount = input.recipientCount ?? 4;
  const recipients = makeRecipients(recipientCount);
  const selectedIndex = Math.min(
    input.selectedRecipientIndex ?? 0,
    Math.max(recipients.length - 1, 0),
  );
  const selected = recipients[selectedIndex] ?? null;

  return {
    senderProfile: PROFILE,
    wallet: makeWallet({
      complianceHold: input.held ? 'freeze' : 'none',
      balances: {
        available: input.availableCents ?? 10_000,
        pending: 0,
        reserved: 0,
        escrow: 0,
      },
    }),
    recipients,
    serverNow: '2026-04-24T16:00:00.000Z',
    systemMode: input.degraded ? 'degraded' : 'operational',
    draft: {
      recipientQuery: selected?.handle ?? '',
      selectedRecipientId: selected?.id ?? null,
      amountText: String((input.amountCents ?? 1_250) / 100),
      note: 'Function gate send',
      speed: 'standard',
      clientSubmissionId: 'function-gate-send',
      authSatisfied: input.authSatisfied ?? true,
    },
    quote: {
      expiresAt: '2026-04-24T16:05:00.000Z',
      providerDeadlineAt: '2026-04-24T16:04:00.000Z',
    },
  };
}

describe('buildPaymentsSendFlowViewModel function quality gate', () => {
  it('matches contract behavior for ready, blocked, and auth states', () => {
    const ready = buildPaymentsSendFlowViewModel(makeSnapshot());
    const blocked = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        availableCents: 100,
      }),
    );
    const auth = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        authSatisfied: false,
      }),
    );

    expect(ready.state).toBe('ready_to_confirm');
    expect(ready.canSubmit).toBe(true);
    expect(blocked.blockReason?.code).toBe('insufficient_funds');
    expect(blocked.canSubmit).toBe(false);
    expect(auth.state).toBe('awaiting_auth');
    expect(auth.commandPreview?.command.idempotencyKey).toContain('pay_send_');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsSendFlowViewModel fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => makeSnapshot({
        recipientCount: randomInt(rng, 1, 24),
        selectedRecipientIndex: randomInt(rng, 0, 20),
        amountCents: randomInt(rng, 1, 100_000),
        availableCents: randomInt(rng, 0, 120_000),
        authSatisfied: rng() > 0.18,
        degraded: rng() > 0.94,
        held: rng() > 0.92,
      }),
      assertCase: async (input) => {
        const result = buildPaymentsSendFlowViewModel(input);

        expect(result.speed.options).toHaveLength(2);
        expect(result.recipientSearch.results.length).toBeLessThanOrEqual(6);
        expect(result.legalCopyBlocks.length).toBeGreaterThan(0);
        if (result.canSubmit) {
          expect(result.commandPreview).not.toBeNull();
          expect(result.blockReason).toBeNull();
          expect(result.confirmation.satisfied).toBe(true);
        }
        if (result.blockReason) {
          expect(result.canSubmit).toBe(false);
          expect(result.policyNotice?.blocking).toBe(true);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsSendFlowViewModel',
      sizes: [100, 200, 400],
      expected: 'linear',
      sampleRuns: 4,
      maxRatios: [5.0, 5.0],
      setup: (size) => makeSnapshot({
        recipientCount: size,
        selectedRecipientIndex: Math.floor(size / 2),
      }),
      run: async (input) => {
        for (let index = 0; index < 10; index += 1) {
          buildPaymentsSendFlowViewModel(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsSendFlowViewModel',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeSnapshot({
        recipientCount: 240,
        selectedRecipientIndex: 100,
      }),
      run: async (input) => {
        buildPaymentsSendFlowViewModel(input);
      },
    });
  });
});
