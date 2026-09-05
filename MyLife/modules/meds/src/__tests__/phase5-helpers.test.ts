import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedication } from '../db/crud';
import { createMoodEntry } from '../mood/check-in';
import {
  getMoodCorrelations,
  getMoodTrends,
  linkActivitiesToMood,
} from '../mood/trends';
import { createPainEntry, getPainInsights } from '../pain/queries';
import { getWeatherTriggerInsights } from '../weather/queries';

describe('phase 5 helper layer', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('builds mood trends and activity correlations from tracked entries', () => {
    createMoodEntry(adapter, 'mood-1', {
      mood: 'good',
      energyLevel: 'high',
      pleasantness: 'pleasant',
      intensity: 4,
      recordedAt: '2026-04-01T08:00:00.000Z',
    });
    createMoodEntry(adapter, 'mood-2', {
      mood: 'bad',
      energyLevel: 'low',
      pleasantness: 'unpleasant',
      intensity: 4,
      recordedAt: '2026-04-02T08:00:00.000Z',
    });

    linkActivitiesToMood(adapter, 'mood-1', ['Exercise', 'Sleep']);
    linkActivitiesToMood(adapter, 'mood-2', ['Stress']);

    const trends = getMoodTrends(adapter, '2026-04-01', '2026-04-30');
    const correlations = getMoodCorrelations(adapter, '2026-04-01', '2026-04-30');

    expect(trends.totalEntries).toBe(2);
    expect(trends.daily).toHaveLength(2);
    expect(correlations.activities.map((item) => item.activity.toLowerCase())).toEqual(
      expect.arrayContaining(['exercise', 'stress']),
    );
  });

  it('builds pain insights from logged pain entries', () => {
    createMedication(adapter, 'med-1', {
      name: 'Naproxen',
    });

    createPainEntry(adapter, 'pain-1', {
      bodyZone: 'lower_back',
      severity: 8,
      painType: 'aching',
      startedAt: '2026-04-03T18:00:00.000Z',
    });
    createPainEntry(adapter, 'pain-2', {
      bodyZone: 'lower_back',
      severity: 7,
      painType: 'aching',
      startedAt: '2026-04-04T18:30:00.000Z',
    });
    createPainEntry(adapter, 'pain-3', {
      bodyZone: 'neck',
      severity: 5,
      painType: 'pressure',
      startedAt: '2026-04-04T08:00:00.000Z',
    });

    const insights = getPainInsights(adapter, '2026-04-01', '2026-04-30');

    expect(insights.mostPainfulRegion?.zone).toBe('lower_back');
    expect(insights.regionSummaries.length).toBeGreaterThan(0);
  });

  it('builds weather trigger insights from linked weather and symptom data', () => {
    adapter.execute(
      `INSERT INTO md_symptoms (id, name, is_custom, created_at) VALUES (?, ?, ?, ?)`,
      ['symptom-1', 'headache', 0, '2026-04-01T00:00:00.000Z'],
    );

    for (let index = 0; index < 10; index += 1) {
      const isoDate = `2026-04-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`;
      adapter.execute(
        `INSERT INTO md_weather_snapshots (
          id,
          latitude,
          longitude,
          temperature_c,
          humidity_percent,
          pressure_mb,
          pressure_change_3h,
          wind_speed_kmh,
          weather_code,
          weather_description,
          captured_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `weather-${index}`,
          10,
          10,
          20 + index,
          55 + index,
          1018 - index,
          -3.5,
          8 + index,
          1,
          'Cloudy',
          isoDate,
          isoDate,
        ],
      );
      adapter.execute(
        `INSERT INTO md_symptom_logs (id, symptom_id, severity, notes, logged_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `log-${index}`,
          'symptom-1',
          Math.min(5, 1 + Math.floor(index / 2)),
          null,
          isoDate,
          isoDate,
        ],
      );
      adapter.execute(
        `INSERT INTO md_weather_symptom_links (id, weather_snapshot_id, symptom_log_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          `link-${index}`,
          `weather-${index}`,
          `log-${index}`,
          isoDate,
        ],
      );
    }

    const insights = getWeatherTriggerInsights(adapter, '2026-04-01', '2026-04-30');

    expect(insights.points).toHaveLength(10);
    expect(insights.correlations.length).toBeGreaterThan(0);
    expect(insights.alerts.length).toBeGreaterThan(0);
  });
});
