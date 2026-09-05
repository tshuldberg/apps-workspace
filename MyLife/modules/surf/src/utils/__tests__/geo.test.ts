import { describe, it, expect } from 'vitest';
import { haversineDistance, feetToMeters, metersToFeet } from '../geo';

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('computes SF to LA distance (~559 km)', () => {
    // San Francisco (37.7749, -122.4194) to Los Angeles (34.0522, -118.2437)
    const dist = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(540);
    expect(dist).toBeLessThan(580);
  });

  it('computes NY to London distance (~5570 km)', () => {
    const dist = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5650);
  });

  it('computes short distance between two surf spots (~2 km)', () => {
    // Ocean Beach SF to Fort Point SF
    const dist = haversineDistance(37.7594, -122.5107, 37.8107, -122.4769);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  it('is commutative', () => {
    const d1 = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
    const d2 = haversineDistance(34.0522, -118.2437, 37.7749, -122.4194);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('handles equator points', () => {
    // Two points on the equator, 1 degree apart
    const dist = haversineDistance(0, 0, 0, 1);
    // 1 degree at equator ~ 111 km
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it('handles poles', () => {
    const dist = haversineDistance(90, 0, -90, 0);
    // Pole to pole ~ 20,000 km (half circumference)
    expect(dist).toBeGreaterThan(19_900);
    expect(dist).toBeLessThan(20_100);
  });
});

describe('feetToMeters', () => {
  it('converts 0 feet to 0 meters', () => {
    expect(feetToMeters(0)).toBe(0);
  });

  it('converts 1 foot to 0.3048 meters', () => {
    expect(feetToMeters(1)).toBeCloseTo(0.3048, 4);
  });

  it('converts 100 feet to 30.48 meters', () => {
    expect(feetToMeters(100)).toBeCloseTo(30.48, 2);
  });

  it('handles negative values', () => {
    expect(feetToMeters(-10)).toBeCloseTo(-3.048, 3);
  });
});

describe('metersToFeet', () => {
  it('converts 0 meters to 0 feet', () => {
    expect(metersToFeet(0)).toBe(0);
  });

  it('converts 1 meter to ~3.2808 feet', () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 3);
  });

  it('round-trip: feetToMeters(metersToFeet(x)) = x', () => {
    expect(feetToMeters(metersToFeet(100))).toBeCloseTo(100, 8);
  });

  it('round-trip: metersToFeet(feetToMeters(x)) = x', () => {
    expect(metersToFeet(feetToMeters(42))).toBeCloseTo(42, 8);
  });
});
