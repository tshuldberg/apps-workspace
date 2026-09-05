/**
 * Tests for the vendored geohash encoder.
 *
 * Verifies against canonical reference values documented at
 * https://en.wikipedia.org/wiki/Geohash and reproducible via any
 * standard geohash library.
 */

import { describe, expect, it } from 'vitest';
import { encodeGeohash } from '../helpers';

describe('encodeGeohash', () => {
  it('encodes San Francisco (37.7749, -122.4194) to 9q8yyk8yt at precision 9', () => {
    expect(encodeGeohash(37.7749, -122.4194, 9)).toBe('9q8yyk8yt');
  });

  it('encodes London (51.5074, -0.1278) starting with gcpvj at precision 5', () => {
    expect(encodeGeohash(51.5074, -0.1278, 5)).toBe('gcpvj');
  });

  it('encodes London (51.5074, -0.1278) to gcpvj0duq at precision 9', () => {
    expect(encodeGeohash(51.5074, -0.1278, 9)).toBe('gcpvj0duq');
  });

  it('encodes NYC Times Square (40.7580, -73.9855) starting with dr5ru at precision 5', () => {
    expect(encodeGeohash(40.7580, -73.9855, 5)).toBe('dr5ru');
  });

  it('encodes the origin (0, 0) to s0000 at precision 5', () => {
    expect(encodeGeohash(0, 0, 5)).toBe('s0000');
  });

  it('defaults to precision 9', () => {
    const hash = encodeGeohash(37.7749, -122.4194);
    expect(hash).toHaveLength(9);
    expect(hash).toBe('9q8yyk8yt');
  });

  it('shorter precisions are strict prefixes of longer precisions', () => {
    const p5 = encodeGeohash(48.8584, 2.2945, 5);
    const p9 = encodeGeohash(48.8584, 2.2945, 9);
    expect(p9.startsWith(p5)).toBe(true);
  });

  it('rejects out-of-range latitude', () => {
    expect(() => encodeGeohash(91, 0, 5)).toThrow(/lat out of range/);
    expect(() => encodeGeohash(-91, 0, 5)).toThrow(/lat out of range/);
  });

  it('rejects out-of-range longitude', () => {
    expect(() => encodeGeohash(0, 181, 5)).toThrow(/lng out of range/);
    expect(() => encodeGeohash(0, -181, 5)).toThrow(/lng out of range/);
  });

  it('rejects non-positive precision', () => {
    expect(() => encodeGeohash(0, 0, 0)).toThrow(/precision/);
    expect(() => encodeGeohash(0, 0, -1)).toThrow(/precision/);
    expect(() => encodeGeohash(0, 0, 1.5)).toThrow(/precision/);
  });
});
