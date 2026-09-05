import { beforeEach, describe, expect, it, vi } from 'vitest';

const expoLocation = vi.hoisted(() => ({
  requestForegroundPermissionsAsync: vi.fn(),
  getLastKnownPositionAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  Accuracy: { Low: 3 },
}));
vi.mock('expo-location', () => expoLocation);

import { captureCoarseLocation, type LocationRuntime } from '../location';

const runtime: LocationRuntime = expoLocation;

beforeEach(() => {
  vi.clearAllMocks();
  expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  expoLocation.getLastKnownPositionAsync.mockResolvedValue(null);
  expoLocation.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 37.7749, longitude: -122.4194 },
  });
});

describe('captureCoarseLocation', () => {
  it('fails honestly as permission_denied and never reads a position', async () => {
    expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const result = await captureCoarseLocation(runtime);
    expect(result).toMatchObject({ ok: false, reason: 'permission_denied' });
    expect(expoLocation.getLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('prefers the cached last-known position over a live fix', async () => {
    expoLocation.getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 40.7128, longitude: -74.006 },
    });
    const result = await captureCoarseLocation(runtime);
    expect(result).toEqual({ ok: true, latitude: 40.7128, longitude: -74.006 });
    expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('falls back to a live coarse fix when no cache exists', async () => {
    const result = await captureCoarseLocation(runtime);
    expect(result).toEqual({ ok: true, latitude: 37.7749, longitude: -122.4194 });
    expect(expoLocation.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
  });

  it('reports unavailable when no position can be resolved (never fakes coordinates)', async () => {
    expoLocation.getCurrentPositionAsync.mockRejectedValue(new Error('no provider'));
    const result = await captureCoarseLocation(runtime);
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('rejects non-finite coordinates', async () => {
    expoLocation.getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: Number.NaN, longitude: 0 },
    });
    const result = await captureCoarseLocation(runtime);
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
  });
});
