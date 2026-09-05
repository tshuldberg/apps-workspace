import { describe, it, expect } from 'vitest';
import { formatQuantity, toFraction } from '../fractions';

describe('toFraction', () => {
  it('converts 0.5 to 1/2', () => {
    expect(toFraction(0.5)).toBe('1/2');
  });

  it('converts 0.25 to 1/4', () => {
    expect(toFraction(0.25)).toBe('1/4');
  });

  it('converts 0.75 to 3/4', () => {
    expect(toFraction(0.75)).toBe('3/4');
  });

  it('converts 0.333 to 1/3', () => {
    expect(toFraction(1 / 3)).toBe('1/3');
  });

  it('converts 0.667 to 2/3', () => {
    expect(toFraction(2 / 3)).toBe('2/3');
  });

  it('converts 0.125 to 1/8', () => {
    expect(toFraction(0.125)).toBe('1/8');
  });

  it('returns null for non-standard fractions', () => {
    expect(toFraction(0.3)).toBeNull();
    expect(toFraction(0.7)).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('formats whole numbers', () => {
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(10)).toBe('10');
  });

  it('formats simple fractions', () => {
    expect(formatQuantity(0.5)).toBe('1/2');
    expect(formatQuantity(0.25)).toBe('1/4');
    expect(formatQuantity(0.75)).toBe('3/4');
  });

  it('formats mixed numbers', () => {
    expect(formatQuantity(1.5)).toBe('1 1/2');
    expect(formatQuantity(2.75)).toBe('2 3/4');
    expect(formatQuantity(1.25)).toBe('1 1/4');
  });

  it('formats null as empty string', () => {
    expect(formatQuantity(null)).toBe('');
  });

  it('formats zero', () => {
    expect(formatQuantity(0)).toBe('0');
  });

  it('falls back to decimal for non-standard fractions', () => {
    expect(formatQuantity(3.14)).toBe('3.14');
  });
});
