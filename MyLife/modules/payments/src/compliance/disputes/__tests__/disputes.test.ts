import { describe, expect, it } from 'vitest';

import {
  applyPaymentsDisputeOperatorAction,
  buildPaymentsIssueReportDraft,
  buildPaymentsTransferDisputeSummary,
  createPaymentsDisputeCase,
  resolvePaymentsDisputeLedgerDecision,
  submitPaymentsDisputeEvidence,
} from '../index';
import type {
  PaymentsDisputeCase,
} from '../types';
import type {
  PaymentsPostedTransfer,
  PaymentsTransferRecord,
} from '../../../engine/types';

function makeTransfer(
  overrides: Partial<PaymentsTransferRecord> = {},
): PaymentsTransferRecord {
  return {
    transferId: 'pay_transfer_1',
    idempotencyKey: 'transfer-1',
    kind: 'p2p',
    status: 'completed',
    sourceWalletId: 'wallet_sender',
    destinationWalletId: 'wallet_receiver',
    sourceBalanceBucket: 'available',
    destinationBalanceBucket: 'available',
    sourceAmountCents: 9_500,
    sourceCurrency: 'USD',
    destinationAmountCents: 9_500,
    destinationCurrency: 'USD',
    feeAmountCents: 0,
    feeWalletId: null,
    sourceRail: 'wallet',
    destinationRail: 'wallet',
    memo: 'Dinner',
    externalReference: null,
    metadata: {},
    ...overrides,
  };
}

function makePostedTransfer(
  overrides: Partial<PaymentsPostedTransfer> = {},
): PaymentsPostedTransfer {
  return {
    ...makeTransfer(),
    ledgerPlan: {
      postingGroupId: 'pay_posting_group_1',
      entries: [
        {
          walletId: 'wallet_sender',
          balanceBucket: 'available',
          direction: 'debit',
          entryKind: 'principal',
          amountCents: 9_500,
          currency: 'USD',
          memo: 'Dinner',
          metadata: {
            transferId: 'pay_transfer_1',
          },
        },
        {
          walletId: 'wallet_receiver',
          balanceBucket: 'available',
          direction: 'credit',
          entryKind: 'principal',
          amountCents: 9_500,
          currency: 'USD',
          memo: 'Dinner',
          metadata: {
            transferId: 'pay_transfer_1',
          },
        },
      ],
      perCurrencyNet: { USD: 0 },
      balanced: true,
    },
    ...overrides,
  };
}

function makeCase(overrides: Partial<PaymentsDisputeCase> = {}): PaymentsDisputeCase {
  return createPaymentsDisputeCase({
    ownerUserId: 'user_owner',
    walletId: 'wallet_sender',
    transfer: makeTransfer(),
    transferOccurredAt: '2026-04-12T10:00:00.000Z',
    now: new Date('2026-04-22T12:00:00.000Z'),
    reasonCode: 'unauthorized_transfer',
    userStatement: 'I did not approve this transfer from my wallet.',
    counterparty: {
      id: 'cp_1',
      displayName: 'Avery Stone',
      handle: '@avery',
      verification: 'verified',
    },
    ...overrides,
  });
}

