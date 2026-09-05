// Unit tests for the GPS position-source seam.
//
// The expo-location module is faked and injected (never imported), matching the
// repo's injected-deps idiom, so this suite runs without a native runtime. The
// type-only imports below are erased at build time.

import { describe, expect, it, vi } from 'vitest';
import type { LocationObject, LocationPermissionResponse } from 'expo-location';
import {
  buildSimulatedFix,
  createLocationPositionSource,
  createSimulatedPositionSource,
  mapLocationToFix,
  mapPermissionResult,
  resolveFixTimestamp,
  type ExpoLocationModule,
  type GpsFix,
  type SimIntervalId,
  type SimScheduler,
} from '../position-source';

function makeLocation(coords: Partial<LocationObject['coords']>, timestamp = 1_700_000_000_000): LocationObject {
  return {
    coords: {
      latitude: 37.5,
      longitude: -122.1,
      altitude: 30,
      accuracy: 5,
      altitudeAccuracy: 3,
      heading: 90,
      speed: 2.4,
      ...coords,
    },
    timestamp,
  };
}

function grantedPermission(granted: boolean): LocationPermissionResponse {
  return {
    granted,
    canAskAgain: true,
    expires: 'never',
    status: (granted ? 'granted' : 'denied') as LocationPermissionResponse['status'],
  } as LocationPermissionResponse;
}

// A controllable fake of the expo-location surface. A queue of scheduled
// callbacks lets a test deliver fixes on demand.
function makeLocationModule(
  overrides: {
    granted?: boolean;
    servicesEnabled?: boolean;
    requestThrows?: boolean;
    watchThrows?: boolean;
  } = {},
) {
  const {
    granted = true,
    servicesEnabled = true,
    requestThrows = false,
    watchThrows = false,
  } = overrides;
  const remove = vi.fn();
  let deliver: ((location: LocationObject) => void) | null = null;

  const module: ExpoLocationModule = {
    // Only the members the source reads; BestForNavigation is the one it passes.
    Accuracy: { BestForNavigation: 6, High: 4 } as unknown as ExpoLocationModule['Accuracy'],
    requestForegroundPermissionsAsync: vi.fn(async () => {
      if (requestThrows) throw new Error('permission crashed');
      return grantedPermission(granted);
    }),
    hasServicesEnabledAsync: vi.fn(async () => servicesEnabled),
    watchPositionAsync: vi.fn(async (_options, callback: (location: LocationObject) => void) => {
      if (watchThrows) throw new Error('watch crashed');
      deliver = callback;
      return { remove };
    }),
  };

  return {
    module,
    remove,
    emit: (location: LocationObject) => deliver?.(location),
    watchOptions: () =>
      (module.watchPositionAsync as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0],
  };
}

describe('mapLocationToFix', () => {
  it('maps a full fix to the recorder shape', () => {
    const fix = mapLocationToFix(makeLocation({}, 1_700_000_000_123));
    expect(fix).toEqual({
      latitude: 37.5,
      longitude: -122.1,
      altitudeMeters: 30,
      speedMps: 2.4,
      accuracyMeters: 5,
      timestampMs: 1_700_000_000_123,
      segment: 0,
    });
  });

  it('keeps missing altitude and accuracy as null instead of inventing zeros', () => {
    const fix = mapLocationToFix(makeLocation({ altitude: null, accuracy: null }));
    expect(fix.altitudeMeters).toBeNull();
    expect(fix.accuracyMeters).toBeNull();
  });

  it('treats null or negative speed as unknown (null), not a real reading', () => {
    expect(mapLocationToFix(makeLocation({ speed: null })).speedMps).toBeNull();
    expect(mapLocationToFix(makeLocation({ speed: -1 })).speedMps).toBeNull();
    expect(mapLocationToFix(makeLocation({ speed: 0 })).speedMps).toBe(0);
  });
});

describe('resolveFixTimestamp', () => {
  it('passes a valid device timestamp through unchanged', () => {
    expect(resolveFixTimestamp(1_700_000_000_000, () => 999)).toBe(1_700_000_000_000);
  });

  it('falls back to wall-clock for a zero or non-finite timestamp', () => {
    expect(resolveFixTimestamp(0, () => 999)).toBe(999);
    expect(resolveFixTimestamp(Number.NaN, () => 999)).toBe(999);
  });
});

