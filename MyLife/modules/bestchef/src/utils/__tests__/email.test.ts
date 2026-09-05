import { describe, it, expect } from 'vitest';
import { isValidEmailShape } from '../email';

describe('isValidEmailShape', () => {
  it('accepts standard addresses', () => {
    expect(isValidEmailShape('chef@example.com')).toBe(true);
    expect(isValidEmailShape('a.b+tag@sub.example.io')).toBe(true);
  });

  it('rejects obvious garbage', () => {
    expect(isValidEmailShape('notanemail')).toBe(false);
    expect(isValidEmailShape('@example.com')).toBe(false);
    expect(isValidEmailShape('chef@')).toBe(false);
    expect(isValidEmailShape('chef@example')).toBe(false);
    expect(isValidEmailShape('chef @example.com')).toBe(false);
  });

  it('rejects empty / whitespace', () => {
    expect(isValidEmailShape('')).toBe(false);
    expect(isValidEmailShape('   ')).toBe(false);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isValidEmailShape('  chef@example.com  ')).toBe(true);
  });
});
