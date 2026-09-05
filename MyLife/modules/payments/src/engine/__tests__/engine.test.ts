import { describe, expect, it } from 'vitest';

import {
  createPaymentsDomainEngine,
} from '../index';
import {
  buildPaymentsProfile,
} from '../../compliance';
import {
  assessPaymentsTransferRisk,
} from '../../risk';
import { PaymentsDomainError } from '../errors';
import type {
  PaymentsExecutionContext,
  PaymentsPostedTransfer,
  PaymentsWalletSnapshot,
} from '../types';

function createDeterministicIdFactory(): (prefix: string) => string {
  let index = 0;
  return (prefix: string) => `${prefix}_${String(index += 1).padStart(4, '0')}`;
}

function makeWallet(
  walletId: string,
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId,
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: 0,
      pending: 0,
      reserved: 0,
      escrow: 0,
      ...(overrides.balances ?? {}),
    },
    complianceHold: 'none',
    sendLimitRemainingCents: null,
    receiveLimitRemainingCents: null,
    ...overrides,
  };
}

function makeContext(
  ...wallets: PaymentsWalletSnapshot[]
): PaymentsExecutionContext {
  return {
    wallets: Object.fromEntries(wallets.map((wallet) => [wallet.walletId, wallet])),
  };
}

function makeEngine() {
  return createPaymentsDomainEngine({
    now: () => new Date('2026-04-20T12:00:00.000Z'),
    createId: createDeterministicIdFactory(),
  });
}

function makeRiskAwareEngine() {
  const sourceProfile = buildPaymentsProfile({
    ownerUserId: 'user_sender',
    primaryWalletId: 'wallet_sender',
    handle: '@sender',
    countryCode: 'US',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
    fields: {
      legalName: 'Sender Example',
      email: 'sender@example.com',
      phoneE164: '+14155550123',
    },
  });
  const destinationProfile = buildPaymentsProfile({
    ownerUserId: 'user_receiver',
    primaryWalletId: 'wallet_receiver',
    handle: '@receiver',
    countryCode: 'US',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
    fields: {
      legalName: 'Receiver Example',
      email: 'receiver@example.com',
      phoneE164: '+14155550124',
    },
  });

  return createPaymentsDomainEngine({
    now: () => new Date('2026-04-20T12:00:00.000Z'),
    createId: createDeterministicIdFactory(),
    riskGuard: (input) =>
      assessPaymentsTransferRisk({
        ...input,
        sourceProfile: {
          ownerUserId: sourceProfile.ownerUserId,
          walletId: sourceProfile.primaryWalletId,
          identityId: 'identity_sender',
          countryCode: sourceProfile.countryCode,
          walletType: sourceProfile.walletType,
          tierAssessment: sourceProfile.tierAssessment,
        },
        destinationProfile: {
          ownerUserId: destinationProfile.ownerUserId,
          walletId: destinationProfile.primaryWalletId,
          identityId: 'identity_receiver',
          countryCode: destinationProfile.countryCode,
          walletType: destinationProfile.walletType,
          tierAssessment: destinationProfile.tierAssessment,
        },
        sanctionsParties: [
          {
            partyId: 'party_sender',
            role: 'sender',
            displayName: 'Sender Example',
            screeningState: 'clear',
          },
          {
            partyId: 'party_receiver',
            role: 'recipient',
            displayName: 'Receiver Example',
            screeningState: 'clear',
          },
        ],
      }),
  });
}

function expectTransferResult(
  value: ReturnType<ReturnType<typeof createPaymentsDomainEngine>['execute']>,
) {
  if (value.kind !== 'transfer') {
    throw new Error(`Expected transfer result, received ${value.kind}`);
  }
  return value;
}

function expectTransferStatusResult(
  value: ReturnType<ReturnType<typeof createPaymentsDomainEngine>['execute']>,
) {
  if (value.kind !== 'transfer_status') {
    throw new Error(`Expected transfer_status result, received ${value.kind}`);
  }
  return value;
}

