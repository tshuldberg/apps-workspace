import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { SURF_MODULE } from '../../definition';
import {
  createSpot,
  upsertForecast,
  upsertSwellComponents,
  getSpotForecast,
} from '../crud';
import type { SwellComponent } from '../../types';

describe('@mylife/surf - forecasts CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('surf', SURF_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    createSpot(adapter, 'spot-1', {
      name: 'Ocean Beach',
      region: 'san_francisco',
      breakType: 'beach',
    });
  });

  afterEach(() => {
    closeDb();
  });

  // ── Helpers ──

  function seedForecast(id: string, forecastTime: string) {
    upsertForecast(adapter, id, {
      spotId: 'spot-1',
      forecastTime,
      modelRun: '2026-03-08T00:00:00Z',
      modelName: 'gfs',
      waveHeightMinFt: 3,
      waveHeightMaxFt: 5,
      waveHeightLabel: '3-5 ft',
      rating: 3,
      conditionColor: 'yellow',
      windSpeedKts: 10,
      windGustKts: 15,
      windDirectionDegrees: 270,
      windLabel: 'onshore',
      energyKj: 1.5,
      consistencyScore: 70,
      waterTempF: 55,
      airTempF: 60,
    });
  }

  // ── upsertForecast ──

  it('inserts a forecast and retrieves it', () => {
    const now = new Date().toISOString();
    seedForecast('fc-1', now);
    const forecasts = getSpotForecast(adapter, 'spot-1');
    expect(forecasts.length).toBeGreaterThanOrEqual(1);
    const fc = forecasts.find(f => f.id === 'fc-1');
    expect(fc).toBeDefined();
    expect(fc!.spotId).toBe('spot-1');
    expect(fc!.waveHeightMinFt).toBe(3);
    expect(fc!.waveHeightMaxFt).toBe(5);
    expect(fc!.rating).toBe(3);
    expect(fc!.conditionColor).toBe('yellow');
    expect(fc!.windSpeedKts).toBe(10);
    expect(fc!.windGustKts).toBe(15);
    expect(fc!.windLabel).toBe('onshore');
    expect(fc!.energyKj).toBe(1.5);
    expect(fc!.consistencyScore).toBe(70);
    expect(fc!.waterTempF).toBe(55);
    expect(fc!.airTempF).toBe(60);
  });

  it('upserts on conflict (INSERT OR REPLACE)', () => {
    const now = new Date().toISOString();
    seedForecast('fc-1', now);

    // Upsert with updated values
    upsertForecast(adapter, 'fc-1', {
      spotId: 'spot-1',
      forecastTime: now,
      modelRun: '2026-03-08T06:00:00Z',
      waveHeightMinFt: 5,
      waveHeightMaxFt: 8,
      rating: 4,
      conditionColor: 'green',
      windSpeedKts: 5,
      windGustKts: 8,
      windDirectionDegrees: 90,
      windLabel: 'offshore',
      energyKj: 3.0,
      consistencyScore: 90,
    });

    const forecasts = getSpotForecast(adapter, 'spot-1');
    const fc = forecasts.find(f => f.id === 'fc-1');
    expect(fc!.waveHeightMinFt).toBe(5);
    expect(fc!.waveHeightMaxFt).toBe(8);
    expect(fc!.rating).toBe(4);
    expect(fc!.conditionColor).toBe('green');
  });

  // ── upsertSwellComponents ──

  it('inserts swell components for a forecast', () => {
    const now = new Date().toISOString();
    seedForecast('fc-1', now);

    const components: SwellComponent[] = [
      { heightFt: 4, periodSeconds: 14, directionDegrees: 280, directionLabel: 'WNW', componentOrder: 1 },
      { heightFt: 2, periodSeconds: 10, directionDegrees: 300, directionLabel: 'WNW', componentOrder: 2 },
    ];
    upsertSwellComponents(adapter, 'fc-1', components);

    const forecasts = getSpotForecast(adapter, 'spot-1');
    const fc = forecasts.find(f => f.id === 'fc-1');
    expect(fc!.swellComponents).toHaveLength(2);
    expect(fc!.swellComponents[0]!.heightFt).toBe(4);
    expect(fc!.swellComponents[0]!.periodSeconds).toBe(14);
    expect(fc!.swellComponents[1]!.heightFt).toBe(2);
    expect(fc!.swellComponents[1]!.componentOrder).toBe(2);
  });

  it('replaces old swell components on re-upsert', () => {
    const now = new Date().toISOString();
    seedForecast('fc-1', now);

    // Insert initial components
    upsertSwellComponents(adapter, 'fc-1', [
      { heightFt: 4, periodSeconds: 14, directionDegrees: 280, directionLabel: 'WNW', componentOrder: 1 },
    ]);

    // Replace with new components
    upsertSwellComponents(adapter, 'fc-1', [
      { heightFt: 6, periodSeconds: 16, directionDegrees: 270, directionLabel: 'W', componentOrder: 1 },
      { heightFt: 3, periodSeconds: 12, directionDegrees: 300, directionLabel: 'WNW', componentOrder: 2 },
    ]);

    const forecasts = getSpotForecast(adapter, 'spot-1');
    const fc = forecasts.find(f => f.id === 'fc-1');
    expect(fc!.swellComponents).toHaveLength(2);
    expect(fc!.swellComponents[0]!.heightFt).toBe(6);
    expect(fc!.swellComponents[0]!.periodSeconds).toBe(16);
  });

  // ── getSpotForecast with swell join ──

  it('returns forecasts with swell components joined', () => {
    const now = new Date().toISOString();
    seedForecast('fc-1', now);
    upsertSwellComponents(adapter, 'fc-1', [
      { heightFt: 4, periodSeconds: 14, directionDegrees: 280, directionLabel: 'WNW', componentOrder: 1 },
    ]);

    const forecasts = getSpotForecast(adapter, 'spot-1');
    expect(forecasts).toHaveLength(1);
    expect(forecasts[0]!.swellComponents).toHaveLength(1);
    expect(forecasts[0]!.swellComponents[0]!.directionLabel).toBe('WNW');
  });

  it('returns empty swell components when none inserted', () => {
    const now = new Date().toISOString();
    seedForecast('fc-1', now);
    const forecasts = getSpotForecast(adapter, 'spot-1');
    expect(forecasts[0]!.swellComponents).toEqual([]);
  });

  it('returns empty array when no forecasts for spot', () => {
    expect(getSpotForecast(adapter, 'spot-1')).toEqual([]);
  });

  it('orders forecasts by time ascending', () => {
    seedForecast('fc-2', '2026-03-08T12:00:00Z');
    seedForecast('fc-1', '2026-03-08T06:00:00Z');
    seedForecast('fc-3', '2026-03-08T18:00:00Z');

    const forecasts = getSpotForecast(adapter, 'spot-1');
    expect(forecasts[0]!.forecastTime).toBe('2026-03-08T06:00:00Z');
    expect(forecasts[1]!.forecastTime).toBe('2026-03-08T12:00:00Z');
    expect(forecasts[2]!.forecastTime).toBe('2026-03-08T18:00:00Z');
  });
});
