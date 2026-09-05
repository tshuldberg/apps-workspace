import type {
  CurrencyCode,
} from '../types';
import type {
  PaymentsContextualRequestDraft,
} from './types';

export type PaymentsSplitMethod = 'equal' | 'custom' | 'percentage';

export interface PaymentsRsvpSplitAttendee {
  attendeeId: string;
  displayName: string;
  walletId: string | null;
  customAmountCents?: number;
  percentageBasisPoints?: number;
}

export interface PaymentsRsvpSplitInput {
  eventId: string;
  requesterWalletId: string;
  totalCents: number;
  currency: CurrencyCode;
  method: PaymentsSplitMethod;
  attendees: PaymentsRsvpSplitAttendee[];
  memo: string;
}

export interface PaymentsRsvpSplitProjection {
  eventId: string;
  method: PaymentsSplitMethod;
  requests: PaymentsContextualRequestDraft[];
  statusSummary: {
    pending: number;
    paid: number;
    declined: number;
  };
}

function amountForAttendee(input: PaymentsRsvpSplitInput, attendee: PaymentsRsvpSplitAttendee): number {
  switch (input.method) {
    case 'custom':
      return attendee.customAmountCents ?? 0;
    case 'percentage':
      return Math.round(input.totalCents * ((attendee.percentageBasisPoints ?? 0) / 10_000));
    case 'equal':
      return Math.floor(input.totalCents / Math.max(input.attendees.length, 1));
  }
}

export function buildRsvpSplitRequests(
  input: PaymentsRsvpSplitInput,
): PaymentsRsvpSplitProjection {
  return {
    eventId: input.eventId,
    method: input.method,
    requests: input.attendees.map((attendee) => {
      const amountCents = amountForAttendee(input, attendee);
      const idempotencyKey = `pay_rsvp_${input.eventId}_${attendee.attendeeId}_${amountCents}`;
      return {
        idempotencyKey,
        contextId: input.eventId,
        payerWalletId: attendee.walletId,
        payerLabel: attendee.displayName,
        amountCents,
        currency: input.currency,
        memo: input.memo,
        command: {
          type: 'request',
          idempotencyKey,
          requesterWalletId: input.requesterWalletId,
          payerWalletId: attendee.walletId,
          amountCents,
          currency: input.currency,
          memo: input.memo,
          metadata: {
            context: 'rsvp',
            eventId: input.eventId,
            attendeeId: attendee.attendeeId,
          },
        },
      };
    }),
    statusSummary: {
      pending: input.attendees.length,
      paid: 0,
      declined: 0,
    },
  };
}
