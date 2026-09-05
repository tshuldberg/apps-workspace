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
  PaymentsPaymentRequestRecord,
  PaymentsWalletSnapshot,
} from '../../engine/types';
import {
  buildPaymentsRequestAcceptanceSendCommand,
  buildPaymentsRequestDetailState,
  buildPaymentsRequestFlowViewModel,
  buildPaymentsRequestIdempotencyKey,
  mapPaymentsRequestSubmissionState,
} from '../request';
import type {
  PaymentsRequestAntiAbuseConstraints,
  PaymentsRequestFlowSnapshot,
  PaymentsRequestRecord,
  PaymentsRequestTargetCandidate,
} from '../request';

function createDeterministicIdFactory(): (prefix: string) => string {
  let index = 0;
  return (prefix: string) => `${prefix}_${String(index += 1).padStart(4, '0')}`;
}

const requesterProfile = buildPaymentsProfile({
  ownerUserId: 'user_requester',
  primaryWalletId: 'wallet_requester',
  handle: '@requester',
  displayName: 'Requester Example',
  identityStatus: 'verified',
  verificationState: 'verified',
  approvedTier: 'basic',
  fields: {
    legalName: 'Requester Example',
    email: 'requester@example.com',
    phoneE164: '+15555550111',
  },
});

const targets: PaymentsRequestTargetCandidate[] = [
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
    source: 'known_user',
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

const antiAbuse: PaymentsRequestAntiAbuseConstraints = {
  maxUses: 1,
  maxAmountCents: 50_000,
  expiresWithinHours: 72,
  reminderCooldownHours: 24,
  maxReminders: 2,
  rateLimitKey: 'requester:user_requester',
};

function makeWallet(
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId: 'wallet_requester',
    ownerUserId: 'user_requester',
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

function makeRequest(
  overrides: Partial<PaymentsRequestRecord> = {},
): PaymentsRequestRecord {
  return {
    requestId: 'request_1',
    idempotencyKey: 'request-key-1',
    requesterWalletId: 'wallet_requester',
    payerWalletId: 'wallet_avery',
    status: 'open',
    amountCents: 1_250,
    currency: 'USD',
    expiresAt: '2026-04-25T16:00:00.000Z',
    memo: 'Coffee',
    metadata: {},
    createdAt: '2026-04-24T16:00:00.000Z',
    requesterDisplayName: 'Requester Example',
    payerDisplayName: 'Avery Stone',
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<PaymentsRequestFlowSnapshot> = {},
): PaymentsRequestFlowSnapshot {
  return {
    requesterProfile,
    wallet: makeWallet(),
    targets,
    serverNow: '2026-04-24T16:00:00.000Z',
    draft: {
      mode: 'known_user',
      targetQuery: '',
      selectedTargetId: 'avery',
      amountText: '12.50',
      note: 'Coffee',
      expiresAt: '2026-04-25T16:00:00.000Z',
      clientSubmissionId: 'client-request-1',
    },
    antiAbuse,
    existingRequests: [makeRequest()],
    selectedRequestId: 'request_1',
    acceptancePayerWalletId: 'wallet_avery',
    ...overrides,
  };
}

describe('payments request flow view model', () => {
  it('builds deterministic direct request commands and maps engine results', () => {
    const firstKey = buildPaymentsRequestIdempotencyKey({
      clientSubmissionId: 'client-request-1',
      requesterWalletId: 'wallet_requester',
      payerWalletId: 'wallet_avery',
      amountCents: 1_250,
      currency: 'USD',
      expiresAt: '2026-04-25T16:00:00.000Z',
      mode: 'known_user',
    });
    const secondKey = buildPaymentsRequestIdempotencyKey({
      clientSubmissionId: 'client-request-1',
      requesterWalletId: 'wallet_requester',
      payerWalletId: 'wallet_avery',
      amountCents: 1_250,
      currency: 'USD',
      expiresAt: '2026-04-25T16:00:00.000Z',
      mode: 'known_user',
    });
    const viewModel = buildPaymentsRequestFlowViewModel(makeSnapshot({
      draft: {
        ...makeSnapshot().draft,
        targetQuery: '+1 (555) 555-0199',
      },
    }));

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toContain('pay_request_client-request-1');
    expect(viewModel.targetSearch.results[0]?.id).toBe('avery');
    expect(viewModel.commandPreview?.command).toMatchObject({
      type: 'request',
      requesterWalletId: 'wallet_requester',
      payerWalletId: 'wallet_avery',
      amountCents: 1_250,
      memo: 'Coffee',
    });

    const engine = createPaymentsDomainEngine({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      createId: createDeterministicIdFactory(),
    });
    if (!viewModel.commandPreview) {
      throw new Error('Expected request command preview');
    }
    const result = engine.execute(viewModel.commandPreview.command, {
      wallets: {
        wallet_requester: makeWallet(),
        wallet_avery: makeWallet({
          walletId: 'wallet_avery',
          ownerUserId: 'user_avery',
        }),
      },
    });
    const state = mapPaymentsRequestSubmissionState({
      status: 'result',
      result,
    });

    expect(result.kind).toBe('request');
    expect(state?.state).toBe('created');
    expect(state?.requestStatus).toBe('open');
    expect(state?.body).toContain('Funds will only move');
  });

  it('enforces payment-link expiry and anti-abuse constraints', () => {
    const missingExpiry = buildPaymentsRequestFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          mode: 'payment_link',
          selectedTargetId: null,
          expiresAt: null,
        },
      }),
    );
    const missingConstraints = buildPaymentsRequestFlowViewModel(
      makeSnapshot({
        antiAbuse: null,
        draft: {
          ...makeSnapshot().draft,
          mode: 'payment_link',
          selectedTargetId: null,
        },
      }),
    );
    const amountTooHigh = buildPaymentsRequestFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          mode: 'payment_link',
          selectedTargetId: null,
          amountText: '600.00',
        },
      }),
    );
    const expiresTooLate = buildPaymentsRequestFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          mode: 'payment_link',
          selectedTargetId: null,
          expiresAt: '2026-05-01T16:00:00.000Z',
        },
      }),
    );
    const validLink = buildPaymentsRequestFlowViewModel(
      makeSnapshot({
        draft: {
          ...makeSnapshot().draft,
          mode: 'payment_link',
          selectedTargetId: null,
        },
      }),
    );

    expect(missingExpiry.blockReason?.code).toBe('invalid_command');
    expect(missingConstraints.blockReason?.title).toBe('Add link constraints');
    expect(amountTooHigh.blockReason?.code).toBe('limit_blocked');
    expect(expiresTooLate.blockReason?.title).toBe('Link expiry exceeds policy');
    expect(validLink.blockReason).toBeNull();
    expect(validLink.commandPreview?.command.payerWalletId).toBeNull();
    expect(validLink.preview.guardrailDisclosure.body).toContain('Single-use link');
  });

  it('maps pending, paid, declined, expired, and canceled request detail timelines', () => {
    const pending = buildPaymentsRequestDetailState({
      request: makeRequest(),
      serverNow: '2026-04-24T16:00:00.000Z',
      constraints: antiAbuse,
      acceptancePayerWalletId: 'wallet_avery',
    });
    const paid = buildPaymentsRequestDetailState({
      request: makeRequest({
        status: 'paid',
        paidAt: '2026-04-24T17:00:00.000Z',
        acceptedTransferId: 'transfer_1',
      }),
      serverNow: '2026-04-24T17:10:00.000Z',
      constraints: antiAbuse,
      acceptancePayerWalletId: 'wallet_avery',
    });
    const declined = buildPaymentsRequestDetailState({
      request: makeRequest({
        status: 'declined',
        declinedAt: '2026-04-24T17:00:00.000Z',
      }),
      serverNow: '2026-04-24T17:10:00.000Z',
      constraints: antiAbuse,
      acceptancePayerWalletId: 'wallet_avery',
    });
    const expired = buildPaymentsRequestDetailState({
      request: makeRequest({
        status: 'expired',
        expiredAt: '2026-04-25T16:00:00.000Z',
      }),
      serverNow: '2026-04-25T16:10:00.000Z',
      constraints: antiAbuse,
      acceptancePayerWalletId: 'wallet_avery',
    });
    const canceled = buildPaymentsRequestDetailState({
      request: makeRequest({
        status: 'canceled',
        canceledAt: '2026-04-24T17:00:00.000Z',
      }),
      serverNow: '2026-04-24T17:10:00.000Z',
      constraints: antiAbuse,
      acceptancePayerWalletId: 'wallet_avery',
    });

    expect(pending.lifecycleState).toBe('pending');
    expect(pending.actions.find((action) => action.id === 'remind')?.enabled).toBe(true);
    expect(pending.actions.find((action) => action.id === 'cancel')?.enabled).toBe(true);
    expect(pending.requesterTimeline).toEqual(pending.payerTimeline);
    expect(paid.lifecycleState).toBe('paid');
    expect(paid.timeline[2]?.detail).toContain('transfer_1');
    expect(declined.lifecycleState).toBe('declined');
    expect(expired.lifecycleState).toBe('expired');
    expect(canceled.lifecycleState).toBe('canceled');
    expect(canceled.actions.every((action) => !action.enabled)).toBe(true);
  });

  it('routes request acceptance through the existing send transfer engine', () => {
    const request: PaymentsPaymentRequestRecord = makeRequest();
    const command = buildPaymentsRequestAcceptanceSendCommand({
      request,
      payerWalletId: 'wallet_avery',
      clientSubmissionId: 'client-accept-1',
    });
    if (!command) {
      throw new Error('Expected send command');
    }

    const engine = createPaymentsDomainEngine({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      createId: createDeterministicIdFactory(),
    });
    const result = engine.execute(command, {
      wallets: {
        wallet_requester: makeWallet(),
        wallet_avery: makeWallet({
          walletId: 'wallet_avery',
          ownerUserId: 'user_avery',
          balances: {
            available: 5_000,
          },
        }),
      },
    });

    expect(command.type).toBe('send');
    expect(command.externalReference).toBe('request_1');
    expect(result.kind).toBe('transfer');
    if (result.kind !== 'transfer') {
      throw new Error('Expected transfer result');
    }
    expect(result.transfer.sourceWalletId).toBe('wallet_avery');
    expect(result.transfer.destinationWalletId).toBe('wallet_requester');
    expect(result.transfer.metadata.acceptedPaymentRequestId).toBe('request_1');
  });

  it('maps duplicate request submissions and domain failures without changing codes', () => {
    const engine = createPaymentsDomainEngine({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      createId: createDeterministicIdFactory(),
    });
    const ready = buildPaymentsRequestFlowViewModel(makeSnapshot());
    if (!ready.commandPreview) {
      throw new Error('Expected command preview');
    }
    const context = {
      wallets: {
        wallet_requester: makeWallet(),
        wallet_avery: makeWallet({
          walletId: 'wallet_avery',
          ownerUserId: 'user_avery',
        }),
      },
    };
    const first = engine.execute(ready.commandPreview.command, context);
    const replay = engine.execute(ready.commandPreview.command, context);
    const replayState = mapPaymentsRequestSubmissionState({
      status: 'result',
      result: replay,
    });
    const failureState = mapPaymentsRequestSubmissionState({
      status: 'error',
      error: new PaymentsDomainError(
        'idempotency_conflict',
        'Command replay did not match the original request',
      ),
    });

    expect(first.kind).toBe('request');
    expect(replayState?.state).toBe('replayed');
    expect(replayState?.requestId).toBe(
      first.kind === 'request' ? first.request.requestId : null,
    );
    expect(failureState?.state).toBe('failed');
    expect(failureState?.code).toBe('idempotency_conflict');
  });
});
