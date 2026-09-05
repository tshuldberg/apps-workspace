import { describe, it, expect } from 'vitest';
import { angleDifference, degreesToCompass, computeDirectionFit } from '../directions';

describe('angleDifference', () => {
  it('returns 0 for identical angles', () => {
    expect(angleDifference(90, 90)).toBe(0);
  });

  it('returns 0 for 0 and 360 (wrap-around)', () => {
    expect(angleDifference(0, 360)).toBe(0);
  });

  it('returns 20 for 10 and 350 (shortest path across 0)', () => {
    expect(angleDifference(10, 350)).toBe(20);
  });

  it('returns 180 for opposite directions', () => {
    expect(angleDifference(0, 180)).toBe(180);
    expect(angleDifference(90, 270)).toBe(180);
  });

  it('is commutative', () => {
    expect(angleDifference(30, 100)).toBe(angleDifference(100, 30));
  });

  it('always returns between 0 and 180', () => {
    const cases = [
      [0, 0],
      [0, 90],
      [0, 180],
      [0, 270],
      [0, 360],
      [45, 315],
      [10, 350],
      [179, 1],
    ];
    for (const [a, b] of cases) {
      const diff = angleDifference(a!, b!);
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(180);
    }
  });

  it('handles negative angles via modulo', () => {
    expect(angleDifference(-10, 10)).toBe(20);
  });

  it('handles angles > 360', () => {
    expect(angleDifference(370, 10)).toBe(0);
    expect(angleDifference(720, 0)).toBe(0);
  });
});

describe('degreesToCompass', () => {
  it('converts 0 to N', () => {
    expect(degreesToCompass(0)).toBe('N');
  });

  it('converts 90 to E', () => {
    expect(degreesToCompass(90)).toBe('E');
  });

  it('converts 180 to S', () => {
    expect(degreesToCompass(180)).toBe('S');
  });

  it('converts 270 to W', () => {
    expect(degreesToCompass(270)).toBe('W');
  });

  it('converts 360 to N', () => {
    expect(degreesToCompass(360)).toBe('N');
  });

  it('converts 45 to NE', () => {
    expect(degreesToCompass(45)).toBe('NE');
  });

  it('converts 135 to SE', () => {
    expect(degreesToCompass(135)).toBe('SE');
  });

  it('converts 225 to SW', () => {
    expect(degreesToCompass(225)).toBe('SW');
  });

  it('converts 315 to NW', () => {
    expect(degreesToCompass(315)).toBe('NW');
  });

  it('converts 290 to WNW', () => {
    expect(degreesToCompass(290)).toBe('WNW');
  });

  it('converts 22.5 to NNE', () => {
    expect(degreesToCompass(22.5)).toBe('NNE');
  });

  it('handles negative values via modulo', () => {
    expect(degreesToCompass(-90)).toBe('W');
  });

  it('handles values > 360 via modulo', () => {
    expect(degreesToCompass(450)).toBe('E');
  });
});

describe('computeDirectionFit', () => {
  const ORIENTATION = 270; // west-facing

  // ── Inside ideal window ──

  it('returns 1.0 when swell is within the ideal window', () => {
    expect(computeDirectionFit(280, 250, 310, ORIENTATION)).toBe(1.0);
    expect(computeDirectionFit(250, 250, 310, ORIENTATION)).toBe(1.0);
    expect(computeDirectionFit(310, 250, 310, ORIENTATION)).toBe(1.0);
  });

  // ── Wrap-around window ──

  it('handles wrap-around ideal windows (e.g., min=330, max=30)', () => {
    expect(computeDirectionFit(350, 330, 30, ORIENTATION)).toBe(1.0);
    expect(computeDirectionFit(10, 330, 30, ORIENTATION)).toBe(1.0);
    expect(computeDirectionFit(0, 330, 30, ORIENTATION)).toBe(1.0);
  });

  // ── Gradual falloff outside window ──

  it('returns 0.85 for directions within 15 deg of window edge', () => {
    // Ideal window 250-310, swell at 320 (10 degrees from max edge 310)
    expect(computeDirectionFit(320, 250, 310, ORIENTATION)).toBe(0.85);
  });

  it('returns 0.6 for directions within 30 deg of window edge', () => {
    // Swell at 335 (25 degrees from max edge 310)
    expect(computeDirectionFit(335, 250, 310, ORIENTATION)).toBe(0.6);
  });

  it('returns 0.3 for directions within 60 deg of window edge', () => {
    // Swell at 355 (45 degrees from max edge 310)
    expect(computeDirectionFit(355, 250, 310, ORIENTATION)).toBe(0.3);
  });

  it('returns 0.05 for directions far outside the window', () => {
    // Swell at 100 (far from ideal window 250-310)
    expect(computeDirectionFit(100, 250, 310, ORIENTATION)).toBe(0.05);
  });

  // ── Narrow window ──

  it('works with a narrow ideal window', () => {
    expect(computeDirectionFit(280, 275, 285, ORIENTATION)).toBe(1.0);
    expect(computeDirectionFit(270, 275, 285, ORIENTATION)).toBe(0.85);
  });

  // ── Full circle window ──

  it('returns 1.0 for a full circle window (min=0, max=360)', () => {
    expect(computeDirectionFit(45, 0, 360, ORIENTATION)).toBe(1.0);
    expect(computeDirectionFit(180, 0, 360, ORIENTATION)).toBe(1.0);
  });
});
