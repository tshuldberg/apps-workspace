import { describe, it, expect } from 'vitest';
import {
  deviationDistance,
  effectiveThreshold,
  DeviationStateMachine,
} from '../engine/deviation-detector';
import type { GeoPoint } from '../types';

// ── deviationDistance ─────────────────────────────────────────────────

describe('deviationDistance', () => {
  it('returns 0 distance when point is on the polyline vertex', () => {
    const polyline: GeoPoint[] = [
      { lat: 37.7749, lng: -122.4194 },
      { lat: 37.7849, lng: -122.4094 },
    ];
    const result = deviationDistance({ lat: 37.7749, lng: -122.4194 }, polyline);
    expect(result.distance).toBeCloseTo(0, 0);
  });

  it('returns correct perpendicular distance to segment midpoint', () => {
    // A straight E-W segment, point is directly north of the midpoint
    const polyline: GeoPoint[] = [
      { lat: 37.77, lng: -122.42 },
      { lat: 37.77, lng: -122.41 },
    ];
    // Point ~111m north (0.001 degrees latitude)
    const point: GeoPoint = { lat: 37.771, lng: -122.415 };
    const result = deviationDistance(point, polyline);
    expect(result.distance).toBeGreaterThan(100);
    expect(result.distance).toBeLessThan(120);
    // Nearest point should be roughly at the midpoint latitude
    expect(result.nearestPoint.lat).toBeCloseTo(37.77, 2);
  });

  it('returns distance to nearest vertex when perpendicular falls outside segment', () => {
    const polyline: GeoPoint[] = [
      { lat: 37.77, lng: -122.42 },
      { lat: 37.77, lng: -122.41 },
    ];
    // Point is far east of the segment endpoint
    const point: GeoPoint = { lat: 37.77, lng: -122.40 };
    const result = deviationDistance(point, polyline);
    // Should snap to the eastern endpoint (-122.41)
    expect(result.nearestPoint.lng).toBeCloseTo(-122.41, 2);
  });

  it('handles a single-segment polyline', () => {
    const polyline: GeoPoint[] = [
      { lat: 37.77, lng: -122.42 },
      { lat: 37.78, lng: -122.41 },
    ];
    const point: GeoPoint = { lat: 37.775, lng: -122.415 };
    const result = deviationDistance(point, polyline);
    expect(result.distance).toBeGreaterThanOrEqual(0);
    expect(result.nearestPoint).toBeDefined();
  });

  it('handles a single-point polyline', () => {
    const polyline: GeoPoint[] = [{ lat: 37.77, lng: -122.42 }];
    const point: GeoPoint = { lat: 37.771, lng: -122.42 };
    const result = deviationDistance(point, polyline);
    expect(result.distance).toBeGreaterThan(100);
    expect(result.nearestPoint).toEqual(polyline[0]);
  });

  it('handles empty polyline', () => {
    const result = deviationDistance({ lat: 37.77, lng: -122.42 }, []);
    expect(result.distance).toBe(Infinity);
  });

  it('handles polyline with 1000+ segments in reasonable time', () => {
    // Build a 1000-segment polyline going north
    const polyline: GeoPoint[] = [];
    for (let i = 0; i <= 1000; i++) {
      polyline.push({ lat: 37.0 + i * 0.0001, lng: -122.0 });
    }

    const point: GeoPoint = { lat: 37.05, lng: -121.999 };

    const start = performance.now();
    const result = deviationDistance(point, polyline);
    const elapsed = performance.now() - start;

    expect(result.distance).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200); // CI smoke threshold, not a benchmark
  });

  it('correctly handles switchbacks by finding nearest segment', () => {
    // Simulate switchback: trail goes E, then turns back W at a higher latitude
    const polyline: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 }, // Start
      { lat: 37.770, lng: -122.410 }, // Go east
      { lat: 37.772, lng: -122.410 }, // Turn north
      { lat: 37.772, lng: -122.420 }, // Go west (parallel, 200m higher)
    ];
    // Point is between the two E-W segments, closer to the upper one
    const point: GeoPoint = { lat: 37.7715, lng: -122.415 };
    const result = deviationDistance(point, polyline);
    // Should be close to one of the segments (~55m), not the far one (~165m)
    expect(result.distance).toBeLessThan(80);
  });
});

