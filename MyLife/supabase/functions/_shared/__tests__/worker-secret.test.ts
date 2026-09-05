import { describe, expect, it } from 'vitest';
import { timingSafeEqual } from '../worker-secret';

describe('timingSafeEqual', () => {
  it('returns true for equal strings', async () => {
    expect(await timingSafeEqual('super-secret-value', 'super-secret-value')).toBe(true);
  });

  it('returns false for unequal strings of the same length', async () => {
    expect(await timingSafeEqual('super-secret-valuE', 'super-secret-value')).toBe(false);
  });

  it('returns false for different-length inputs', async () => {
    expect(await timingSafeEqual('short', 'a-much-longer-secret-value')).toBe(false);
    expect(await timingSafeEqual('a-much-longer-secret-value', 'short')).toBe(false);
  });

  it('returns false when either side is null or undefined', async () => {
    expect(await timingSafeEqual(null, 'secret')).toBe(false);
    expect(await timingSafeEqual('secret', null)).toBe(false);
    expect(await timingSafeEqual(undefined, 'secret')).toBe(false);
    expect(await timingSafeEqual(undefined, undefined)).toBe(false);
  });

  it('returns false for an empty string against a non-empty secret', async () => {
    expect(await timingSafeEqual('', 'secret')).toBe(false);
  });

  it('is case-sensitive', async () => {
    expect(await timingSafeEqual('Secret', 'secret')).toBe(false);
  });
});
