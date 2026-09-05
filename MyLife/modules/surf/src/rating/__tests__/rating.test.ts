import { describe, it, expect } from 'vitest';
import { computeSpotRating, starsToColor } from '../rating';
import type { SpotProfile, ForecastInput } from '../../types';

// ── Helpers ──

function makeSpot(overrides?: Partial<SpotProfile>): SpotProfile {
  return {
    orientationDegrees: 270, // west-facing beach
    spotType: 'beach',
    idealSwellDirMin: 250,
    idealSwellDirMax: 310,
    idealTideLow: 1.0,
    idealTideHigh: 4.0,
    ...overrides,
  };
}

function makeForecast(overrides?: Partial<ForecastInput>): ForecastInput {
  return {
    swellComponents: [
      { heightFt: 4, periodSeconds: 14, directionDegrees: 280 },
    ],
    windSpeedKts: 3,
    windDirectionDegrees: 90, // offshore for a west-facing beach
    tideHeightFt: 3.0,
    consistency: 0.8,
    ...overrides,
  };
}

// ── starsToColor ──

describe('starsToColor', () => {
  it('maps 1 to red', () => {
    expect(starsToColor(1)).toBe('red');
  });

  it('maps 2 to orange', () => {
    expect(starsToColor(2)).toBe('orange');
  });

  it('maps 3 to yellow', () => {
    expect(starsToColor(3)).toBe('yellow');
  });

  it('maps 4 to green', () => {
    expect(starsToColor(4)).toBe('green');
  });

  it('maps 5 to teal', () => {
    expect(starsToColor(5)).toBe('teal');
  });

  it('clamps values below 1 to red', () => {
    expect(starsToColor(0)).toBe('red');
    expect(starsToColor(-5)).toBe('red');
  });

  it('clamps values above 5 to teal', () => {
    expect(starsToColor(6)).toBe('teal');
    expect(starsToColor(99)).toBe('teal');
  });
});

// ── computeSpotRating ──

