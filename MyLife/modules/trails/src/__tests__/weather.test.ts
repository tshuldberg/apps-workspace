import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  cacheWeather,
  getCachedWeather,
  cleanExpiredCache,
} from '../db/crud';
import {
  weatherDescription,
  weatherIcon,
  formatTemperature,
  formatWindSpeed,
  roundCoordinates,
  isWeatherCacheValid,
  formatRelativeTime,
  temperatureAtElevation,
} from '../weather/weather-formatter';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Weather Formatter', () => {
  it('maps WMO code 0 to Clear sky', () => {
    expect(weatherDescription(0)).toBe('Clear sky');
  });

  it('maps WMO code 63 to Moderate rain', () => {
    expect(weatherDescription(63)).toBe('Moderate rain');
  });

  it('returns Unknown for invalid code', () => {
    expect(weatherDescription(999)).toBe('Unknown');
  });

  it('returns emoji icon for WMO code', () => {
    const icon = weatherIcon(0);
    expect(icon).toBeTruthy();
  });

  it('returns question mark for unknown code', () => {
    expect(weatherIcon(999)).toBe('\u2753');
  });

  it('formats temperature', () => {
    expect(formatTemperature(23.4)).toBe('23\u00B0C');
    expect(formatTemperature(-5.7)).toBe('-6\u00B0C');
    expect(formatTemperature(0)).toBe('0\u00B0C');
  });

  it('formats wind speed with direction', () => {
    expect(formatWindSpeed(15, 0)).toBe('15 km/h N');
    expect(formatWindSpeed(10, 90)).toBe('10 km/h E');
    expect(formatWindSpeed(20, 225)).toBe('20 km/h SW');
    expect(formatWindSpeed(5, 315)).toBe('5 km/h NW');
  });

  it('rounds coordinates to 2 decimals', () => {
    const result = roundCoordinates(37.7749012, -122.4194155);
    expect(result.lat).toBe(37.77);
    expect(result.lng).toBe(-122.42);
  });

  it('validates cache freshness', () => {
    const now = new Date().toISOString();
    expect(isWeatherCacheValid(now, 60)).toBe(true);

    const old = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    expect(isWeatherCacheValid(old, 60)).toBe(false);
  });

  it('returns false for invalid date', () => {
    expect(isWeatherCacheValid('not-a-date')).toBe(false);
  });

  it('formats relative cache timestamps', () => {
    const now = new Date('2026-04-06T12:00:00Z').getTime();
    expect(formatRelativeTime('2026-04-06T11:58:00Z', now)).toBe('2m ago');
    expect(formatRelativeTime('2026-04-06T08:00:00Z', now)).toBe('4h ago');
    expect(formatRelativeTime('not-a-date', now)).toBe('just now');
  });

  it('estimates summit temperatures by elevation gain', () => {
    expect(temperatureAtElevation(18, 1000)).toBeCloseTo(11.5, 1);
    expect(temperatureAtElevation(8, 250)).toBeCloseTo(6.375, 3);
  });
});

describe('Weather Cache CRUD', () => {
  it('caches and retrieves weather by rounded coordinates', () => {
    const cached = cacheWeather(
      testDb.adapter,
      'w1',
      37.7749,
      -122.4194,
      '{"temp": 20}',
      new Date().toISOString(),
      new Date(Date.now() + 3600000).toISOString(),
    );

    expect(cached.id).toBe('w1');
    expect(cached.lat).toBe(37.77);
    expect(cached.lng).toBe(-122.42);

    const retrieved = getCachedWeather(testDb.adapter, 37.7701, -122.4199);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('w1');
  });

  it('returns null for uncached coordinates', () => {
    const result = getCachedWeather(testDb.adapter, 0, 0);
    expect(result).toBeNull();
  });

  it('cleans expired cache entries', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 3600000).toISOString();

    cacheWeather(testDb.adapter, 'w-expired', 10, 20, '{}', past, past);
    cacheWeather(testDb.adapter, 'w-valid', 30, 40, '{}', new Date().toISOString(), future);

    const cleaned = cleanExpiredCache(testDb.adapter);
    expect(cleaned).toBe(1);

    expect(getCachedWeather(testDb.adapter, 10, 20)).toBeNull();
    expect(getCachedWeather(testDb.adapter, 30, 40)).not.toBeNull();
  });
});
