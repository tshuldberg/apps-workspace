// Pure navigation and route planning helpers.

import type { GeoPoint, TurnType, NavigationInstruction } from '../types';
import { haversineDistance } from './geo';
import { calculateDifficulty } from './difficulty-calculator';

export type RouteBuildMode = 'auto' | 'straight';
export type RouteTravelMode = 'hike' | 'bike';

export interface RouteStats {
  distanceMeters: number;
  elevationGainMeters: number;
  estimatedMinutes: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate the initial bearing from point a to point b.
 * Returns degrees 0-360 (0 = north, 90 = east).
 */
export function calculateBearing(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = toDegrees(Math.atan2(y, x));
  return ((bearing % 360) + 360) % 360;
}

/**
 * Calculate the signed angle between two bearings.
 * Returns a value from -180 to 180 degrees.
 * Positive = clockwise (right turn), Negative = counter-clockwise (left turn).
 */
export function angleBetweenBearings(b1: number, b2: number): number {
  let diff = b2 - b1;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Classify a turn angle into a TurnType.
 *
 * < -150 or > 150 = u_turn
 * -150 to -60 = sharp_left
 * -60 to -30 = left
 * -30 to -10 = slight_left
 * -10 to 10 = straight
 * 10 to 30 = slight_right
 * 30 to 60 = right
 * 60 to 150 = sharp_right
 */
export function classifyTurn(angleDegrees: number): TurnType {
  if (angleDegrees < -150 || angleDegrees > 150) return 'u_turn';
  if (angleDegrees < -60) return 'sharp_left';
  if (angleDegrees < -30) return 'left';
  if (angleDegrees < -10) return 'slight_left';
  if (angleDegrees <= 10) return 'straight';
  if (angleDegrees <= 30) return 'slight_right';
  if (angleDegrees <= 60) return 'right';
  if (angleDegrees <= 150) return 'sharp_right';
  return 'u_turn';
}

function turnDescription(turnType: TurnType): string {
  switch (turnType) {
    case 'straight':
      return 'Continue straight';
    case 'slight_left':
      return 'Bear left';
    case 'left':
      return 'Turn left';
    case 'sharp_left':
      return 'Sharp left';
    case 'slight_right':
      return 'Bear right';
    case 'right':
      return 'Turn right';
    case 'sharp_right':
      return 'Sharp right';
    case 'u_turn':
      return 'Make a U-turn';
  }
}

/**
 * Generate navigation instructions from a series of waypoints.
 * Each instruction describes the turn at that waypoint.
 */
export function generateInstructions(waypoints: GeoPoint[]): NavigationInstruction[] {
  if (waypoints.length < 2) return [];

  const instructions: NavigationInstruction[] = [];

  // First point: always "Start" / straight
  instructions.push({
    index: 0,
    turnType: 'straight',
    distanceFromPrevious: 0,
    lat: waypoints[0].lat,
    lng: waypoints[0].lng,
    description: 'Start',
  });

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);

    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      const bearingIn = calculateBearing(prev, curr);
      const bearingOut = calculateBearing(curr, next);
      const angle = angleBetweenBearings(bearingIn, bearingOut);
      const turn = classifyTurn(angle);

      instructions.push({
        index: i,
        turnType: turn,
        distanceFromPrevious: dist,
        lat: curr.lat,
        lng: curr.lng,
        description: turnDescription(turn),
      });
    } else {
      // Last point: destination
      instructions.push({
        index: i,
        turnType: 'straight',
        distanceFromPrevious: dist,
        lat: curr.lat,
        lng: curr.lng,
        description: 'Arrive at destination',
      });
    }
  }

  return instructions;
}

function interpolateRouteSegment(
  start: GeoPoint,
  end: GeoPoint,
  sign: number,
): GeoPoint[] {
  const segmentDistance = haversineDistance(start.lat, start.lng, end.lat, end.lng);
  const steps = Math.max(3, Math.min(10, Math.ceil(segmentDistance / 140)));
  const latDelta = end.lat - start.lat;
  const lngDelta = end.lng - start.lng;
  const length = Math.sqrt((latDelta * latDelta) + (lngDelta * lngDelta)) || 1;
  const normalLat = -(lngDelta / length);
  const normalLng = latDelta / length;
  const curveStrength = Math.min(0.0018, length * 0.22);

  const points: GeoPoint[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const baseLat = start.lat + (latDelta * t);
    const baseLng = start.lng + (lngDelta * t);
    const offset = Math.sin(Math.PI * t) * curveStrength * sign;
    points.push({
      lat: baseLat + (normalLat * offset),
      lng: baseLng + (normalLng * offset),
    });
  }

  return points;
}

/**
 * Build a drawable route polyline from ordered waypoints.
 *
 * "auto" mode does not attempt true trail-network routing. It densifies each
 * segment with a gentle alternating curve so the planner feels trail-shaped
 * instead of perfectly geometric while keeping endpoints fixed.
 */
export function buildRoute(
  waypoints: GeoPoint[],
  mode: RouteBuildMode = 'auto',
): GeoPoint[] {
  if (waypoints.length < 2) {
    return [...waypoints];
  }

  if (mode === 'straight') {
    return [...waypoints];
  }

  const built: GeoPoint[] = [];

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const start = waypoints[index];
    const end = waypoints[index + 1];
    const segment = interpolateRouteSegment(start, end, index % 2 === 0 ? 1 : -1);

    if (index === 0) {
      built.push(...segment);
    } else {
      built.push(...segment.slice(1));
    }
  }

  return built;
}

/**
 * Calculate the summary metrics shown by the planner for a built route.
 */
export function calculateRouteStats(
  routePoints: GeoPoint[],
  elevationGainMeters: number,
  travelMode: RouteTravelMode = 'hike',
): RouteStats {
  let distanceMeters = 0;

  for (let index = 1; index < routePoints.length; index += 1) {
    const previous = routePoints[index - 1];
    const current = routePoints[index];
    distanceMeters += haversineDistance(previous.lat, previous.lng, current.lat, current.lng);
  }

  const distanceKm = distanceMeters / 1000;
  const baseSpeedKph = travelMode === 'bike' ? 14 : 4.8;
  const baseMinutes = distanceKm > 0 ? (distanceKm / baseSpeedKph) * 60 : 0;
  const climbingPenalty = elevationGainMeters / (travelMode === 'bike' ? 18 : 12);
  const estimatedMinutes = Math.max(1, Math.round(baseMinutes + climbingPenalty));

  return {
    distanceMeters,
    elevationGainMeters,
    estimatedMinutes,
    difficulty: calculateDifficulty(distanceMeters, elevationGainMeters, null),
  };
}
