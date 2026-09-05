import { describe, it, expect } from 'vitest';
import { createOmnivoreAdapter } from '../src/adapters/omnivore';
import type { ReservationPosAdapter } from '../src/types';

describe('omnivore adapter', () => {
  const adapter = createOmnivoreAdapter({
    apiKey: 'test-key',
    locationId: 'loc-1',
    environment: 'sandbox',
  });

  it('returns an object implementing ReservationPosAdapter', () => {
    const typed: ReservationPosAdapter = adapter;
    expect(typed.provider).toBe('omnivore');
  });

  it('all interface methods are functions', () => {
    expect(typeof adapter.getAvailability).toBe('function');
    expect(typeof adapter.createReservation).toBe('function');
    expect(typeof adapter.updateReservation).toBe('function');
    expect(typeof adapter.markSeated).toBe('function');
    expect(typeof adapter.cancel).toBe('function');
  });

  it('provider is omnivore', () => {
    expect(adapter.provider).toBe('omnivore');
  });
});
