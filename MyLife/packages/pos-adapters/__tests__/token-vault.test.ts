import { describe, it, expect } from 'vitest';
import { isTokenExpired, isTokenExpiringSoon, getTokenStatus } from '../src/token-vault';
import type { PosConnection } from '../src/types';

function makeConnection(tokenExpiresAt: string): PosConnection {
  return {
    id: '1',
    restaurantId: 'r1',
    provider: 'square',
    accountId: 'a1',
    locationId: 'l1',
    accessToken: 'tok',
    refreshToken: 'ref',
    tokenExpiresAt,
    scopes: ['APPOINTMENTS_READ'],
    status: 'active',
    lastSyncAt: null,
    syncError: null,
  };
}

describe('token-vault', () => {
  describe('isTokenExpired', () => {
    it('returns true for past expiry', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it('returns true when within buffer', () => {
      // Expires in 3 minutes, buffer is 5 minutes
      const soonDate = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      expect(isTokenExpired(soonDate, 5)).toBe(true);
    });

    it('returns false for future expiry beyond buffer', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(isTokenExpired(futureDate)).toBe(false);
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('returns true when within threshold', () => {
      // Expires in 20 minutes, threshold is 30
      const soonDate = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      expect(isTokenExpiringSoon(soonDate, 30)).toBe(true);
    });

    it('returns false when beyond threshold', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(isTokenExpiringSoon(futureDate, 30)).toBe(false);
    });
  });

  describe('getTokenStatus', () => {
    it('returns expired for past tokens', () => {
      const conn = makeConnection(new Date(Date.now() - 60000).toISOString());
      expect(getTokenStatus(conn)).toBe('expired');
    });

    it('returns expiring_soon for tokens expiring within 30 min', () => {
      const conn = makeConnection(new Date(Date.now() + 15 * 60 * 1000).toISOString());
      expect(getTokenStatus(conn)).toBe('expiring_soon');
    });

    it('returns valid for tokens with plenty of time', () => {
      const conn = makeConnection(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());
      expect(getTokenStatus(conn)).toBe('valid');
    });
  });
});