describe('computeSpotRating', () => {
  // ── Flat day ──

  it('returns 1 star / red for a flat day (no swell)', () => {
    const result = computeSpotRating(makeSpot(), makeForecast({ swellComponents: [] }));
    expect(result.stars).toBe(1);
    expect(result.color).toBe('red');
    expect(result.swellScore).toBe(0);
  });

  it('returns a low rating for a single tiny swell (0.3ft)', () => {
    const result = computeSpotRating(
      makeSpot(),
      makeForecast({
        swellComponents: [{ heightFt: 0.3, periodSeconds: 6, directionDegrees: 280 }],
        consistency: 0.2,
      }),
    );
    // Tiny swell with poor consistency scores low but wind/tide still contribute
    expect(result.stars).toBeLessThanOrEqual(2);
    expect(result.swellScore).toBeLessThan(0.3);
  });

  // ── Solid conditions ──

  it('rates solid swell + offshore wind at 4-5 stars / green or teal', () => {
    const result = computeSpotRating(
      makeSpot(),
      makeForecast({
        swellComponents: [{ heightFt: 5, periodSeconds: 16, directionDegrees: 280 }],
        windSpeedKts: 2,
        windDirectionDegrees: 90, // offshore
        tideHeightFt: 2.5,
        consistency: 0.95,
      }),
    );
    expect(result.stars).toBeGreaterThanOrEqual(4);
    expect(['green', 'teal']).toContain(result.color);
  });

  // ── Wind effects ──

  it('cross-shore wind produces a lower rating than offshore', () => {
    const spot = makeSpot();
    const base = makeForecast({
      swellComponents: [{ heightFt: 4, periodSeconds: 14, directionDegrees: 280 }],
      consistency: 0.8,
      tideHeightFt: 2.5,
    });

    const offshore = computeSpotRating(spot, {
      ...base,
      windSpeedKts: 10,
      windDirectionDegrees: 90, // offshore for west-facing
    });

    const crossshore = computeSpotRating(spot, {
      ...base,
      windSpeedKts: 10,
      windDirectionDegrees: 0, // cross-shore
    });

    expect(offshore.windScore).toBeGreaterThan(crossshore.windScore);
    expect(offshore.stars).toBeGreaterThanOrEqual(crossshore.stars);
  });

  it('strong onshore wind gives a poor score', () => {
    const result = computeSpotRating(
      makeSpot(),
      makeForecast({
        swellComponents: [{ heightFt: 4, periodSeconds: 12, directionDegrees: 280 }],
        windSpeedKts: 25,
        windDirectionDegrees: 270, // direct onshore for west-facing
        tideHeightFt: 3.0,
        consistency: 0.7,
      }),
    );
    expect(result.windScore).toBeLessThan(0.15);
    // Wind cap should limit even good swell
    expect(result.stars).toBeLessThanOrEqual(2);
  });

  // ── Tide sensitivity by break type ──

  it('reef break is more tide-sensitive than beach break', () => {
    const forecast = makeForecast({
      swellComponents: [{ heightFt: 4, periodSeconds: 14, directionDegrees: 280 }],
      windSpeedKts: 3,
      windDirectionDegrees: 90,
      tideHeightFt: -1.0, // extreme low tide
      consistency: 0.8,
    });

    const reefResult = computeSpotRating(makeSpot({ spotType: 'reef' }), forecast);
    const beachResult = computeSpotRating(makeSpot({ spotType: 'beach' }), forecast);

    expect(reefResult.tideScore).toBeLessThan(beachResult.tideScore);
  });

  // ── Edge cases ──

  it('handles 0 consistency without errors', () => {
    const result = computeSpotRating(makeSpot(), makeForecast({ consistency: 0 }));
    expect(result.consistencyScore).toBe(0);
    expect(result.stars).toBeGreaterThanOrEqual(1);
    expect(result.stars).toBeLessThanOrEqual(5);
  });

  it('handles consistency above 1 by clamping to 1', () => {
    const result = computeSpotRating(makeSpot(), makeForecast({ consistency: 1.5 }));
    expect(result.consistencyScore).toBe(1.0);
  });

  it('handles negative consistency by clamping to 0', () => {
    const result = computeSpotRating(makeSpot(), makeForecast({ consistency: -0.5 }));
    expect(result.consistencyScore).toBe(0);
  });

  it('handles very large swell (max swell)', () => {
    const result = computeSpotRating(
      makeSpot(),
      makeForecast({
        swellComponents: [{ heightFt: 20, periodSeconds: 20, directionDegrees: 280 }],
        windSpeedKts: 2,
        windDirectionDegrees: 90,
        consistency: 1.0,
        tideHeightFt: 2.5,
      }),
    );
    expect(result.stars).toBeGreaterThanOrEqual(1);
    expect(result.stars).toBeLessThanOrEqual(5);
    // Very large swell has a slight size penalty
    expect(result.swellScore).toBeLessThan(1.0);
  });

  // ── Result structure ──

  it('returns all expected fields in the result', () => {
    const result = computeSpotRating(makeSpot(), makeForecast());
    expect(result).toHaveProperty('stars');
    expect(result).toHaveProperty('color');
    expect(result).toHaveProperty('swellScore');
    expect(result).toHaveProperty('windScore');
    expect(result).toHaveProperty('tideScore');
    expect(result).toHaveProperty('consistencyScore');
  });

  it('stars are always between 1 and 5', () => {
    const scenarios: ForecastInput[] = [
      makeForecast({ swellComponents: [] }),
      makeForecast({ consistency: 0 }),
      makeForecast({
        swellComponents: [{ heightFt: 6, periodSeconds: 18, directionDegrees: 280 }],
        windSpeedKts: 0,
        consistency: 1.0,
      }),
    ];

    for (const fc of scenarios) {
      const result = computeSpotRating(makeSpot(), fc);
      expect(result.stars).toBeGreaterThanOrEqual(1);
      expect(result.stars).toBeLessThanOrEqual(5);
    }
  });

  // ── Multi-component swell ──

  it('handles multiple swell components', () => {
    const result = computeSpotRating(
      makeSpot(),
      makeForecast({
        swellComponents: [
          { heightFt: 4, periodSeconds: 14, directionDegrees: 280 },
          { heightFt: 2, periodSeconds: 10, directionDegrees: 300 },
          { heightFt: 1, periodSeconds: 8, directionDegrees: 200 },
        ],
      }),
    );
    expect(result.swellScore).toBeGreaterThan(0);
    expect(result.stars).toBeGreaterThanOrEqual(1);
  });

  it('point breaks get a swell refraction bonus', () => {
    const forecast = makeForecast({
      swellComponents: [{ heightFt: 4, periodSeconds: 14, directionDegrees: 280 }],
      windSpeedKts: 3,
      windDirectionDegrees: 90,
      tideHeightFt: 2.5,
      consistency: 0.8,
    });

    const pointResult = computeSpotRating(makeSpot({ spotType: 'point' }), forecast);
    const beachResult = computeSpotRating(makeSpot({ spotType: 'beach' }), forecast);

    expect(pointResult.swellScore).toBeGreaterThan(beachResult.swellScore);
  });
});
