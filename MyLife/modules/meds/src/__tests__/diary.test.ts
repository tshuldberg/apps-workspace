import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended } from '../medication';
import { logDose } from '../reminders';
import {
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntries,
  getDiaryEntryById,
  getDiaryInsights,
  updateDiaryEntry,
} from '../diary';

describe('meds diary', () => {
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

  it('creates diary entries joined to medication and dose log details', () => {
    createMedicationExtended(adapter, 'med-1', {
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'daily',
    });

    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: '2026-04-07T08:00:00.000Z',
      actualTime: '2026-04-07T08:04:00.000Z',
      status: 'taken',
      notes: 'Taken with breakfast',
    });

    createDiaryEntry(adapter, 'entry-1', {
      medicationId: 'med-1',
      doseLogId: 'dose-1',
      mood: 'good',
      painLevel: 2,
      effectiveness: 4,
      sideEffects: ['dry mouth'],
      notes: 'Felt stable after breakfast.',
      recordedAt: '2026-04-07T09:00:00.000Z',
    });

    const entries = getDiaryEntries(adapter);
    expect(entries).toHaveLength(1);
    expect(entries[0].medicationName).toBe('Metformin');
    expect(entries[0].doseStatus).toBe('taken');
    expect(entries[0].sideEffects).toEqual(['dry mouth']);
    expect(entries[0].notes).toContain('stable');
  });

  it('updates and deletes diary entries', () => {
    createMedicationExtended(adapter, 'med-1', { name: 'Lisinopril' });
    createDiaryEntry(adapter, 'entry-1', {
      medicationId: 'med-1',
      mood: 'neutral',
      effectiveness: 3,
    });

    updateDiaryEntry(adapter, 'entry-1', {
      mood: 'good',
      effectiveness: 5,
      sideEffects: ['dry mouth', 'fatigue'],
      notes: 'Improved after lunch.',
    });

    const entry = getDiaryEntryById(adapter, 'entry-1');
    expect(entry).not.toBeNull();
    expect(entry!.mood).toBe('good');
    expect(entry!.effectiveness).toBe(5);
    expect(entry!.sideEffects).toEqual(['dry mouth', 'fatigue']);

    deleteDiaryEntry(adapter, 'entry-1');
    expect(getDiaryEntryById(adapter, 'entry-1')).toBeNull();
  });

  it('computes diary insights from ratings, side effects, and skipped doses', () => {
    createMedicationExtended(adapter, 'med-1', { name: 'Lisinopril' });
    createMedicationExtended(adapter, 'med-2', { name: 'Atorvastatin' });

    logDose(adapter, 'dose-1', {
      medicationId: 'med-1',
      scheduledTime: '2026-04-06T08:00:00.000Z',
      status: 'skipped',
    });

    createDiaryEntry(adapter, 'entry-1', {
      medicationId: 'med-1',
      doseLogId: 'dose-1',
      effectiveness: 2,
      sideEffects: ['headache'],
      notes: 'Missed the morning dose.',
      recordedAt: '2026-04-06T12:00:00.000Z',
    });
    createDiaryEntry(adapter, 'entry-2', {
      medicationId: 'med-2',
      effectiveness: 5,
      sideEffects: ['headache', 'dry mouth'],
      notes: 'Evening check-in.',
      recordedAt: '2026-04-06T20:00:00.000Z',
    });
    createDiaryEntry(adapter, 'entry-3', {
      medicationId: 'med-2',
      effectiveness: 4,
      sideEffects: ['headache'],
      notes: 'Energy stayed steady.',
      recordedAt: '2026-04-07T08:00:00.000Z',
    });

    const insights = getDiaryInsights(adapter);
    expect(insights.entryCount).toBe(3);
    expect(insights.missedDoseCount).toBe(1);
    expect(insights.mostCommonSideEffect).toBe('Headache');
    expect(insights.highestRatedMedication?.name).toBe('Atorvastatin');
    expect(insights.patterns.length).toBeGreaterThan(0);
  });
});
