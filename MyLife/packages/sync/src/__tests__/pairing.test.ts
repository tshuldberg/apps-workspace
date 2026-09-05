import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generatePairingCode,
  isValidPairingCode,
  createPairingSession,
  isPairingSessionExpired,
  PAIRING_CODE_TTL_MS,
} from '../signaling/pairing';

describe('pairing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generatePairingCode()', () => {
    it('returns a 6-digit string', () => {
      const code = generatePairingCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('pads short numbers with leading zeros', () => {
      // Mock crypto to return a small value
      vi.stubGlobal('crypto', {
        getRandomValues: (arr: Uint32Array) => {
          arr[0] = 42;
          return arr;
        },
      });

      const code = generatePairingCode();
      expect(code).toBe('000042');
    });
  });

  describe('isValidPairingCode()', () => {
    it('returns true for valid 6-digit codes', () => {
      expect(isValidPairingCode('000000')).toBe(true);
      expect(isValidPairingCode('123456')).toBe(true);
      expect(isValidPairingCode('999999')).toBe(true);
    });

    it('returns false for invalid codes', () => {
      expect(isValidPairingCode('')).toBe(false);
      expect(isValidPairingCode('12345')).toBe(false);
      expect(isValidPairingCode('1234567')).toBe(false);
      expect(isValidPairingCode('abcdef')).toBe(false);
      expect(isValidPairingCode('12-456')).toBe(false);
    });
  });

  describe('createPairingSession()', () => {
    it('creates a session with a valid code', () => {
      const session = createPairingSession('device-1');
      expect(isValidPairingCode(session.code)).toBe(true);
      expect(session.deviceId).toBe('device-1');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('expires after PAIRING_CODE_TTL_MS', () => {
      const session = createPairingSession('device-1');
      const diff = session.expiresAt.getTime() - session.createdAt.getTime();
      expect(diff).toBe(PAIRING_CODE_TTL_MS);
    });
  });

  describe('isPairingSessionExpired()', () => {
    it('returns false for a fresh session', () => {
      const session = createPairingSession('device-1');
      expect(isPairingSessionExpired(session)).toBe(false);
    });

    it('returns true when now is past expiresAt', () => {
      const session = createPairingSession('device-1');
      const futureDate = new Date(session.expiresAt.getTime() + 1000);
      expect(isPairingSessionExpired(session, futureDate)).toBe(true);
    });

    it('returns true when now equals expiresAt', () => {
      const session = createPairingSession('device-1');
      expect(isPairingSessionExpired(session, session.expiresAt)).toBe(true);
    });
  });
});
