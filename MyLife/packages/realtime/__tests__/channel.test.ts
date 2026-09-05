import { describe, it, expect } from 'vitest';
import { getReconnectDelay } from '../src/channel';

describe('getReconnectDelay', () => {
  it('uses exponential backoff', () => {
    expect(getReconnectDelay(0)).toBe(1000);
    expect(getReconnectDelay(1)).toBe(2000);
    expect(getReconnectDelay(2)).toBe(4000);
    expect(getReconnectDelay(3)).toBe(8000);
    expect(getReconnectDelay(4)).toBe(16000);
  });

  it('caps at 30 seconds', () => {
    expect(getReconnectDelay(10)).toBe(30000);
    expect(getReconnectDelay(20)).toBe(30000);
  });

  it('respects custom base delay', () => {
    expect(getReconnectDelay(0, 500)).toBe(500);
    expect(getReconnectDelay(1, 500)).toBe(1000);
    expect(getReconnectDelay(2, 500)).toBe(2000);
  });
});
