import { describe, expect, it } from 'vitest';
import { categorizeItem } from '../categorize';

describe('categorizeItem', () => {
  it('classifies produce items', () => {
    expect(categorizeItem('fresh basil')).toBe('produce');
    expect(categorizeItem('yellow onion')).toBe('produce');
  });

  it('classifies dairy items', () => {
    expect(categorizeItem('cheddar cheese')).toBe('dairy');
    expect(categorizeItem('eggs')).toBe('dairy');
  });

  it('classifies pantry items', () => {
    expect(categorizeItem('spaghetti')).toBe('pantry');
    expect(categorizeItem('olive oil')).toBe('pantry');
  });

  it('returns other for unknown items', () => {
    expect(categorizeItem('xanthan gum')).toBe('other');
  });
});
