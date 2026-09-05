import { describe, expect, it } from 'vitest';

import {
  buildPaymentHandleSearchKey,
  isReservedPaymentHandle,
  normalizePaymentHandle,
  reservePaymentHandle,
} from '../index';

describe('payments compliance handles', () => {
  it('normalizes handles into a stable searchable key', () => {
    expect(normalizePaymentHandle(' @Alice.Test-1 ')).toBe('alice.test-1');
    expect(buildPaymentHandleSearchKey('Alice.Test-1')).toBe('@alice.test-1');
  });

  it('blocks reserved handles and global collisions', () => {
    expect(isReservedPaymentHandle('support')).toBe(true);

    const taken = reservePaymentHandle({
      requestedHandle: '@alice',
      ownerUserId: 'owner_2',
      existing: [
        {
          ownerUserId: 'owner_1',
          handle: 'alice',
        },
      ],
    });

    expect(taken.ok).toBe(false);
    expect(taken.decision).toBe('taken');
    expect(taken.ownerUserId).toBe('owner_1');
  });

  it('treats an existing self-owned handle as already owned', () => {
    const result = reservePaymentHandle({
      requestedHandle: '@alice',
      ownerUserId: 'owner_1',
      existing: [
        {
          ownerUserId: 'owner_1',
          handle: 'alice',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.decision).toBe('already_owned');
    expect(result.normalizedHandle).toBe('alice');
  });
});
