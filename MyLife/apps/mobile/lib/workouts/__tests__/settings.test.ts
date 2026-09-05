import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  clearWorkoutRecentViews,
  getWorkoutPhaseOneSettings,
  getWorkoutRecentViews,
  pushWorkoutRecentView,
  saveWorkoutPhaseOneSettings,
  WORKOUT_PHASE_ONE_DEFAULTS,
} from '../settings';

function createSettingsDb(): DatabaseAdapter {
  const settings = new Map<string, string>();

  return {
    execute(sql: string, params?: unknown[]) {
      if (sql.includes('INSERT INTO hub_settings')) {
        const [key, value] = (params ?? []) as [string, string];
        settings.set(key, value);
        return;
      }

      throw new Error(`Unsupported execute SQL in test adapter: ${sql}`);
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      if (sql.includes('SELECT value FROM hub_settings')) {
        const key = params?.[0] as string;
        const value = settings.get(key);
        return value == null ? [] : ([{ value }] as T[]);
      }

      throw new Error(`Unsupported query SQL in test adapter: ${sql}`);
    },
    transaction(fn: () => void) {
      fn();
    },
  };
}

describe('workout phase-one settings storage', () => {
  it('returns defaults when no settings exist yet', () => {
    const db = createSettingsDb();

    expect(getWorkoutPhaseOneSettings(db)).toEqual(WORKOUT_PHASE_ONE_DEFAULTS);
    expect(getWorkoutRecentViews(db)).toEqual([]);
  });

  it('saves and normalizes persisted settings', () => {
    const db = createSettingsDb();

    saveWorkoutPhaseOneSettings(db, {
      ...WORKOUT_PHASE_ONE_DEFAULTS,
      displayName: '  Coach Trey  ',
      tierLabel: '  Alpha Tier ',
      defaultFocus: 'cardio',
      defaultRestSeconds: 120,
      availableEquipment: ['barbell', 'bands', 'bodyweight'],
      gpsTrackingEnabled: false,
    });

    expect(getWorkoutPhaseOneSettings(db)).toMatchObject({
      displayName: 'Coach Trey',
      tierLabel: 'Alpha Tier',
      defaultFocus: 'cardio',
      defaultRestSeconds: 120,
      availableEquipment: ['barbell', 'bands', 'bodyweight'],
      gpsTrackingEnabled: false,
    });
  });

  it('deduplicates recent views and keeps the newest five items', () => {
    const db = createSettingsDb();

    pushWorkoutRecentView(db, {
      id: 'wk-1',
      type: 'workout',
      title: 'Lower Body Power',
      route: '/(workouts)/wk-1',
    });
    pushWorkoutRecentView(db, {
      id: 'wk-2',
      type: 'workout',
      title: 'Upper Pull Strength',
      route: '/(workouts)/wk-2',
    });
    pushWorkoutRecentView(db, {
      id: 'plan-1',
      type: 'program',
      title: 'Hypertrophy Block',
      route: '/(workouts)/program/plan-1',
    });
    pushWorkoutRecentView(db, {
      id: 'ex-1',
      type: 'exercise',
      title: 'Back Squat',
      route: '/(workouts)/exercise/ex-1',
    });
    pushWorkoutRecentView(db, {
      id: 'wk-3',
      type: 'workout',
      title: 'Conditioning Ladder',
      route: '/(workouts)/wk-3',
    });
    pushWorkoutRecentView(db, {
      id: 'wk-1',
      type: 'workout',
      title: 'Lower Body Power',
      route: '/(workouts)/wk-1',
    });

    const recent = getWorkoutRecentViews(db);

    expect(recent).toHaveLength(5);
    expect(recent[0]?.id).toBe('wk-1');
    expect(recent.filter((item) => item.id === 'wk-1')).toHaveLength(1);
  });

  it('clears stored recent views', () => {
    const db = createSettingsDb();

    pushWorkoutRecentView(db, {
      id: 'wk-1',
      type: 'workout',
      title: 'Lower Body Power',
      route: '/(workouts)/wk-1',
    });
    clearWorkoutRecentViews(db);

    expect(getWorkoutRecentViews(db)).toEqual([]);
  });
});
