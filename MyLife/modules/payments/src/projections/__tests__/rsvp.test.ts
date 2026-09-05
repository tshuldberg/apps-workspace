import { describe, expect, it } from 'vitest';

import { buildRsvpSplitRequests } from '../rsvp';

describe('payments RSVP split projection', () => {
  it('creates attendee request commands with RSVP context', () => {
    const projection = buildRsvpSplitRequests({
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

    expect(projection.requests).toHaveLength(2);
    expect(projection.requests[0]?.command.metadata?.context).toBe('rsvp');
  });
});
