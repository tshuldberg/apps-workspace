import { describe, it, expect } from 'vitest';
import { createSquareAdapter } from '../src/adapters/square';
import type { ReservationPosAdapter } from '../src/types';

describe('square adapter', () => {
  const adapter = createSquareAdapter({
    accessToken: 'test-token',
    locationId: 'loc-1',
    environment: 'sandbox',
  });

  it('returns an object implementing ReservationPosAdapter', () => {
    const typed: ReservationPosAdapter = adapter;
    expect(typed.provider).toBe('square');
  });

  it('has getAvailability method', () => {
    expect(typeof adapter.getAvailability).toBe('function');
  });

  it('has createReservation method', () => {
    expect(typeof adapter.createReservation).toBe('function');
  });

  it('has updateReservation method', () => {
    expect(typeof adapter.updateReservation).toBe('function');
  });

  it('has markSeated method', () => {
    expect(typeof adapter.markSeated).toBe('function');
  });

  it('has cancel method', () => {
    expect(typeof adapter.cancel).toBe('function');
  });

  it('sets provider to square', () => {
    expect(adapter.provider).toBe('square');
  });
});
