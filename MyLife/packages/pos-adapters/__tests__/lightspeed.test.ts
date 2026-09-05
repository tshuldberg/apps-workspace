import { describe, it, expect } from 'vitest';
import { createLightspeedKAdapter } from '../src/adapters/lightspeed';
import type { ReservationPosAdapter } from '../src/types';

describe('lightspeed k adapter', () => {
  const adapter = createLightspeedKAdapter({
    accessToken: 'test-token',
    accountId: 'acc-1',
    locationId: 'loc-1',
    environment: 'sandbox',
  });

  it('returns an object implementing ReservationPosAdapter', () => {
    const typed: ReservationPosAdapter = adapter;
    expect(typed.provider).toBe('lightspeed_k');
  });

  it('all interface methods are functions', () => {
    expect(typeof adapter.getAvailability).toBe('function');
    expect(typeof adapter.createReservation).toBe('function');
    expect(typeof adapter.updateReservation).toBe('function');
    expect(typeof adapter.markSeated).toBe('function');
    expect(typeof adapter.cancel).toBe('function');
  });

  it('sets provider to lightspeed_k', () => {
    expect(adapter.provider).toBe('lightspeed_k');
  });
});
