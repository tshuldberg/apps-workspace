// Position-source seam for the GPS workout recorder.
//
// The recorder screen consumes an abstract PositionSource so its recording math,
// persistence, splits, and UI never depend on WHERE fixes come from. Production
// wires the real device GPS via createLocationPositionSource(expoLocation). A
// __DEV__-only simulated source (createSimulatedPositionSource) is available for
// on-simulator testing and always drives a visible SIMULATED badge in the screen
// so a fabricated route can never be mistaken for a real one.
//
// expo-location is depended on by type only here; the real native module is
// passed in from the screen and a fake is passed in from the unit tests, so this
// file (and anything importing it) never loads the native package.

import type {
  LocationObject,
  LocationOptions,
  LocationPermissionResponse,
  LocationSubscription,
  LocationAccuracy,
} from 'expo-location';
import type { GpsActivityType } from '@mylife/workouts';

// A single recorded position, in the recorder's fix shape. Structurally
// assignable to the workouts module's GpsPointInput. altitude / speed / accuracy
// are null when the device does not report them; we never invent a value.
export interface GpsFix {
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  speedMps: number | null;
  accuracyMeters: number | null;
  timestampMs: number;
  segment: number;
}

export type PositionStartResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error'; message?: string };

export type PositionStartFailure = Extract<PositionStartResult, { ok: false }>;

export interface PositionSource {
  start(onFix: (fix: GpsFix) => void): Promise<PositionStartResult>;
  stop(): void;
}

// The slice of the expo-location surface we depend on. A namespace import
// (`import * as Location from 'expo-location'`) is structurally assignable to
// this, so the screen passes the real module and tests pass a fake.
export interface ExpoLocationModule {
  Accuracy: typeof LocationAccuracy;
  requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  hasServicesEnabledAsync?(): Promise<boolean>;
  watchPositionAsync(
    options: LocationOptions,
    callback: (location: LocationObject) => void,
  ): Promise<LocationSubscription>;
}

const DENIED_MESSAGE = "Location access is off. DoWork can't record a route without it.";
const SERVICES_OFF_MESSAGE =
  'Location Services are turned off, so DoWork cannot see your position.';
const GENERIC_ERROR_MESSAGE = 'Location is unavailable right now.';

// ── pure mappers (unit-tested) ──────────────────────────────────────────────

// Map an expo-location fix to the recorder shape. speed comes back null (and -1
// on some iOS builds) when the device has no valid reading; altitude/accuracy
// come back null when unavailable. Those stay null rather than becoming fake
// zeros so the recorder never charts fabricated data.
export function mapLocationToFix(location: LocationObject): GpsFix {
  const { coords } = location;
  const speed = coords.speed;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitudeMeters: coords.altitude ?? null,
    speedMps: typeof speed === 'number' && speed >= 0 ? speed : null,
    accuracyMeters: coords.accuracy ?? null,
    timestampMs: resolveFixTimestamp(location.timestamp),
    segment: 0,
  };
}

// The recorder derives split times from timestampMs deltas, so a missing or zero
// device timestamp would corrupt splits; fall back to wall-clock in that case.
export function resolveFixTimestamp(timestamp: number, now: () => number = Date.now): number {
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : now();
}

export function mapPermissionResult(
  permission: Pick<LocationPermissionResponse, 'granted'>,
): PositionStartResult {
  if (permission.granted) return { ok: true };
  return { ok: false, reason: 'denied', message: DENIED_MESSAGE };
}

// ── real device source ──────────────────────────────────────────────────────