describe('payments disputes workflow', () => {
  it('builds an issue-report draft from transfer detail and blocks duplicate active cases', () => {
    const transfer = makeTransfer();
    const existingCase = makeCase({
      transferId: transfer.transferId,
    });

    const draft = buildPaymentsIssueReportDraft({
      ownerUserId: 'user_owner',
      walletId: 'wallet_sender',
      transfer,
      transferOccurredAt: '2026-04-12T10:00:00.000Z',
      now: new Date('2026-04-22T12:00:00.000Z'),
      existingCases: [existingCase],
    });

    expect(draft.caseSubtype).toBe('unauthorized_transfer');
    expect(draft.caseType).toBe('reg_e_error');
    expect(draft.reportable).toBe(false);
    expect(draft.currentCaseSummary?.hasActiveCase).toBe(true);
    expect(draft.reasonOptions.length).toBeGreaterThan(0);
    expect(draft.evidenceSlots.length).toBeGreaterThan(0);
  });

  it('models card disputes with provider outcomes before choosing a ledger action', () => {
    const cardCase = createPaymentsDisputeCase({
      ownerUserId: 'user_owner',
      walletId: 'wallet_cardholder',
      transfer: makeTransfer({
        transferId: 'pay_transfer_card',
        kind: 'card_capture',
        sourceRail: 'card',
        destinationRail: 'merchant',
      }),
      transferOccurredAt: '2026-04-20T10:00:00.000Z',
      now: new Date('2026-04-22T12:00:00.000Z'),
      cardTransactionId: 'card_txn_1',
      providerName: 'fake',
      reasonCode: 'card_not_present_fraud',
      userStatement: 'This card purchase was not authorized by the cardholder.',
    });

    const submitted = applyPaymentsDisputeOperatorAction({
      disputeCase: cardCase,
      actionType: 'submit_to_provider',
      actedAt: '2026-04-22T13:00:00.000Z',
      actorUserId: 'operator_1',
      note: 'Submitted to the processor for review.',
    });
    const withOutcome = applyPaymentsDisputeOperatorAction({
      disputeCase: submitted,
      actionType: 'record_provider_outcome',
      actedAt: '2026-04-24T08:30:00.000Z',
      actorUserId: 'operator_1',
      providerOutcome: 'chargeback_debit',
      note: 'Provider debited the merchant balance.',
    });

    expect(withOutcome.providerOutcome).toBe('chargeback_debit');
    expect(withOutcome.ledgerState.ledgerActionPending).toBe(false);
    expect(withOutcome.nextStep).toContain('reversal, refund, or no-ledger-change');

    const refundDecision = resolvePaymentsDisputeLedgerDecision({
      disputeCase: withOutcome,
      decision: {
        decisionType: 'refund',
        decidedAt: '2026-04-24T09:00:00.000Z',
        actorUserId: 'operator_1',
        reason: 'Honor the provider debit with a wallet refund.',
      },
      refundSource: {
        walletId: 'wallet_merchant_reserve',
        balanceBucket: 'reserved',
      },
      refundDestination: {
        walletId: 'wallet_cardholder',
        balanceBucket: 'available',
      },
    });

    expect(refundDecision.plan?.entries).toHaveLength(2);
    expect(refundDecision.plan?.entries[0]?.entryKind).toBe('chargeback');
    expect(refundDecision.nextTransferStatus).toBeNull();
    expect(refundDecision.ledgerState.appliedDecision).toBe('refund');
  });

  it('tracks requested evidence and returns the case to review when evidence arrives', () => {
    const marketCase = createPaymentsDisputeCase({
      ownerUserId: 'user_buyer',
      walletId: 'wallet_buyer',
      transfer: makeTransfer({
        transferId: 'pay_transfer_market',
        kind: 'escrow_release',
        sourceBalanceBucket: 'escrow',
        destinationBalanceBucket: 'available',
      }),
      transferOccurredAt: '2026-04-20T10:00:00.000Z',
      now: new Date('2026-04-22T12:00:00.000Z'),
      market: {
        orderId: 'order_1',
        escrowId: 'escrow_1',
        listingId: 'listing_1',
        itemTitle: 'Vintage camera',
      },
      reasonCode: 'item_not_as_described',
      userStatement: 'The received item does not match the listing photos or description.',
    });

    const requested = applyPaymentsDisputeOperatorAction({
      disputeCase: marketCase,
      actionType: 'request_evidence',
      actedAt: '2026-04-22T14:00:00.000Z',
      actorUserId: 'operator_1',
      requestedSlotIds: marketCase.evidenceSlots
        .filter((slot) => slot.status === 'required')
        .map((slot) => slot.slotId),
      note: 'Need listing screenshots and thread context.',
    });
    const submitted = submitPaymentsDisputeEvidence({
      disputeCase: requested,
      submittedAt: '2026-04-22T15:30:00.000Z',
      submittedByUserId: 'user_buyer',
      slotSubmissions: requested.evidenceSlots
        .filter((slot) => slot.status === 'required')
        .map((slot, index) => ({
          slotId: slot.slotId,
          attachmentId: `attachment_${index + 1}`,
          note: `Uploaded evidence for ${slot.label}.`,
        })),
      note: 'Added the screenshots you requested.',
    });
    const summary = buildPaymentsTransferDisputeSummary({
      transfer: makeTransfer({
        transferId: 'pay_transfer_market',
        kind: 'escrow_release',
        sourceBalanceBucket: 'escrow',
        destinationBalanceBucket: 'available',
      }),
      disputes: [submitted],
    });

    expect(submitted.status).toBe('under_review');
    expect(
      submitted.deadlines.find((deadline) => deadline.kind === 'evidence_by')?.status,
    ).toBe('met');
    expect(summary.caseSubtype).toBe('market_escrow');
    expect(summary.nextStep).toContain('Operator review');
  });

  it('builds reversal and provisional-credit ledger hooks without mutating the original ledger', () => {
    const disputeCase = makeCase();
    const provisional = resolvePaymentsDisputeLedgerDecision({
      disputeCase,
      decision: {
        decisionType: 'provisional_credit',
        decidedAt: '2026-04-22T13:30:00.000Z',
        actorUserId: 'operator_1',
        reason: 'Issue a temporary credit while review continues.',
      },
      provisionalCreditSource: {
        walletId: 'wallet_treasury',
        balanceBucket: 'reserved',
      },
      provisionalCreditDestination: {
        walletId: 'wallet_sender',
        balanceBucket: 'available',
      },
    });
    const reversal = resolvePaymentsDisputeLedgerDecision({
      disputeCase,
      decision: {
        decisionType: 'reversal',
        decidedAt: '2026-04-22T14:00:00.000Z',
        actorUserId: 'operator_1',
        reason: 'Reverse the posted transfer after confirming unauthorized use.',
      },
      originalTransfer: makePostedTransfer(),
    });

    expect(provisional.plan?.entries[0]?.entryKind).toBe('adjustment');
    expect(provisional.nextTransferStatus).toBeNull();
    expect(reversal.plan?.entries[0]?.entryKind).toBe('reversal');
    expect(reversal.nextTransferStatus).toBe('reversed');
  });
});
