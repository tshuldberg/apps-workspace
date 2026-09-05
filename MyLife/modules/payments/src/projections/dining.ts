import type {
  CurrencyCode,
} from '../types';
import type {
  PaymentsContextualRequestDraft,
} from './types';

export interface PaymentsDiningLineItem {
  itemId: string;
  label: string;
  amountCents: number;
  assignedParticipantIds: string[];
}

export interface PaymentsDiningParticipant {
  participantId: string;
  displayName: string;
  walletId: string | null;
}

export interface PaymentsDiningSplitInput {
  diningSessionId: string;
  requesterWalletId: string;
  currency: CurrencyCode;
  participants: PaymentsDiningParticipant[];
  lineItems: PaymentsDiningLineItem[];
  taxCents: number;
  tipCents: number;
  rawReceiptImageLocalOnly: boolean;
}

export interface PaymentsDiningSplitProjection {
  diningSessionId: string;
  rawReceiptStoredByMyPay: false;
  requests: PaymentsContextualRequestDraft[];
  reviewTotalCents: number;
}

function participantSubtotal(
  participantId: string,
  items: PaymentsDiningLineItem[],
): number {
  return items.reduce((total, item) => {
    if (!item.assignedParticipantIds.includes(participantId)) {
      return total;
    }
    return total + Math.round(item.amountCents / Math.max(item.assignedParticipantIds.length, 1));
  }, 0);
}

export function buildDiningBillSplitRequests(
  input: PaymentsDiningSplitInput,
): PaymentsDiningSplitProjection {
  const subtotal = input.lineItems.reduce((total, item) => total + item.amountCents, 0);
  const reviewTotalCents = subtotal + input.taxCents + input.tipCents;

  return {
    diningSessionId: input.diningSessionId,
    rawReceiptStoredByMyPay: false,
    reviewTotalCents,
    requests: input.participants.map((participant) => {
      const shareSubtotal = participantSubtotal(participant.participantId, input.lineItems);
      const ratio = subtotal > 0 ? shareSubtotal / subtotal : 0;
      const amountCents = shareSubtotal + Math.round((input.taxCents + input.tipCents) * ratio);
      const idempotencyKey = `pay_dining_${input.diningSessionId}_${participant.participantId}_${amountCents}`;

      return {
        idempotencyKey,
        contextId: input.diningSessionId,
        payerWalletId: participant.walletId,
        payerLabel: participant.displayName,
        amountCents,
        currency: input.currency,
        memo: 'Dining split',
        command: {
          type: 'request',
          idempotencyKey,
          requesterWalletId: input.requesterWalletId,
          payerWalletId: participant.walletId,
          amountCents,
          currency: input.currency,
          memo: 'Dining split',
          metadata: {
            context: 'dining',
            diningSessionId: input.diningSessionId,
            participantId: participant.participantId,
            rawReceiptImageLocalOnly: input.rawReceiptImageLocalOnly,
          },
        },
      };
    }),
  };
}
