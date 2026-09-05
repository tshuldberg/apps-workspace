import { describe, expect, it } from 'vitest';

import { buildPaymentsAvailabilityViewModel } from '../availability';

describe('payments availability view model', () => {
  it('can disable risky actions while keeping history readable', () => {
    const state = buildPaymentsAvailabilityViewModel({
      checks: [
        { capability: 'send', health: 'disabled', reason: 'Provider outage' },
        { capability: 'funding', health: 'operational', reason: null },
      ],
    });

    expect(state.actions.send.enabled).toBe(false);
    expect(state.actions.funding.enabled).toBe(true);
    expect(state.banner?.tone).toBe('danger');
  });
});
