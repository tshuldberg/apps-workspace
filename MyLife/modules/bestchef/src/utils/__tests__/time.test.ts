import { describe, it, expect } from 'vitest';
import { formatDuration } from '../time';

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(15)).toBe('15 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats exact hours', () => {
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(120)).toBe('2 hrs');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(formatDuration(145)).toBe('2 hrs 25 min');
  });

  it('handles null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('');
  });
});
