// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import { consumeToken, getRateLimitKey, _resetBuckets } from '../rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    _resetBuckets();
  });

  describe('consumeToken', () => {
    it('allows requests within capacity', () => {
      const config = { capacity: 3, refillRate: 3, refillIntervalMs: 60_000 };
      expect(consumeToken('test-ip', config)).toBe(true);
      expect(consumeToken('test-ip', config)).toBe(true);
      expect(consumeToken('test-ip', config)).toBe(true);
    });

    it('blocks requests beyond capacity', () => {
      const config = { capacity: 2, refillRate: 2, refillIntervalMs: 60_000 };
      expect(consumeToken('test-ip', config)).toBe(true);
      expect(consumeToken('test-ip', config)).toBe(true);
      expect(consumeToken('test-ip', config)).toBe(false);
    });

    it('tracks keys independently', () => {
      const config = { capacity: 1, refillRate: 1, refillIntervalMs: 60_000 };
      expect(consumeToken('ip-a', config)).toBe(true);
      expect(consumeToken('ip-b', config)).toBe(true);
      expect(consumeToken('ip-a', config)).toBe(false);
      expect(consumeToken('ip-b', config)).toBe(false);
    });
  });

  describe('getRateLimitKey', () => {
    it('extracts first IP from x-forwarded-for', () => {
      const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
      expect(getRateLimitKey(headers)).toBe('1.2.3.4');
    });

    it('falls back to x-real-ip', () => {
      const headers = new Headers({ 'x-real-ip': '9.8.7.6' });
      expect(getRateLimitKey(headers)).toBe('9.8.7.6');
    });

    it('returns unknown when no IP headers present', () => {
      const headers = new Headers();
      expect(getRateLimitKey(headers)).toBe('unknown');
    });
  });
});
