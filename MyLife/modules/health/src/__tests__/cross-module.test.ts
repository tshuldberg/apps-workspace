import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { HEALTH_MODULE } from '../definition';
import { getTodayCards } from '../cross-module';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('health', HEALTH_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

const morning = new Date('2026-04-18T07:30:00.000Z');
const afternoon = new Date('2026-04-18T18:00:00.000Z');

function context(now: Date = morning) {
  return { now };
}

describe('getTodayCards (health)', () => {
  it('returns empty array on empty database', () => {
    const cards = getTodayCards(testDb.adapter, context());
    expect(cards).toEqual([]);
  });

  it('returns next-vital-due card at priority 60 in the morning', () => {
    // Seed an earlier vital so the user has a "streak" but nothing today.
    testDb.adapter.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('v-1', 'heart_rate', 70, 'bpm', 'manual', '2026-04-15T08:00:00.000Z')`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    const vital = cards.find((c) => c.id === 'health.vital.next-due');
    expect(vital).toBeDefined();
    expect(vital!.kind).toBe('reminder');
    expect(vital!.priority).toBe(60);
    expect(vital!.cta?.route).toBe('/health/measurement-log');
  });

  it('drops priority of next-vital-due to 40 in the afternoon', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('v-1', 'heart_rate', 70, 'bpm', 'manual', '2026-04-15T08:00:00.000Z')`,
    );

    const cards = getTodayCards(testDb.adapter, context(afternoon));
    const vital = cards.find((c) => c.id === 'health.vital.next-due');
    expect(vital?.priority).toBe(40);
  });

  it('hides next-vital-due when a vital was already logged today', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('v-1', 'heart_rate', 70, 'bpm', 'manual', '2026-04-18T05:00:00.000Z')`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    expect(cards.find((c) => c.id === 'health.vital.next-due')).toBeUndefined();
  });

  it('returns sleep-debt card when last sleep is below default 480 minute target', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('s-1', '2026-04-17T22:00:00.000Z', '2026-04-18T05:30:00.000Z', 420, 'manual')`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    const sleep = cards.find((c) => c.id === 'health.sleep.debt');
    expect(sleep).toBeDefined();
    expect(sleep!.kind).toBe('insight');
    expect(sleep!.title).toContain('60 min');
  });

  it('hides sleep-debt card when last sleep meets the target', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('s-1', '2026-04-17T22:00:00.000Z', '2026-04-18T06:30:00.000Z', 510, 'manual')`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    expect(cards.find((c) => c.id === 'health.sleep.debt')).toBeUndefined();
  });

  it('returns readiness card when a score exists for today', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_readiness_scores
         (id, date, score, sleep_factor, hrv_factor, rhr_factor,
          activity_factor, strain_factor, recommendation, data_completeness)
       VALUES ('r-1', '2026-04-18', 78, 0.8, 0.7, 0.9, 0.6, 0.5, 'Train hard', 0.95)`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    const readiness = cards.find((c) => c.id === 'health.readiness.today');
    expect(readiness).toBeDefined();
    expect(readiness!.kind).toBe('progress');
    expect(readiness!.title).toContain('78');
    expect(readiness!.subtitle).toBe('Train hard');
  });

  it('caps at 3 cards and never exceeds priority 100', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('v-1', 'heart_rate', 70, 'bpm', 'manual', '2026-04-15T08:00:00.000Z')`,
    );
    testDb.adapter.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('s-1', '2026-04-17T22:00:00.000Z', '2026-04-18T05:30:00.000Z', 420, 'manual')`,
    );
    testDb.adapter.execute(
      `INSERT INTO hl_readiness_scores
         (id, date, score, sleep_factor, hrv_factor, rhr_factor,
          activity_factor, strain_factor, recommendation, data_completeness)
       VALUES ('r-1', '2026-04-18', 78, 0.8, 0.7, 0.9, 0.6, 0.5, 'Train hard', 0.95)`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    expect(cards.length).toBeLessThanOrEqual(3);
    for (const card of cards) {
      expect(card.priority).toBeLessThanOrEqual(100);
      expect(card.priority).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects the sleep target stored in hl_settings', () => {
    testDb.adapter.execute(
      `UPDATE hl_settings SET value = '6' WHERE key = 'sleep.targetHours'`,
    );
    testDb.adapter.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('s-1', '2026-04-17T23:00:00.000Z', '2026-04-18T05:30:00.000Z', 390, 'manual')`,
    );

    const cards = getTodayCards(testDb.adapter, context(morning));
    // Target 360 (6h), actual 390 -> no debt
    expect(cards.find((c) => c.id === 'health.sleep.debt')).toBeUndefined();
  });
});

describe('crossModule wiring', () => {
  it('is wired into HEALTH_MODULE.crossModule', () => {
    expect(HEALTH_MODULE.crossModule).toBeDefined();
    expect(HEALTH_MODULE.crossModule!.getTodayCards).toBeTypeOf('function');
  });

  it('works through the crossModule interface', () => {
    testDb.adapter.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('v-1', 'heart_rate', 70, 'bpm', 'manual', '2026-04-15T08:00:00.000Z')`,
    );

    const cards = HEALTH_MODULE.crossModule!.getTodayCards!(
      testDb.adapter,
      { now: morning },
    );
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].moduleId).toBe('health');
  });
});
