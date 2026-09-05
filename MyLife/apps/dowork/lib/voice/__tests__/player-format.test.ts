import { describe, expect, it } from 'vitest';
import {
  clampTime,
  formatClock,
  formatRemaining,
  resolveSeekDelta,
  transcriptNamesDuration,
} from '../player-format';

describe('player-format: clampTime', () => {
  it('keeps a value inside the window', () => {
    expect(clampTime(30, 120)).toBe(30);
  });
  it('clamps past the duration', () => {
    expect(clampTime(130, 120)).toBe(120);
  });
  it('clamps below zero', () => {
    expect(clampTime(-5, 120)).toBe(0);
  });
  it('only applies the lower bound when duration is unknown', () => {
    expect(clampTime(500, 0)).toBe(500);
    expect(clampTime(-5, 0)).toBe(0);
  });
});

describe('player-format: formatClock / formatRemaining', () => {
  it('formats m:ss', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(0)).toBe('0:00');
  });
  it('collapses negative and non-finite to 0:00', () => {
    expect(formatClock(-10)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
  it('formats remaining time', () => {
    expect(formatRemaining(10, 70)).toBe('1:00');
    expect(formatRemaining(0, 0)).toBe('0:00');
  });
});

describe('player-format: transcriptNamesDuration', () => {
  it('is false for bare seeks', () => {
    expect(transcriptNamesDuration('go back')).toBe(false);
    expect(transcriptNamesDuration('skip ahead')).toBe(false);
  });
  it('is true when a number is named', () => {
    expect(transcriptNamesDuration('go back 15')).toBe(true);
    expect(transcriptNamesDuration('back up thirty seconds')).toBe(true);
    expect(transcriptNamesDuration('forward one minute')).toBe(true);
    expect(transcriptNamesDuration('half a minute')).toBe(true);
  });
});

describe('player-format: resolveSeekDelta', () => {
  it('overrides a bare seek with the settings length, preserving sign', () => {
    expect(resolveSeekDelta(-10, 'go back', 30)).toBe(-30);
    expect(resolveSeekDelta(10, 'skip ahead', 5)).toBe(5);
  });
  it('keeps an explicitly spoken duration', () => {
    expect(resolveSeekDelta(-15, 'go back 15', 30)).toBe(-15);
    expect(resolveSeekDelta(60, 'forward one minute', 5)).toBe(60);
  });
});
