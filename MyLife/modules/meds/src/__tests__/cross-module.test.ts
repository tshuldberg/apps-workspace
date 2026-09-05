import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended } from '../medication/crud';
import { logDose } from '../reminders/scheduler';
import { recordRefill } from '../medication/refill-tracker';
import { createMoodEntry } from '../mood/check-in';
import {
  getSearchableContent,
  getDataSummary,
  getActivityFeed,
  getCorrelationData,
} from '../cross-module';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function createTestMed(
  db: DatabaseAdapter,
  id: string,
  overrides: Partial<Parameters<typeof createMedicationExtended>[2]> = {},
): void {
  createMedicationExtended(db, id, {
    name: 'Test Med',
    frequency: 'daily',
    ...overrides,
  });
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ---------------------------------------------------------------------------
// getSearchableContent
// ---------------------------------------------------------------------------

describe('getSearchableContent', () => {
  it('returns empty array for empty database', () => {
    const items = getSearchableContent(adapter);
    expect(items).toEqual([]);
  });

  it('returns medications as searchable items', () => {
    createTestMed(adapter, 'med-1', {
      name: 'Lisinopril',
      dosage: '10',
      unit: 'mg',
      prescriber: 'Dr. Smith',
      pharmacy: 'CVS',
      instructions: 'Take with food',
    });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(1);

    const med = items[0];
    expect(med.moduleId).toBe('meds');
    expect(med.type).toBe('medication');
    expect(med.title).toBe('Lisinopril');
    expect(med.body).toBe('10 mg - Take with food');
    expect(med.tags).toContain('Dr. Smith');
    expect(med.tags).toContain('CVS');
    expect(med.tags).toContain('daily');
    expect(med.tags).toContain('active');
    expect(med.itemId).toBe('med-1');
  });

  it('includes notes in body text', () => {
    createTestMed(adapter, 'med-1', {
      name: 'Metformin',
      notes: 'Check blood sugar before dose',
    });

    const items = getSearchableContent(adapter);
    expect(items[0].body).toContain('Check blood sugar before dose');
  });

  it('handles medication with minimal fields', () => {
    createTestMed(adapter, 'med-1', { name: 'Aspirin' });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Aspirin');
    // With only frequency and active tag
    expect(items[0].tags).toEqual(['daily', 'active']);
  });

  it('returns multiple medications', () => {
    createTestMed(adapter, 'med-1', { name: 'Med A' });
    createTestMed(adapter, 'med-2', { name: 'Med B' });
    createTestMed(adapter, 'med-3', { name: 'Med C' });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getDataSummary
// ---------------------------------------------------------------------------

describe('getDataSummary', () => {
  it('returns zeros for empty database', () => {
    const summary = getDataSummary(adapter);
    expect(summary.moduleId).toBe('meds');
    expect(summary.totalItems).toBe(0);
    expect(summary.stats.activeMedications).toBe(0);
    expect(summary.stats.adherenceRate).toBe(0);
    expect(summary.stats.refillNeeded).toBe(0);
  });

  it('counts total and active medications', () => {
    createTestMed(adapter, 'med-1', { name: 'Active Med' });
    createTestMed(adapter, 'med-2', { name: 'Inactive Med' });
    // Deactivate med-2
    adapter.execute(
      `UPDATE md_medications SET is_active = 0 WHERE id = 'med-2'`,
    );

    const summary = getDataSummary(adapter);
    expect(summary.totalItems).toBe(2);
    expect(summary.stats.activeMedications).toBe(1);
  });

  it('calculates adherence rate from dose logs', () => {
    createTestMed(adapter, 'med-1', { name: 'Med' });

    const now = new Date().toISOString();
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: now,
      status: 'taken',
    });
    logDose(adapter, 'dose-2', {
      medicationId: 'med-1',
      scheduledTime: now,
      status: 'skipped',
    });

    const summary = getDataSummary(adapter);
    expect(summary.stats.adherenceRate).toBe(50);
  });

  it('counts medications needing refill', () => {
    createTestMed(adapter, 'med-1', {
      name: 'Low Supply',
      pillCount: 3,
      pillsPerDose: 1,
      frequency: 'daily',
    });
    createTestMed(adapter, 'med-2', {
      name: 'Good Supply',
      pillCount: 100,
      pillsPerDose: 1,
      frequency: 'daily',
    });

    const summary = getDataSummary(adapter);
    expect(summary.stats.refillNeeded).toBe(1);
  });

  it('includes lastActivity from dose logs', () => {
    createTestMed(adapter, 'med-1', { name: 'Med' });
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'taken',
    });

    const summary = getDataSummary(adapter);
    expect(summary.lastActivity).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getActivityFeed
// ---------------------------------------------------------------------------

describe('getActivityFeed', () => {
  it('returns empty array for empty database', () => {
    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items).toEqual([]);
  });

  it('returns taken doses as completed activities', () => {
    createTestMed(adapter, 'med-1', { name: 'Lisinopril' });
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'taken',
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const completed = items.filter((i) => i.action === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].description).toBe('Took Lisinopril');
    expect(completed[0].itemType).toBe('medication');
  });

  it('returns late doses as completed with note', () => {
    createTestMed(adapter, 'med-1', { name: 'Metformin' });
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'late',
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const completed = items.filter((i) => i.action === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].description).toBe('Took Metformin (late)');
  });

  it('returns skipped doses as skipped activities', () => {
    createTestMed(adapter, 'med-1', { name: 'Aspirin' });
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'skipped',
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const skipped = items.filter((i) => i.action === 'skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].description).toBe('Skipped Aspirin');
  });

  it('excludes snoozed doses', () => {
    createTestMed(adapter, 'med-1', { name: 'Med' });
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'snoozed',
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items).toHaveLength(0);
  });

  it('returns refill events', () => {
    createTestMed(adapter, 'med-1', { name: 'Lisinopril' });
    recordRefill(adapter, 'refill-1', {
      medicationId: 'med-1',
      quantity: 30,
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const refills = items.filter((i) => i.action === 'refilled');
    expect(refills).toHaveLength(1);
    expect(refills[0].description).toBe('Refilled Lisinopril (30 pills)');
  });

  it('filters out activities before since date', () => {
    createTestMed(adapter, 'med-1', { name: 'Med' });
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'taken',
    });

    const items = getActivityFeed(adapter, new Date('2099-01-01'));
    expect(items).toHaveLength(0);
  });

  it('sorts activities by timestamp descending', () => {
    createTestMed(adapter, 'med-1', { name: 'Med A' });
    createTestMed(adapter, 'med-2', { name: 'Med B' });

    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: new Date().toISOString(),
      status: 'taken',
    });
    logDose(adapter, 'dose-2', {
      medicationId: 'med-2',
      scheduledTime: new Date().toISOString(),
      status: 'taken',
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].timestamp >= items[i].timestamp).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getCorrelationData
// ---------------------------------------------------------------------------

describe('getCorrelationData', () => {
  it('returns empty series for empty database', () => {
    const dataset = getCorrelationData(adapter);
    expect(dataset.moduleId).toBe('meds');
    expect(dataset.series).toHaveLength(3);
    expect(dataset.series[0].metric).toBe('adherence_rate');
    expect(dataset.series[0].data).toEqual([]);
    expect(dataset.series[1].metric).toBe('mood_intensity');
    expect(dataset.series[1].data).toEqual([]);
    expect(dataset.series[2].metric).toBe('mood_valence');
    expect(dataset.series[2].data).toEqual([]);
  });

  it('returns daily adherence data points', () => {
    createTestMed(adapter, 'med-1', { name: 'Med' });

    const today = new Date().toISOString();
    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: today,
      status: 'taken',
    });
    logDose(adapter, 'dose-2', {
      medicationId: 'med-1',
      scheduledTime: today,
      status: 'skipped',
    });

    const dataset = getCorrelationData(adapter);
    const adherenceSeries = dataset.series.find((s) => s.metric === 'adherence_rate');
    expect(adherenceSeries).toBeDefined();
    expect(adherenceSeries!.data.length).toBeGreaterThanOrEqual(1);
    // 1 taken out of 2 = 50%
    expect(adherenceSeries!.data[0].value).toBe(50);
    expect(adherenceSeries!.unit).toBe('%');
  });

  it('returns mood intensity data points', () => {
    createMoodEntry(adapter, 'mood-1', {
      mood: 'happy',
      energyLevel: 'high',
      pleasantness: 'pleasant',
      intensity: 4,
    });

    const dataset = getCorrelationData(adapter);
    const moodSeries = dataset.series.find((s) => s.metric === 'mood_intensity');
    expect(moodSeries).toBeDefined();
    expect(moodSeries!.data.length).toBeGreaterThanOrEqual(1);
    expect(moodSeries!.data[0].value).toBe(4);
  });

  it('returns mood valence data points', () => {
    createMoodEntry(adapter, 'mood-1', {
      mood: 'happy',
      energyLevel: 'high',
      pleasantness: 'pleasant',
      intensity: 3,
    });

    const dataset = getCorrelationData(adapter);
    const valenceSeries = dataset.series.find((s) => s.metric === 'mood_valence');
    expect(valenceSeries).toBeDefined();
    expect(valenceSeries!.data.length).toBeGreaterThanOrEqual(1);
    // pleasant maps to 1.0, normalized to (1+1)*50 = 100
    expect(valenceSeries!.data[0].value).toBe(100);
  });

  it('normalizes unpleasant valence', () => {
    createMoodEntry(adapter, 'mood-1', {
      mood: 'anxious',
      energyLevel: 'high',
      pleasantness: 'unpleasant',
      intensity: 3,
    });

    const dataset = getCorrelationData(adapter);
    const valenceSeries = dataset.series.find((s) => s.metric === 'mood_valence');
    // unpleasant maps to -1.0, normalized to (-1+1)*50 = 0
    expect(valenceSeries!.data[0].value).toBe(0);
  });

  it('averages multiple mood entries on same day', () => {
    createMoodEntry(adapter, 'mood-1', {
      mood: 'happy',
      energyLevel: 'high',
      pleasantness: 'pleasant',
      intensity: 5,
    });
    createMoodEntry(adapter, 'mood-2', {
      mood: 'calm',
      energyLevel: 'low',
      pleasantness: 'pleasant',
      intensity: 3,
    });

    const dataset = getCorrelationData(adapter);
    const moodSeries = dataset.series.find((s) => s.metric === 'mood_intensity');
    expect(moodSeries!.data.length).toBe(1);
    expect(moodSeries!.data[0].value).toBe(4); // avg of 5 and 3
  });

  it('has correct series metadata', () => {
    const dataset = getCorrelationData(adapter);
    expect(dataset.series[0]).toMatchObject({
      metric: 'adherence_rate',
      label: 'Daily Adherence',
      unit: '%',
    });
    expect(dataset.series[1]).toMatchObject({
      metric: 'mood_intensity',
      label: 'Mood Intensity',
      unit: 'level',
    });
    expect(dataset.series[2]).toMatchObject({
      metric: 'mood_valence',
      label: 'Mood Valence',
      unit: 'score',
    });
  });
});

// ---------------------------------------------------------------------------
// Definition wiring
// ---------------------------------------------------------------------------

describe('medsCrossModule via definition', () => {
  it('is wired into MEDS_MODULE.crossModule', () => {
    expect(MEDS_MODULE.crossModule).toBeDefined();
    expect(MEDS_MODULE.crossModule!.getSearchableContent).toBeTypeOf('function');
    expect(MEDS_MODULE.crossModule!.getDataSummary).toBeTypeOf('function');
    expect(MEDS_MODULE.crossModule!.getActivityFeed).toBeTypeOf('function');
    expect(MEDS_MODULE.crossModule!.getCorrelationData).toBeTypeOf('function');
  });

  it('works through the crossModule interface', () => {
    createTestMed(adapter, 'med-1', { name: 'Aspirin' });

    const items = MEDS_MODULE.crossModule!.getSearchableContent!(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Aspirin');

    const summary = MEDS_MODULE.crossModule!.getDataSummary!(adapter);
    expect(summary.totalItems).toBe(1);

    const dataset = MEDS_MODULE.crossModule!.getCorrelationData!(adapter);
    expect(dataset.moduleId).toBe('meds');
    expect(dataset.series).toHaveLength(3);
  });
});
