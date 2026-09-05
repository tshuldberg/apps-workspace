import { describe, expect, it } from 'vitest';

import {
  buildPaymentsProfile,
} from '../../compliance/profile';
import {
  createPaymentsDomainEngine,
} from '../../engine/engine';
import {
  PaymentsDomainError,
} from '../../engine/errors';
import type {
  PaymentsWalletSnapshot,
} from '../../engine/types';
import {
  buildPaymentsSendFlowViewModel,
  buildPaymentsSendIdempotencyKey,
  mapPaymentsSendSubmissionState,
  parsePaymentsSendAmount,
} from '../send';
import type {
  PaymentsSendFlowSnapshot,
  PaymentsSendRecipientCandidate,
} from '../send';

function createDeterministicIdFactory(): (prefix: string) => string {
  let index = 0;
  return (prefix: string) => `${prefix}_${String(index += 1).padStart(4, '0')}`;
}

const senderProfile = buildPaymentsProfile({
  ownerUserId: 'user_sender',
  primaryWalletId: 'wallet_sender',
  handle: '@sender',
  displayName: 'Sender Example',
  identityStatus: 'verified',
  verificationState: 'verified',
  approvedTier: 'basic',
  fields: {
    legalName: 'Sender Example',
    email: 'sender@example.com',
    phoneE164: '+15555550111',
  },
});

const recipients: PaymentsSendRecipientCandidate[] = [
  {
    id: 'avery',
    walletId: 'wallet_avery',
    ownerUserId: 'user_avery',
    displayName: 'Avery Stone',
    handle: '@avery',
    phone: '+15555550199',
    source: 'previous_counterparty',
    verificationState: 'verified',
    lastInteractionAt: '2026-04-24T12:00:00.000Z',
  },
  {
    id: 'morgan',
    walletId: 'wallet_morgan',
    ownerUserId: 'user_morgan',
    displayName: 'Morgan Lee',
    email: 'morgan@example.com',
    source: 'email',
    verificationState: 'verified',
  },
  {
    id: 'riley',
    walletId: 'wallet_riley',
    ownerUserId: 'user_riley',
    displayName: 'Riley Chen',
    handle: '@riley',
    source: 'contact',
    verificationState: 'review',
  },
];

