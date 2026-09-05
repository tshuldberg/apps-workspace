import { describe, it, expect } from 'vitest';
import { createCloverAdapter, CLOVER_MARKETPLACE_REV_SHARE } from '../src/adapters/clover';
import type { ReservationPosAdapter } from '../src/types';

describe('clover adapter', () => {
  const adapter = createCloverAdapter({
    accessToken: 'test-token',
    merchantId: 'merch-1',
    environment: 'sandbox',
  });

  it('returns an object implementing ReservationPosAdapter', () => {
    const typed: ReservationPosAdapter = adapter;
    expect(typed.provider).toBe('clover');
  });

  it('all interface methods are functions', () => {
    expect(typeof adapter.getAvailability).toBe('function');
    expect(typeof adapter.createReservation).toBe('function');
    expect(typeof adapter.updateReservation).toBe('function');
    expect(typeof adapter.markSeated).toBe('function');
    expect(typeof adapter.cancel).toBe('function');
  });

  it('CLOVER_MARKETPLACE_REV_SHARE is 0.30', () => {
    expect(CLOVER_MARKETPLACE_REV_SHARE).toBe(0.30);
  });
});