describe('payments domain engine', () => {
  it('posts a completed internal send with a balanced ledger plan', () => {
    const engine = makeEngine();
    const result = expectTransferResult(
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-1',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 1_500,
          currency: 'USD',
          memo: 'Rent split',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 5_000 },
          }),
          makeWallet('wallet_receiver', {
            balances: { available: 300 },
          }),
        ),
      ),
    );

    expect(result.replayed).toBe(false);
    expect(result.eventType).toBe('posted');
    expect(result.transfer.status).toBe('completed');
    expect(result.transfer.sourceBalanceBucket).toBe('available');
    expect(result.transfer.destinationBalanceBucket).toBe('available');
    expect(result.transfer.feeAmountCents).toBe(0);
    expect(result.ledgerPlan.balanced).toBe(true);
    expect(result.ledgerPlan.perCurrencyNet).toEqual({ USD: 0 });
    expect(result.ledgerPlan.entries).toHaveLength(2);
  });

  it('uses pending and reserved buckets for in-flight funding and withdrawal flows', () => {
    const engine = makeEngine();
    const fundResult = expectTransferResult(
      engine.execute(
        {
          type: 'fund',
          idempotencyKey: 'fund-1',
          settlementWalletId: 'wallet_treasury',
          destinationWalletId: 'wallet_user',
          amountCents: 2_500,
          currency: 'USD',
          desiredStatus: 'pending_provider',
        },
        makeContext(
          makeWallet('wallet_treasury', {
            balances: {
              pending: 25_000,
              available: 25_000,
            },
          }),
          makeWallet('wallet_user'),
        ),
      ),
    );

    const withdrawResult = expectTransferResult(
      engine.execute(
        {
          type: 'withdraw',
          idempotencyKey: 'withdraw-1',
          sourceWalletId: 'wallet_user',
          settlementWalletId: 'wallet_treasury',
          amountCents: 4_000,
          currency: 'USD',
          desiredStatus: 'pending_provider',
          speed: 'instant',
          feeWalletId: 'wallet_fee',
        },
        makeContext(
          makeWallet('wallet_user', {
            balances: {
              available: 10_000,
            },
          }),
          makeWallet('wallet_treasury', {
            balances: {
              reserved: 1_000,
              available: 5_000,
            },
          }),
          makeWallet('wallet_fee'),
        ),
      ),
    );

    expect(fundResult.transfer.sourceBalanceBucket).toBe('pending');
    expect(fundResult.transfer.destinationBalanceBucket).toBe('pending');
    expect(withdrawResult.transfer.sourceBalanceBucket).toBe('available');
    expect(withdrawResult.transfer.destinationBalanceBucket).toBe('reserved');
    expect(withdrawResult.feeQuote.profile).toBe('instant_payout');
    expect(withdrawResult.feeQuote.feeCents).toBe(70);
    expect(withdrawResult.ledgerPlan.entries).toHaveLength(4);
  });

  it('creates open payment requests without touching the ledger', () => {
    const engine = makeEngine();
    const result = engine.execute(
      {
        type: 'request',
        idempotencyKey: 'request-1',
        requesterWalletId: 'wallet_requester',
        payerWalletId: 'wallet_payer',
        amountCents: 800,
        currency: 'USD',
        memo: 'Coffee',
      },
      makeContext(
        makeWallet('wallet_requester'),
        makeWallet('wallet_payer'),
      ),
    );

    expect(result.kind).toBe('request');
    if (result.kind !== 'request') {
      throw new Error('Expected request result');
    }
    expect(result.request.status).toBe('open');
    expect(result.request.memo).toBe('Coffee');
  });

  it('replays duplicate commands with the original result', () => {
    const engine = makeEngine();
    const context = makeContext(
      makeWallet('wallet_sender', {
        balances: { available: 5_000 },
      }),
      makeWallet('wallet_receiver'),
    );
    const command = {
      type: 'send' as const,
      idempotencyKey: 'send-replay',
      sourceWalletId: 'wallet_sender',
      destinationWalletId: 'wallet_receiver',
      amountCents: 1_200,
      currency: 'USD' as const,
    };

    const first = expectTransferResult(engine.execute(command, context));
    const second = expectTransferResult(engine.execute(command, context));

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.transfer.transferId).toBe(first.transfer.transferId);
    expect(second.ledgerPlan.postingGroupId).toBe(first.ledgerPlan.postingGroupId);
  });

  it('rejects idempotency key reuse with a different payload', () => {
    const engine = makeEngine();
    const context = makeContext(
      makeWallet('wallet_sender', {
        balances: { available: 5_000 },
      }),
      makeWallet('wallet_receiver'),
    );

    engine.execute(
      {
        type: 'send',
        idempotencyKey: 'send-conflict',
        sourceWalletId: 'wallet_sender',
        destinationWalletId: 'wallet_receiver',
        amountCents: 900,
        currency: 'USD',
      },
      context,
    );

    try {
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-conflict',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 1_000,
          currency: 'USD',
        },
        context,
      );
      throw new Error('Expected idempotency conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentsDomainError);
      expect((error as PaymentsDomainError).code).toBe('idempotency_conflict');
    }
  });

  it('holds a transfer before posting when risk review is required', () => {
    const engine = createPaymentsDomainEngine({
      now: () => new Date('2026-04-20T12:00:00.000Z'),
      createId: createDeterministicIdFactory(),
      riskGuard: (input) =>
        assessPaymentsTransferRisk({
          ...input,
          sourceProfile: {
            ownerUserId: 'user_sender',
            walletId: 'wallet_sender',
            identityId: 'identity_sender',
            countryCode: 'US',
            walletType: 'consumer',
            tierAssessment: buildPaymentsProfile({
              ownerUserId: 'user_sender',
              primaryWalletId: 'wallet_sender',
              countryCode: 'US',
              handle: '@sender',
              identityStatus: 'verified',
              verificationState: 'verified',
              approvedTier: 'basic',
              fields: {
                legalName: 'Sender Example',
                email: 'sender@example.com',
                phoneE164: '+14155550123',
              },
            }).tierAssessment,
          },
          sanctionsParties: [
            {
              partyId: 'party_receiver',
              role: 'recipient',
              displayName: 'Potential Match',
              screeningState: 'potential_match',
              screeningReference: 'screen_001',
            },
          ],
        }),
    });

    const result = expectTransferResult(
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-hold',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 10_000,
          currency: 'USD',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 50_000 },
          }),
          makeWallet('wallet_receiver'),
        ),
      ),
    );

    expect(result.eventType).toBe('hold_applied');
    expect(result.transfer.status).toBe('pending_review');
    expect(result.ledgerPlan.entries).toHaveLength(0);
    expect(result.transfer.metadata.risk).toMatchObject({
      outcome: 'hold',
      machineReasonCodes: ['sanctions.potential_match'],
    });
  });

  it('rejects a transfer with explicit risk details before posting', () => {
    const engine = makeRiskAwareEngine();

    expect(() =>
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-reject',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 150_000,
          currency: 'USD',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 500_000 },
          }),
          makeWallet('wallet_receiver'),
        ),
      ),
    ).toThrow(PaymentsDomainError);

    try {
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-reject',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 150_000,
          currency: 'USD',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 500_000 },
          }),
          makeWallet('wallet_receiver'),
        ),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentsDomainError);
      const domainError = error as PaymentsDomainError;
      expect(domainError.code).toBe('limit_blocked');
      expect(domainError.details).toMatchObject({
        machineReasonCodes: ['velocity.single_limit_exceeded'],
      });
      expect(domainError.details?.userSafeExplanation).toContain(
        'per-transaction limit',
      );
    }
  });

  it('surfaces insufficient-funds and compliance-hold errors', () => {
    const engine = makeEngine();

    expect(() =>
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-insufficient',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 2_500,
          currency: 'USD',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 1_000 },
          }),
          makeWallet('wallet_receiver'),
        ),
      ),
    ).toThrow(PaymentsDomainError);

    try {
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-hold',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 200,
          currency: 'USD',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 1_000 },
            complianceHold: 'freeze',
          }),
          makeWallet('wallet_receiver'),
        ),
      );
      throw new Error('Expected compliance hold');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentsDomainError);
      expect((error as PaymentsDomainError).code).toBe('compliance_hold');
    }
  });

  it('does not persist a failed send attempt as a partial posting', () => {
    const engine = makeEngine();
    const command = {
      type: 'send' as const,
      idempotencyKey: 'send-atomic',
      sourceWalletId: 'wallet_sender',
      destinationWalletId: 'wallet_missing',
      amountCents: 400,
      currency: 'USD' as const,
    };

    expect(() =>
      engine.execute(
        command,
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 1_000 },
          }),
        ),
      ),
    ).toThrow(PaymentsDomainError);

    const recovered = expectTransferResult(
      engine.execute(
        {
          ...command,
          destinationWalletId: 'wallet_receiver',
        },
        makeContext(
          makeWallet('wallet_sender', {
            balances: { available: 1_000 },
          }),
          makeWallet('wallet_receiver'),
        ),
      ),
    );

    expect(recovered.replayed).toBe(false);
    expect(recovered.transfer.transferId).toBe('pay_transfer_0001');
  });

  it('builds reversal and dispute transitions on top of an existing transfer', () => {
    const engine = makeEngine();
    const context = makeContext(
      makeWallet('wallet_sender', {
        balances: { available: 8_000 },
      }),
      makeWallet('wallet_receiver'),
    );
    const original = expectTransferResult(
      engine.execute(
        {
          type: 'send',
          idempotencyKey: 'send-original',
          sourceWalletId: 'wallet_sender',
          destinationWalletId: 'wallet_receiver',
          amountCents: 1_100,
          currency: 'USD',
        },
        context,
      ),
    );

    const disputed = expectTransferStatusResult(
      engine.execute(
        {
          type: 'dispute_open',
          idempotencyKey: 'send-dispute-open',
          transfer: original.transfer,
          reason: 'fraud report',
        },
        context,
      ),
    );

    const disputeClosed = expectTransferStatusResult(
      engine.execute(
        {
          type: 'dispute_close',
          idempotencyKey: 'send-dispute-close',
          transfer: disputed.transfer,
          resolution: 'cleared',
        },
        context,
      ),
    );

    const reversal = expectTransferResult(
      engine.execute(
        {
          type: 'reverse',
          idempotencyKey: 'send-reverse',
          transfer: original.transfer as PaymentsPostedTransfer,
          reason: 'duplicate transfer',
        },
        context,
      ),
    );

    expect(disputed.transfer.status).toBe('disputed');
    expect(disputed.eventType).toBe('dispute_opened');
    expect(disputeClosed.transfer.status).toBe('completed');
    expect(disputeClosed.eventType).toBe('dispute_closed');
    expect(reversal.eventType).toBe('reversed');
    expect(reversal.transfer.kind).toBe('reversal');
    expect(reversal.ledgerPlan.entries[0]?.direction).toBe('credit');
    expect(reversal.ledgerPlan.perCurrencyNet).toEqual({ USD: 0 });
  });
});
