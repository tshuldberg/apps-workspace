import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { medsCrossModule } from '../cross-module';

const NOW = new Date('2026-07-04T15:00:00.000Z');

describe('meds getTodayCards', () => {
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

  it('returns no cards when nothing is scheduled today', () => {
    expect(medsCrossModule.getTodayCards!(adapter, { now: NOW })).toEqual([]);
  });

  it('surfaces pending doses as a reminder card', () => {
    adapter.execute(
      `INSERT INTO md_medications (id, name, dosage) VALUES ('m1', 'Creatine', '5 g')`,
    );
    adapter.execute(
      `INSERT INTO md_reminders (id, medication_id, time) VALUES ('rem1', 'm1', '09:00')`,
    );

    const cards = medsCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('reminder');
    expect(cards[0]!.title).toBe('1 dose left today');
    expect(cards[0]!.subtitle).toContain('Creatine');
    expect(cards[0]!.moduleId).toBe('meds');
    expect(cards[0]!.cta?.route).toBe('/meds/medications');
  });

  it('boosts priority when the next dose is overdue', () => {
    adapter.execute(
      `INSERT INTO md_medications (id, name) VALUES ('m1', 'Creatine')`,
    );
    adapter.execute(
      `INSERT INTO md_reminders (id, medication_id, time) VALUES ('rem1', 'm1', '00:05')`,
    );

    const cards = medsCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards[0]!.priority).toBe(85);
  });
});