export function createLocationPositionSource(location: ExpoLocationModule): PositionSource {
  let subscription: LocationSubscription | null = null;

  return {
    async start(onFix) {
      let permission: LocationPermissionResponse;
      try {
        permission = await location.requestForegroundPermissionsAsync();
      } catch (error) {
        return { ok: false, reason: 'error', message: errorMessage(error) };
      }

      const verdict = mapPermissionResult(permission);
      if (!verdict.ok) return verdict;

      // Location Services can be off system-wide even when the app is permitted.
      if (location.hasServicesEnabledAsync) {
        try {
          const enabled = await location.hasServicesEnabledAsync();
          if (!enabled) {
            return { ok: false, reason: 'unavailable', message: SERVICES_OFF_MESSAGE };
          }
        } catch {
          // A failed probe is not proof services are off; fall through to watch.
        }
      }

      try {
        subscription = await location.watchPositionAsync(
          {
            accuracy: location.Accuracy.BestForNavigation,
            distanceInterval: 3,
            timeInterval: 1000,
          },
          (fix) => onFix(mapLocationToFix(fix)),
        );
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: 'error', message: errorMessage(error) };
      }
    },
    stop() {
      subscription?.remove();
      subscription = null;
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return GENERIC_ERROR_MESSAGE;
}

// ── simulated source (__DEV__ only) ─────────────────────────────────────────
//
// Extracted verbatim from the recorder's former in-screen simulator so the
// stepping math is unchanged. Kept out of the production path by the __DEV__
// guard in the screen; the SIMULATED badge makes any use of it obvious.

const ACTIVITY_STEP_METERS: Record<GpsActivityType, number> = {
  run: 22,
  walk: 8,
  cycle: 36,
  hike: 12,
  other: 10,
};

function metersToLat(meters: number): number {
  return meters / 111_111;
}

function metersToLon(meters: number, latitude: number): number {
  return meters / (111_111 * Math.cos((latitude * Math.PI) / 180));
}

// Deterministic given (activityType, previous, stepIndex, now): the same inputs
// always produce the same fix, which is what makes the simulated source testable.
export function buildSimulatedFix(
  activityType: GpsActivityType,
  previous: Pick<GpsFix, 'latitude' | 'longitude' | 'altitudeMeters'> | null,
  stepIndex: number,
  now: () => number = Date.now,
): GpsFix {
  const baseLatitude = previous?.latitude ?? 37.7749;
  const baseLongitude = previous?.longitude ?? -122.4194;
  const stepMeters = ACTIVITY_STEP_METERS[activityType] ?? 10;
  const angle = stepIndex * 0.42;
  const latitude = baseLatitude + metersToLat(Math.cos(angle) * stepMeters);
  const longitude = baseLongitude + metersToLon(Math.sin(angle) * stepMeters, baseLatitude);
  const altitudeMeters = (previous?.altitudeMeters ?? 18) + Math.sin(stepIndex / 3) * 1.6;

  return {
    latitude,
    longitude,
    altitudeMeters,
    speedMps: stepMeters / 5,
    accuracyMeters: 6,
    timestampMs: now(),
    segment: 0,
  };
}

export type SimIntervalId = ReturnType<typeof setInterval>;

export interface SimScheduler {
  setInterval(handler: () => void, ms: number): SimIntervalId;
  clearInterval(id: SimIntervalId): void;
}

export interface SimulatedPositionSourceOptions {
  activityType: GpsActivityType;
  intervalMs?: number;
  now?: () => number;
  scheduler?: SimScheduler;
}

const DEFAULT_SIM_INTERVAL_MS = 5000;

const defaultScheduler: SimScheduler = {
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearInterval: (id) => clearInterval(id),
};

export function createSimulatedPositionSource(
  options: SimulatedPositionSourceOptions,
): PositionSource {
  const { activityType, intervalMs = DEFAULT_SIM_INTERVAL_MS, now = Date.now } = options;
  const scheduler = options.scheduler ?? defaultScheduler;
  let interval: SimIntervalId | null = null;
  let previous: GpsFix | null = null;
  let stepIndex = 0;

  const emitNext = (onFix: (fix: GpsFix) => void) => {
    const fix = buildSimulatedFix(activityType, previous, stepIndex, now);
    previous = fix;
    stepIndex += 1;
    onFix(fix);
  };

  return {
    async start(onFix) {
      // Step on the interval only. The first fix lands after intervalMs, by
      // which point the recorder has already created its route row, so no fix
      // is emitted before there is somewhere to persist it.
      interval = scheduler.setInterval(() => emitNext(onFix), intervalMs);
      return { ok: true };
    },
    stop() {
      if (interval !== null) {
        scheduler.clearInterval(interval);
        interval = null;
      }
    },
  };
}
