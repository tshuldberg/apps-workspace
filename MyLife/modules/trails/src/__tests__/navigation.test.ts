import { describe, it, expect } from 'vitest';
import {
  calculateBearing,
  angleBetweenBearings,
  buildRoute,
  calculateRouteStats,
  classifyTurn,
  generateInstructions,
} from '../engine/navigation-engine';
import type { GeoPoint } from '../types';

describe('calculateBearing', () => {
  it('due north is ~0 degrees', () => {
    const b = calculateBearing({ lat: 37.0, lng: -122.0 }, { lat: 38.0, lng: -122.0 });
    expect(b).toBeCloseTo(0, 0);
  });

  it('due east is ~90 degrees', () => {
    const b = calculateBearing({ lat: 37.0, lng: -122.0 }, { lat: 37.0, lng: -121.0 });
    expect(b).toBeCloseTo(90, 0);
  });

  it('due south is ~180 degrees', () => {
    const b = calculateBearing({ lat: 38.0, lng: -122.0 }, { lat: 37.0, lng: -122.0 });
    expect(b).toBeCloseTo(180, 0);
  });

  it('due west is ~270 degrees', () => {
    const b = calculateBearing({ lat: 37.0, lng: -121.0 }, { lat: 37.0, lng: -122.0 });
    expect(b).toBeCloseTo(270, 0);
  });
});

describe('angleBetweenBearings', () => {
  it('same bearing is 0', () => {
    expect(angleBetweenBearings(90, 90)).toBe(0);
  });

  it('right turn 90 degrees', () => {
    expect(angleBetweenBearings(0, 90)).toBe(90);
  });

  it('left turn -90 degrees', () => {
    expect(angleBetweenBearings(90, 0)).toBe(-90);
  });

  it('handles 360/0 wraparound', () => {
    expect(angleBetweenBearings(350, 10)).toBe(20);
    expect(angleBetweenBearings(10, 350)).toBe(-20);
  });

  it('u-turn is 180 or -180', () => {
    const a = angleBetweenBearings(0, 180);
    expect(Math.abs(a)).toBe(180);
  });
});

describe('classifyTurn', () => {
  it('0 degrees is straight', () => {
    expect(classifyTurn(0)).toBe('straight');
  });

  it('-5 degrees is straight', () => {
    expect(classifyTurn(-5)).toBe('straight');
  });

  it('-20 degrees is slight_left', () => {
    expect(classifyTurn(-20)).toBe('slight_left');
  });

  it('-45 degrees is left', () => {
    expect(classifyTurn(-45)).toBe('left');
  });

  it('-90 degrees is sharp_left', () => {
    expect(classifyTurn(-90)).toBe('sharp_left');
  });

  it('20 degrees is slight_right', () => {
    expect(classifyTurn(20)).toBe('slight_right');
  });

  it('45 degrees is right', () => {
    expect(classifyTurn(45)).toBe('right');
  });

  it('90 degrees is sharp_right', () => {
    expect(classifyTurn(90)).toBe('sharp_right');
  });

  it('170 degrees is u_turn', () => {
    expect(classifyTurn(170)).toBe('u_turn');
  });

  it('-170 degrees is u_turn', () => {
    expect(classifyTurn(-170)).toBe('u_turn');
  });
});

describe('generateInstructions', () => {
  it('returns empty for less than 2 waypoints', () => {
    expect(generateInstructions([])).toEqual([]);
    expect(generateInstructions([{ lat: 37.7, lng: -122.4 }])).toEqual([]);
  });

  it('generates start and arrive for 2 waypoints', () => {
    const points: GeoPoint[] = [
      { lat: 37.77, lng: -122.42 },
      { lat: 37.78, lng: -122.41 },
    ];
    const instructions = generateInstructions(points);
    expect(instructions).toHaveLength(2);
    expect(instructions[0].description).toBe('Start');
    expect(instructions[1].description).toBe('Arrive at destination');
  });

  it('detects a right turn in a 3-point path', () => {
    // Go north, then turn east
    const points: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.780, lng: -122.420 },
      { lat: 37.780, lng: -122.410 },
    ];
    const instructions = generateInstructions(points);
    expect(instructions).toHaveLength(3);
    // Middle instruction should be some form of right turn
    const turn = instructions[1].turnType;
    expect(['right', 'sharp_right', 'slight_right']).toContain(turn);
  });

  it('has correct distance from previous for each instruction', () => {
    const points: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.780, lng: -122.420 },
      { lat: 37.780, lng: -122.410 },
    ];
    const instructions = generateInstructions(points);
    expect(instructions[0].distanceFromPrevious).toBe(0);
    expect(instructions[1].distanceFromPrevious).toBeGreaterThan(0);
    expect(instructions[2].distanceFromPrevious).toBeGreaterThan(0);
  });
});

describe('buildRoute', () => {
  const baseWaypoints: GeoPoint[] = [
    { lat: 37.770, lng: -122.420 },
    { lat: 37.774, lng: -122.416 },
    { lat: 37.779, lng: -122.412 },
  ];

  it('returns raw waypoints in straight mode', () => {
    expect(buildRoute(baseWaypoints, 'straight')).toEqual(baseWaypoints);
  });

  it('densifies the route in auto mode while preserving endpoints', () => {
    const result = buildRoute(baseWaypoints, 'auto');
    expect(result.length).toBeGreaterThan(baseWaypoints.length);
    expect(result[0]).toEqual(baseWaypoints[0]);
    expect(result.at(-1)).toEqual(baseWaypoints.at(-1));
  });
});

describe('calculateRouteStats', () => {
  it('returns distance, duration, and difficulty for hiking', () => {
    const routePoints: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.775, lng: -122.420 },
      { lat: 37.775, lng: -122.412 },
    ];

    const stats = calculateRouteStats(routePoints, 220, 'hike');
    expect(stats.distanceMeters).toBeGreaterThan(1000);
    expect(stats.estimatedMinutes).toBeGreaterThan(10);
    expect(['easy', 'moderate', 'hard', 'expert']).toContain(stats.difficulty);
  });

  it('estimates faster times for bike mode on the same route', () => {
    const routePoints: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.778, lng: -122.416 },
    ];

    const hike = calculateRouteStats(routePoints, 80, 'hike');
    const bike = calculateRouteStats(routePoints, 80, 'bike');
    expect(bike.estimatedMinutes).toBeLessThan(hike.estimatedMinutes);
  });
});
