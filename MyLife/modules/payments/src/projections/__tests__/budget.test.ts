import { describe, expect, it } from 'vitest';

import { projectMyPayEventToBudget } from '../budget';

describe('payments budget projection', () => {
  it('projects confirmed MyPay events with a source badge', () => {
    const row = projectMyPayEventToBudget({
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

    expect(row?.sourceBadge.label).toBe('MyPay');
    expect(row?.category).toBe('card_purchase');
  });
});