describe('mapPermissionResult', () => {
  it('accepts a granted permission', () => {
    expect(mapPermissionResult({ granted: true })).toEqual({ ok: true });
  });

  it('maps a denied permission to the honest denied reason with copy', () => {
    const result = mapPermissionResult({ granted: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('denied');
      expect(result.message).toMatch(/can't record a route/i);
    }
  });
});

describe('createLocationPositionSource', () => {
  it('starts watching and maps delivered fixes through onFix', async () => {
    const fixes: GpsFix[] = [];
    const loc = makeLocationModule({ granted: true, servicesEnabled: true });
    const source = createLocationPositionSource(loc.module);

    const result = await source.start((fix) => fixes.push(fix));
    expect(result).toEqual({ ok: true });
    expect(loc.watchOptions()).toMatchObject({
      accuracy: 6,
      distanceInterval: 3,
      timeInterval: 1000,
    });

    loc.emit(makeLocation({ latitude: 37.6, longitude: -122.2 }, 1_700_000_001_000));
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({ latitude: 37.6, longitude: -122.2, timestampMs: 1_700_000_001_000 });

    source.stop();
    expect(loc.remove).toHaveBeenCalledTimes(1);
  });

  it('returns denied and never watches when permission is refused', async () => {
    const loc = makeLocationModule({ granted: false });
    const source = createLocationPositionSource(loc.module);

    const result = await source.start(() => {});
    expect(result).toEqual({ ok: false, reason: 'denied', message: expect.any(String) });
    expect(loc.module.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('returns unavailable when location services are off', async () => {
    const loc = makeLocationModule({ granted: true, servicesEnabled: false });
    const source = createLocationPositionSource(loc.module);

    const result = await source.start(() => {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
    expect(loc.module.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('returns error when the permission request throws', async () => {
    const loc = makeLocationModule({ requestThrows: true });
    const source = createLocationPositionSource(loc.module);

    const result = await source.start(() => {});
    expect(result).toMatchObject({ ok: false, reason: 'error', message: 'permission crashed' });
  });

  it('returns error when watchPositionAsync throws', async () => {
    const loc = makeLocationModule({ watchThrows: true });
    const source = createLocationPositionSource(loc.module);

    const result = await source.start(() => {});
    expect(result).toMatchObject({ ok: false, reason: 'error', message: 'watch crashed' });
  });
});

describe('buildSimulatedFix', () => {
  it('is deterministic and seeds the first fix at the San Francisco base point', () => {
    const first = buildSimulatedFix('run', null, 0, () => 1000);
    expect(first.latitude).toBeCloseTo(37.7749 + (Math.cos(0) * 22) / 111_111, 10);
    expect(first.timestampMs).toBe(1000);
    // Same inputs, same output.
    expect(buildSimulatedFix('run', null, 0, () => 1000)).toEqual(first);
  });

  it('steps away from the previous point on each index', () => {
    const now = () => 2000;
    const first = buildSimulatedFix('walk', null, 0, now);
    const second = buildSimulatedFix('walk', first, 1, now);
    expect(second.latitude).not.toBe(first.latitude);
    expect(second.longitude).not.toBe(first.longitude);
  });
});

describe('createSimulatedPositionSource', () => {
  it('emits a deterministic sequence on each scheduler tick and stops cleanly', async () => {
    let tick: (() => void) | null = null;
    const clearInterval = vi.fn();
    const scheduler: SimScheduler = {
      setInterval: (handler) => {
        tick = handler;
        return 1 as unknown as SimIntervalId;
      },
      clearInterval,
    };
    const fixes: GpsFix[] = [];
    const source = createSimulatedPositionSource({
      activityType: 'run',
      now: () => 5000,
      scheduler,
    });

    await source.start((fix) => fixes.push(fix));
    expect(fixes).toHaveLength(0); // nothing before the first tick

    tick?.();
    tick?.();
    expect(fixes).toHaveLength(2);
    // Sequence matches the pure builder fed its own previous fix.
    expect(fixes[0]).toEqual(buildSimulatedFix('run', null, 0, () => 5000));
    expect(fixes[1]).toEqual(buildSimulatedFix('run', fixes[0], 1, () => 5000));

    source.stop();
    expect(clearInterval).toHaveBeenCalledWith(1);
  });
});
