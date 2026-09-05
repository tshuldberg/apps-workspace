import { describe, expect, it } from 'vitest';

import { projectMyPayEventToBudget } from '../budget';
import { buildDiningBillSplitRequests } from '../dining';
import { buildMarketMyPayCheckoutState } from '../market';
import { buildRsvpSplitRequests } from '../rsvp';

describe('payments cross-module projections', () => {
  it('projects Budget, Market, RSVP, and Dining without moving authority out of MyPay', () => {
    const budget = projectMyPayEventToBudget({
      eventId: 'event_1',
      transferId: 'transfer_1',
      eventType: 'completed',
      transferKind: 'card_capture',
      status: 'completed',
      amountCents: 1000,
      feeCents: 0,
      currency: 'USD',
      occurredAt: '2026-04-24T16:00:00.000Z',
      direction: 'outgoing',
      counterpartyLabel: 'Market',
      deepLink: '/payments/transfer_1',
    });
    const market = buildMarketMyPayCheckoutState({
      orderId: 'order_1',
      listingId: 'listing_1',
      buyerWalletId: 'wallet_buyer',
      sellerWalletId: 'wallet_seller',
      amountCents: 5000,
      currency: 'USD',
      escrowTransferId: 'escrow_1',
      deepLink: '/payments/escrow_1',
    });
    const rsvp = buildRsvpSplitRequests({
      eventId: 'event_1',
      requesterWalletId: 'wallet_host',
      totalCents: 2000,
      currency: 'USD',
      method: 'equal',
      memo: 'Event split',
      attendees: [
        { attendeeId: 'a', displayName: 'A', walletId: 'wallet_a' },
        { attendeeId: 'b', displayName: 'B', walletId: 'wallet_b' },
      ],
    });
    const dining = buildDiningBillSplitRequests({
      diningSessionId: 'dining_1',
      requesterWalletId: 'wallet_host',
      currency: 'USD',
      participants: [{ participantId: 'a', displayName: 'A', walletId: 'wallet_a' }],
      lineItems: [{ itemId: 'meal', label: 'Meal', amountCents: 1000, assignedParticipantIds: ['a'] }],
      taxCents: 80,
      tipCents: 200,
      rawReceiptImageLocalOnly: true,
    });

    expect(budget?.sourceBadge.label).toBe('MyPay');
    expect(market.marketOwnsFinancialTruth).toBe(false);
    expect(rsvp.requests).toHaveLength(2);
    expect(dining.rawReceiptStoredByMyPay).toBe(false);
  });
});
