import { describe, it, expect } from 'vitest';
import { createToastAdapter, createRateLimiter, TOAST_RATE_LIMIT } from '../src/adapters/toast';
import type { ReservationPosAdapter } from '../src/types';

describe('toast adapter', () => {
  const adapter = createToastAdapter({
    clientId: 'test-client',
    clientSecret: 'test-secret',
    restaurantGuid: 'test-guid',
    environment: 'sandbox',
  });

  it('returns an object implementing ReservationPosAdapter', () => {
    const typed: ReservationPosAdapter = adapter;
    expect(typed.provider).toBe('toast');
  });

  it('has all interface methods as functions', () => {
    expect(typeof adapter.getAvailability).toBe('function');
    expect(typeof adapter.createReservation).toBe('function');
    expect(typeof adapter.updateReservation).toBe('function');
    expect(typeof adapter.markSeated).toBe('function');
    expect(typeof adapter.cancel).toBe('function');
  });
});

describe('toast rate limiter', () => {
  it('canMakeRequest is true initially', () => {
    const limiter = createRateLimiter(5);
    expect(limiter.canMakeRequest()).toBe(true);
  });

  it('getRemaining decrements after recordRequest', () => {
    const limiter = createRateLimiter(5);
    expect(limiter.getRemaining()).toBe(5);
    limiter.recordRequest();
    expect(limiter.getRemaining()).toBe(4);
    limiter.recordRequest();
    expect(limiter.getRemaining()).toBe(3);
  });

  it('blocks after limit reached', () => {
    const limiter = createRateLimiter(2);
    limiter.recordRequest();
    limiter.recordRequest();
    expect(limiter.canMakeRequest()).toBe(false);
    expect(limiter.getRemaining()).toBe(0);
  });

  it('TOAST_RATE_LIMIT is 1000', () => {
    expect(TOAST_RATE_LIMIT).toBe(1000);
  });
});