function makeWallet(
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId: 'wallet_sender',
    ownerUserId: 'user_sender',
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: 25_000,
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

function makeSnapshot(
  overrides: Partial<PaymentsSendFlowSnapshot> = {},
): PaymentsSendFlowSnapshot {
  return {
    senderProfile,
    wallet: makeWallet(),
    recipients,
    serverNow: '2026-04-24T16:00:00.000Z',
    draft: {
      recipientQuery: '',
      selectedRecipientId: 'avery',
      amountText: '12.34',
      note: 'Dinner split',
      speed: 'standard',
      clientSubmissionId: 'client-send-1',
      authSatisfied: true,
    },
    quote: {
      quotedAt: '2026-04-24T15:59:00.000Z',
      expiresAt: '2026-04-24T16:05:00.000Z',
      providerDeadlineAt: '2026-04-24T16:04:00.000Z',
    },
    ...overrides,
  };
}

describe('payments send flow view model', () => {
  it('parses amount text and builds deterministic idempotency keys', () => {
    expect(parsePaymentsSendAmount('$1,234.50')).toMatchObject({
      amountCents: 123_450,
      valid: true,
    });
    expect(parsePaymentsSendAmount('10.999')).toMatchObject({
      amountCents: 0,
      valid: false,
    });

    const first = buildPaymentsSendIdempotencyKey({
      clientSubmissionId: 'client-send-1',
      sourceWalletId: 'wallet_sender',
      destinationWalletId: 'wallet_avery',
      amountCents: 1_234,
      currency: 'USD',
    });
    const second = buildPaymentsSendIdempotencyKey({
      clientSubmissionId: 'client-send-1',
      sourceWalletId: 'wallet_sender',
      destinationWalletId: 'wallet_avery',
      amountCents: 1_234,
      currency: 'USD',
    });

    expect(first).toBe(second);
    expect(first).toContain('pay_send_client-send-1');
  });

  it('filters recipients by phone, email, contact, and previous counterparty metadata', () => {
    const byPhone = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          recipientQuery: '+1 (555) 555-0199',
          selectedRecipientId: 'avery',
        },
      }),
    );
    const byEmail = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          recipientQuery: 'morgan@example.com',
          selectedRecipientId: 'morgan',
        },
      }),
    );
    const byContact = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          recipientQuery: 'contact',
          selectedRecipientId: 'riley',
        },
      }),
    );

    expect(byPhone.recipientSearch.results[0]?.id).toBe('avery');
    expect(byEmail.recipientSearch.results[0]?.id).toBe('morgan');
    expect(byContact.recipientSearch.results.some((candidate) => candidate.id === 'riley')).toBe(true);
    expect(byPhone.commandPreview?.command).toMatchObject({
      type: 'send',
      sourceWalletId: 'wallet_sender',
      destinationWalletId: 'wallet_avery',
      amountCents: 1_234,
      memo: 'Dinner split',
    });
    expect(byPhone.preview.totalDebitCents).toBe(1_234);
    expect(byPhone.preview.feeQuote?.feeCents).toBe(0);
  });

  it('blocks sends with domain error codes for low tier, holds, stale quotes, and insufficient funds', () => {
    const lowTierProfile = buildPaymentsProfile({
      ownerUserId: 'user_low',
      primaryWalletId: 'wallet_sender',
      handle: '@low',
      displayName: 'Low Tier',
      identityStatus: 'unsubmitted',
      verificationState: 'unverified',
      approvedTier: 'unverified',
    });
    const lowTier = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        senderProfile: lowTierProfile,
      }),
    );
    const hold = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        wallet: makeWallet({
          complianceHold: 'freeze',
        }),
      }),
    );
    const stale = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        quote: {
          expiresAt: '2026-04-24T15:00:00.000Z',
        },
      }),
    );
    const insufficient = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        wallet: makeWallet({
          balances: {
            available: 500,
          },
        }),
      }),
    );

    expect(lowTier.blockReason?.code).toBe('limit_blocked');
    expect(hold.blockReason?.code).toBe('compliance_hold');
    expect(stale.blockReason?.code).toBe('stale_quote');
    expect(insufficient.blockReason?.code).toBe('insufficient_funds');
    expect(insufficient.preview.remainingAvailableCents).toBeLessThan(0);
  });

  it('requires configured step-up auth before enabling submit', () => {
    const awaitingAuth = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        authPolicy: 'biometric',
        draft: {
          ...makeSnapshot().draft,
          authSatisfied: false,
        },
      }),
    );
    const ready = buildPaymentsSendFlowViewModel(
      makeSnapshot({
        authPolicy: 'biometric',
      }),
    );

    expect(awaitingAuth.state).toBe('awaiting_auth');
    expect(awaitingAuth.canSubmit).toBe(false);
    expect(awaitingAuth.confirmation.label).toBe('Biometric confirmation');
    expect(ready.state).toBe('ready_to_confirm');
    expect(ready.canSubmit).toBe(true);
  });

  it('maps successful sends and duplicate reconnect replays to domain transfer states', () => {
    const engine = createPaymentsDomainEngine({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      createId: createDeterministicIdFactory(),
    });
    const ready = buildPaymentsSendFlowViewModel(makeSnapshot());
    if (!ready.commandPreview) {
      throw new Error('Expected command preview');
    }

    const context = {
      wallets: {
        wallet_sender: makeWallet(),
        wallet_avery: makeWallet({
          walletId: 'wallet_avery',
          ownerUserId: 'user_avery',
        }),
      },
    };
    const first = engine.execute(ready.commandPreview.command, context);
    const replay = engine.execute(ready.commandPreview.command, context);
    const firstState = mapPaymentsSendSubmissionState({
      status: 'result',
      result: first,
    });
    const replayState = mapPaymentsSendSubmissionState({
      status: 'result',
      result: replay,
    });

    expect(firstState?.state).toBe('succeeded');
    expect(firstState?.eventType).toBe('posted');
    expect(replayState?.state).toBe('replayed');
    expect(replayState?.transferId).toBe(firstState?.transferId);
    expect(replayState?.body).toContain('without creating a second debit');
  });

  it('maps failed engine submissions to the exact domain error code', () => {
    const state = mapPaymentsSendSubmissionState({
      status: 'error',
      error: new PaymentsDomainError(
        'provider_timeout',
        'Provider deadline expired before command execution',
        {
          providerDeadlineAt: '2026-04-24T15:00:00.000Z',
        },
      ),
    });

    expect(state?.state).toBe('failed');
    expect(state?.code).toBe('provider_timeout');
    expect(state?.disclosure.id).toBe('send_result_error_provider_timeout');
  });
});
