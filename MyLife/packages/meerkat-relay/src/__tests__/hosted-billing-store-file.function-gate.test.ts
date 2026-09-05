import { describe, expect, it } from 'vitest';
import { shouldApplyProviderEvent } from '../hosted-billing-store-file';

describe('billing event ordering function gate', () => {
  it('does not let an older grant replace a newer denial', () => {
    expect(shouldApplyProviderEvent({
      currentEventId: 'new-refund',
      currentEventAt: '2026-07-09T12:00:02.000Z',
      incomingEventId: 'old-purchase',
      incomingEventAt: '2026-07-09T12:00:01.000Z',
      incomingMoreRestrictive: false,
      currentMoreRestrictive: true,
    })).toBe('stale');
  });
});