// ── effectiveThreshold ────────────────────────────────────────────────

describe('effectiveThreshold', () => {
  it('does not increase threshold when accuracy is good', () => {
    // GPS accuracy 5m, threshold 30m: accuracy is well below 50% of threshold
    expect(effectiveThreshold(30, 5)).toBe(30);
  });

  it('does not increase threshold at exactly 50% of base', () => {
    expect(effectiveThreshold(30, 15)).toBe(30);
  });

  it('increases threshold when accuracy exceeds 50% of base', () => {
    // GPS accuracy 20m, threshold 30m: 20 > 15 (50% of 30)
    // effective = 30 + (20 - 15) = 35
    expect(effectiveThreshold(30, 20)).toBe(35);
  });

  it('increases threshold proportionally for very poor accuracy', () => {
    // GPS accuracy 40m, threshold 30m: effective = 30 + (40 - 15) = 55
    expect(effectiveThreshold(30, 40)).toBe(55);
  });

  it('handles zero accuracy as good accuracy', () => {
    expect(effectiveThreshold(30, 0)).toBe(30);
  });
});

// ── DeviationStateMachine ─────────────────────────────────────────────

describe('DeviationStateMachine', () => {
  it('starts in normal state', () => {
    const sm = new DeviationStateMachine(30, 60);
    expect(sm.state).toBe('normal');
  });

  it('transitions NORMAL -> DEVIATED when distance > threshold', () => {
    const sm = new DeviationStateMachine(30, 0); // 0 cooldown for testing
    const shouldAlert = sm.update(50);
    expect(shouldAlert).toBe(true);
    expect(sm.state).toBe('deviated');
  });

  it('stays NORMAL when distance is within threshold', () => {
    const sm = new DeviationStateMachine(30, 0);
    const shouldAlert = sm.update(20);
    expect(shouldAlert).toBe(false);
    expect(sm.state).toBe('normal');
  });

  it('transitions DEVIATED -> NORMAL when distance drops below threshold', () => {
    const sm = new DeviationStateMachine(30, 0);
    sm.update(50); // deviate
    expect(sm.state).toBe('deviated');

    sm.update(20); // return
    expect(sm.state).toBe('normal');
  });

  it('does not re-alert while already deviated', () => {
    const sm = new DeviationStateMachine(30, 0);
    const first = sm.update(50);
    expect(first).toBe(true);

    const second = sm.update(60); // still deviated, farther away
    expect(second).toBe(false);
    expect(sm.state).toBe('deviated');
  });

  it('respects cooldown after returning and deviating again', () => {
    const sm = new DeviationStateMachine(30, 120); // 120s cooldown
    const first = sm.update(50);
    expect(first).toBe(true);

    sm.update(20); // return to normal
    expect(sm.state).toBe('normal');

    // Deviate again immediately (within cooldown)
    const second = sm.update(50);
    expect(second).toBe(false); // Cooldown prevents alert
    expect(sm.state).toBe('normal'); // Didn't transition because cooldown blocked it
  });

  it('mute prevents all alerts', () => {
    const sm = new DeviationStateMachine(30, 0);
    sm.mute();
    expect(sm.state).toBe('muted');

    const shouldAlert = sm.update(100);
    expect(shouldAlert).toBe(false);
    expect(sm.state).toBe('muted');
  });

  it('mute from deviated state stays muted', () => {
    const sm = new DeviationStateMachine(30, 0);
    sm.update(50); // deviate
    sm.mute();
    expect(sm.state).toBe('muted');

    const shouldAlert = sm.update(100);
    expect(shouldAlert).toBe(false);
  });

  it('reset returns to normal state', () => {
    const sm = new DeviationStateMachine(30, 0);
    sm.update(50); // deviate
    sm.mute();
    sm.reset();
    expect(sm.state).toBe('normal');

    const shouldAlert = sm.update(50);
    expect(shouldAlert).toBe(true);
  });

  it('accounts for GPS accuracy in threshold', () => {
    const sm = new DeviationStateMachine(30, 0);
    // 35m distance, but GPS accuracy is 20m, so effective threshold = 35m
    const shouldAlert = sm.update(35, 20);
    expect(shouldAlert).toBe(false); // 35 <= 35 (effective threshold)
  });
});
