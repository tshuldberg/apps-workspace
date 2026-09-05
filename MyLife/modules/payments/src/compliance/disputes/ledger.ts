import {
  buildPaymentsAdjustmentPlan,
  buildPaymentsReversalPlan,
} from '../../engine/ledger';
import {
  assertPaymentsInvariant,
} from '../../engine/errors';
import type {
  PaymentsDisputeLedgerDecisionResult,
  ResolvePaymentsDisputeLedgerDecisionInput,
} from './types';

export function resolvePaymentsDisputeLedgerDecision(
  input: ResolvePaymentsDisputeLedgerDecisionInput,
): PaymentsDisputeLedgerDecisionResult {
  const amountCents =
    input.decision.amountCents ?? input.disputeCase.amountCents;

  switch (input.decision.decisionType) {
    case 'none':
      return {
        decisionType: 'none',
        amountCents: null,
        plan: null,
        nextTransferStatus: null,
        caseStatus: 'resolved',
        nextStep: 'No ledger change is required. Close the case when notifications are complete.',
        ledgerState: {
          recommendedDecision: null,
          ledgerActionPending: false,
          appliedDecision: 'none',
          appliedAt: input.decision.decidedAt,
        },
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          providerOutcome: input.disputeCase.providerOutcome,
        },
      };
    case 'reversal': {
      assertPaymentsInvariant(
        !!input.originalTransfer,
        'invalid_command',
        'originalTransfer is required for a dispute reversal',
        {
          disputeCaseId: input.disputeCase.caseId,
        },
      );
      const plan = buildPaymentsReversalPlan({
        originalPlan: input.originalTransfer.ledgerPlan,
        originalTransferId: input.originalTransfer.transferId,
        memo: input.decision.reason ?? 'Dispute reversal',
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          disputeDecision: 'reversal',
          actorUserId: input.decision.actorUserId ?? null,
        },
        createId: input.createId,
      });
      return {
        decisionType: 'reversal',
        amountCents,
        plan,
        nextTransferStatus: 'reversed',
        caseStatus: 'resolved',
        nextStep: 'Reversal plan is ready. Persist the posting and close the case.',
        ledgerState: {
          recommendedDecision: null,
          ledgerActionPending: false,
          appliedDecision: 'reversal',
          appliedAt: input.decision.decidedAt,
        },
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          originalTransferId: input.originalTransfer.transferId,
        },
      };
    }
    case 'refund': {
      assertPaymentsInvariant(
        !!input.refundSource && !!input.refundDestination,
        'invalid_command',
        'refundSource and refundDestination are required for a dispute refund',
        {
          disputeCaseId: input.disputeCase.caseId,
        },
      );
      const plan = buildPaymentsAdjustmentPlan({
        referenceId: input.disputeCase.caseId,
        sourceWalletId: input.refundSource.walletId,
        destinationWalletId: input.refundDestination.walletId,
        sourceBalanceBucket: input.refundSource.balanceBucket,
        destinationBalanceBucket: input.refundDestination.balanceBucket,
        amountCents,
        currency: input.disputeCase.currency,
        entryKind: 'chargeback',
        memo: input.decision.reason ?? 'Dispute refund',
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          disputeDecision: 'refund',
          providerOutcome: input.disputeCase.providerOutcome,
          actorUserId: input.decision.actorUserId ?? null,
        },
        createId: input.createId,
      });
      return {
        decisionType: 'refund',
        amountCents,
        plan,
        nextTransferStatus: null,
        caseStatus: 'resolved',
        nextStep: 'Refund plan is ready. Post the reimbursement and then close the case.',
        ledgerState: {
          recommendedDecision: null,
          ledgerActionPending: false,
          appliedDecision: 'refund',
          appliedAt: input.decision.decidedAt,
        },
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          ledgerEntryKind: 'chargeback',
        },
      };
    }
    case 'provisional_credit': {
      assertPaymentsInvariant(
        !!input.provisionalCreditSource && !!input.provisionalCreditDestination,
        'invalid_command',
        'provisionalCreditSource and provisionalCreditDestination are required for provisional credit',
        {
          disputeCaseId: input.disputeCase.caseId,
        },
      );
      const plan = buildPaymentsAdjustmentPlan({
        referenceId: input.disputeCase.caseId,
        sourceWalletId: input.provisionalCreditSource.walletId,
        destinationWalletId: input.provisionalCreditDestination.walletId,
        sourceBalanceBucket: input.provisionalCreditSource.balanceBucket,
        destinationBalanceBucket: input.provisionalCreditDestination.balanceBucket,
        amountCents,
        currency: input.disputeCase.currency,
        entryKind: 'adjustment',
        memo: input.decision.reason ?? 'Provisional credit',
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          disputeDecision: 'provisional_credit',
          provisionalCredit: true,
          actorUserId: input.decision.actorUserId ?? null,
        },
        createId: input.createId,
      });
      return {
        decisionType: 'provisional_credit',
        amountCents,
        plan,
        nextTransferStatus: null,
        caseStatus: 'resolved',
        nextStep:
          'Provisional credit plan is ready. Post the temporary credit and keep the provider case open until final outcome.',
        ledgerState: {
          recommendedDecision: null,
          ledgerActionPending: false,
          appliedDecision: 'provisional_credit',
          appliedAt: input.decision.decidedAt,
        },
        metadata: {
          disputeCaseId: input.disputeCase.caseId,
          ledgerEntryKind: 'adjustment',
          provisionalCredit: true,
        },
      };
    }
  }
}
