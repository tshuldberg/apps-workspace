// Yearn location capture (plan 47 Phase 4).
//
// The ONLY module that imports expo-location. Yearn stores an optional,
// user-initiated coarse position for distance ranking; there is no
// background tracking, no watch, and no capture without an explicit user
// action. Every path returns an honest result; nothing fakes coordinates.

import * as Location from 'expo-location';

export type LocationUnavailableReason =
  | 'permission_denied'
  | 'unavailable' // no provider / position could not be resolved
  | 'error';

export type LocationCaptureResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: LocationUnavailableReason; error: string };

export interface LocationRuntime {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  getLastKnownPositionAsync(): Promise<{
    coords: { latitude: number; longitude: number };
  } | null>;
  getCurrentPositionAsync(options: { accuracy: number }): Promise<{
    coords: { latitude: number; longitude: number };
  }>;
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

const defaultRuntime: LocationRuntime = {
  requestForegroundPermissionsAsync: () => Location.requestForegroundPermissionsAsync(),
  getLastKnownPositionAsync: () => Location.getLastKnownPositionAsync(),
  getCurrentPositionAsync: (options) => Location.getCurrentPositionAsync(options),
};

/** Coarse accuracy: distance buckets need city-level precision, nothing finer. */
const COARSE_ACCURACY = Location.Accuracy?.Low ?? 3;

/**
 * One-shot coarse capture behind an explicit user action. Prefers the cached
 * last-known position (instant, battery-free) and falls back to a live
 * low-accuracy fix.
 */
export async function captureCoarseLocation(
  runtime: LocationRuntime = defaultRuntime,
): Promise<LocationCaptureResult> {
  try {
    const { status } = await runtime.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'permission_denied',
        error: 'Location permission was denied. Enable it in Settings to rank by distance.',
      };
    }

    const lastKnown = await runtime.getLastKnownPositionAsync().catch(() => null);
    const position = lastKnown
      ?? (await runtime.getCurrentPositionAsync({ accuracy: COARSE_ACCURACY }).catch(() => null));
    if (!position) {
      return {
        ok: false,
        reason: 'unavailable',
        error: 'Your position could not be determined right now.',
      };
    }

    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, reason: 'unavailable', error: 'Received an invalid position.' };
    }
    return { ok: true, latitude, longitude };
  } catch (error) {
    return { ok: false, reason: 'error', error: errMessage(error) };
  }
}
