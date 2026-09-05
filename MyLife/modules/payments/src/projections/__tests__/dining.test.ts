import { describe, expect, it } from 'vitest';

import { buildDiningBillSplitRequests } from '../dining';

describe('payments Dining split projection', () => {
  it('keeps raw receipt images local and creates MyPay requests', () => {
    const projection = buildDiningBillSplitRequests({
      diningSessionId: 'dining_1',
      requesterWalletId: 'wallet_host',
      currency: 'USD',
      participants: [{ participantId: 'a', displayName: 'A', walletId: 'wallet_a' }],
      lineItems: [{ itemId: 'meal', label: 'Meal', amountCents: 1000, assignedParticipantIds: ['a'] }],
      taxCents: 80,
      tipCents: 200,
      rawReceiptImageLocalOnly: true,
    });

    expect(projection.rawReceiptStoredByMyPay).toBe(false);
    expect(projection.requests[0]?.command.metadata?.context).toBe('dining');
  });
});
