import { describe, expect, it } from 'vitest';
import type { DiaryEntryDetail } from '@mylife/meds';
import {
  buildTimeSlots,
  filterDiaryEntries,
  getAutocompleteSuggestions,
  getRefillStatusMeta,
  groupDiaryEntriesByDate,
  groupInteractionsBySeverity,
  normalizeTimeLabel,
} from '../meds/phase2';

const sampleEntry = (
  overrides: Partial<DiaryEntryDetail> = {},
): DiaryEntryDetail => ({
  id: 'entry-1',
  medicationId: 'med-1',
  medicationName: 'Lisinopril',
  dosage: '10 mg',
  doseLogId: null,
  scheduledTime: null,
  actualTime: null,
  doseStatus: null,
  mood: 'good',
  painLevel: 2,
  effectiveness: 4,
  sideEffects: ['Dry mouth'],
  notes: 'Felt stable.',
  recordedAt: '2026-04-07T09:00:00.000Z',
  createdAt: '2026-04-07T09:00:00.000Z',
  updatedAt: '2026-04-07T09:00:00.000Z',
  ...overrides,
});

describe('meds phase 2 helpers', () => {
  it('returns autocomplete suggestions from the local drug library', () => {
    const suggestions = getAutocompleteSuggestions('lis');
    expect(suggestions[0]).toBe('Lisinopril');
  });

  it('builds stable time slots for custom interval schedules', () => {
    expect(buildTimeSlots('twice_daily', 6, [])).toEqual(['08:00', '20:00']);
    expect(buildTimeSlots('every_x_hours', 4, [])).toEqual(['08:00', '12:00', '16:00', '20:00']);
  });

  it('formats refill status tones', () => {
    expect(getRefillStatusMeta(2).label).toBe('Due');
    expect(getRefillStatusMeta(14).label).toBe('OK');
    expect(getRefillStatusMeta(null).label).toBe('Untracked');
  });

  it('groups interaction warnings by severity', () => {
    const grouped = groupInteractionsBySeverity([
      { drug: 'Warfarin', severity: 'severe', description: 'Bleeding risk' },
      { drug: 'Ibuprofen', severity: 'moderate', description: 'GI risk' },
      { drug: 'Alcohol', severity: 'mild', description: 'Drowsiness' },
    ]);

    expect(grouped.severe).toHaveLength(1);
    expect(grouped.moderate).toHaveLength(1);
    expect(grouped.mild).toHaveLength(1);
  });

  it('filters and groups diary entries for the journal screen', () => {
    const entries = [
      sampleEntry(),
      sampleEntry({
        id: 'entry-2',
        medicationName: 'Metformin',
        sideEffects: [],
        effectiveness: 1,
        doseStatus: 'skipped',
        recordedAt: '2026-04-06T09:00:00.000Z',
        createdAt: '2026-04-06T09:00:00.000Z',
        updatedAt: '2026-04-06T09:00:00.000Z',
      }),
    ];

    expect(filterDiaryEntries(entries, 'side_effects', '')).toHaveLength(1);
    expect(filterDiaryEntries(entries, 'missed_doses', '')).toHaveLength(1);
    expect(filterDiaryEntries(entries, 'low_rated', 'met')).toHaveLength(1);
    expect(groupDiaryEntriesByDate(entries)).toHaveLength(2);
  });

  it('formats display-ready time labels', () => {
    expect(normalizeTimeLabel('08:00')).toContain('8:00');
    expect(normalizeTimeLabel('bad')).toBe('bad');
  });
});
