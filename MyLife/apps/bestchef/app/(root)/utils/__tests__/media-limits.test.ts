import { describe, expect, it } from 'vitest';
import {
  assertVideoWithinLimits,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  MAX_VIDEO_SIZE_MB,
  videoDurationSecondsFromMs,
} from '../media-limits';

describe('video limits (audit M7)', () => {
  it('caps the byte limit at 150 MB, matching the server bucket cap', () => {
    expect(MAX_VIDEO_BYTES).toBe(150 * 1024 * 1024);
    expect(MAX_VIDEO_SIZE_MB).toBe(150);
  });

  it('accepts a video within both caps', () => {
    expect(() =>
      assertVideoWithinLimits({ duration: 60_000, fileSize: 10 * 1024 * 1024 }),
    ).not.toThrow();
  });

  it('rejects a video over the byte cap with the honest 150 MB copy (not 200)', () => {
    expect(() =>
      assertVideoWithinLimits({ fileSize: MAX_VIDEO_BYTES + 1 }),
    ).toThrow('Video too large. Max 150 MB.');
  });

  it('rejects a 151-200MB clip that used to slip past the old 200 MB copy', () => {
    // 180 MB: passed the old "Max 200 MB" copy, then hard-failed at the byte
    // gate. Now it fails pre-validation with honest copy.
    expect(() =>
      assertVideoWithinLimits({ fileSize: 180 * 1024 * 1024 }),
    ).toThrow(/150 MB/);
  });

  it('rejects a video over the duration cap', () => {
    expect(() =>
      assertVideoWithinLimits({ duration: MAX_VIDEO_DURATION_MS + 1 }),
    ).toThrow('Video too long. Please pick a video under 2 minutes.');
  });

  it('interpolates the max through a translate function', () => {
    const t = (key: string, values?: Record<string, string | number>) =>
      values ? `[${key}|${JSON.stringify(values)}]` : `[${key}]`;
    expect(() => assertVideoWithinLimits({ fileSize: MAX_VIDEO_BYTES + 1 }, t)).toThrow(
      '[Video too large. Max {max} MB.|{"max":150}]',
    );
  });
});

describe('videoDurationSecondsFromMs (review LOW-1: picker duration is always ms)', () => {
  it('converts a sub-1-second clip from ms to seconds (was becoming 900s)', () => {
    // 900ms clip: the old magnitude guess left it as 900 (seconds) -> a
    // 15-minute feed card. It must be 0.9s.
    expect(videoDurationSecondsFromMs(900)).toBe(0.9);
  });

  it('converts a normal clip from ms to seconds', () => {
    expect(videoDurationSecondsFromMs(42_000)).toBe(42);
    expect(videoDurationSecondsFromMs(1_000)).toBe(1);
  });

  it('returns undefined for missing or non-finite input', () => {
    expect(videoDurationSecondsFromMs(undefined)).toBeUndefined();
    expect(videoDurationSecondsFromMs(null)).toBeUndefined();
    expect(videoDurationSecondsFromMs(Number.NaN)).toBeUndefined();
  });

  it('treats 0 as a real value (0 seconds), not undefined', () => {
    // A magnitude guard that keyed off truthiness dropped 0; the ms
    // conversion keeps it.
    expect(videoDurationSecondsFromMs(0)).toBe(0);
  });
});
