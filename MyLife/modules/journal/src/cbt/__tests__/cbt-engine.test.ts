import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { JOURNAL_MODULE } from '../../definition';
import { createJournalEntry, deleteJournalEntry } from '../../db/crud';
import {
  createThoughtRecord,
  getThoughtRecordById,
  listThoughtRecordsForEntry,
  updateThoughtRecordStep,
  completeThoughtRecord,
  addEmotions,
  updateEmotionAfter,
  listEmotionsForRecord,
  addDistortions,
  listDistortionsForRecord,
  getDistortionFrequency,
} from '../../db/cbt';
import {
  calculateEmotionalImpact,
  calculateBeliefReduction,
  computeDistortionFrequency,
  isValidDistortionType,
} from '../cbt-engine';
import { COGNITIVE_DISTORTIONS, getDistortionByType } from '../distortions';
import type { RecordEmotion } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('journal', JOURNAL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function createTestEntry(id = 'entry-1'): void {
  createJournalEntry(testDb.adapter, id, {
    body: 'Test entry for CBT',
    entryDate: '2026-03-22',
  });
}

describe('Thought Record CRUD', () => {
  it('creates a draft thought record linked to an entry', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');

    expect(record.entryId).toBe('entry-1');
    expect(record.status).toBe('draft');
    expect(record.currentStep).toBe(1);
    expect(record.situation).toBeNull();
  });

  it('saves draft at step 3 for later resumption', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');

    updateThoughtRecordStep(testDb.adapter, record.id, 3, {
      situation: 'Meeting at work',
      automaticThought: 'Everyone thinks I am incompetent',
      thoughtBeliefBefore: 85,
    });

    const updated = getThoughtRecordById(testDb.adapter, record.id);
    expect(updated?.currentStep).toBe(3);
    expect(updated?.status).toBe('draft');
    expect(updated?.situation).toBe('Meeting at work');
    expect(updated?.thoughtBeliefBefore).toBe(85);
  });

  it('resumes draft at the saved step', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');
    updateThoughtRecordStep(testDb.adapter, record.id, 3, {
      situation: 'A situation',
    });

    const draft = getThoughtRecordById(testDb.adapter, record.id);
    expect(draft?.currentStep).toBe(3);
    expect(draft?.situation).toBe('A situation');
  });

  it('completes a thought record', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');

    updateThoughtRecordStep(testDb.adapter, record.id, 5, {
      situation: 'Test situation',
      rationalResponse: 'A balanced perspective',
    });

    const completed = completeThoughtRecord(testDb.adapter, record.id);
    expect(completed?.status).toBe('complete');
    expect(completed?.currentStep).toBe(6);
  });

  it('supports multiple thought records per entry', () => {
    createTestEntry();
    createThoughtRecord(testDb.adapter, 'entry-1');
    createThoughtRecord(testDb.adapter, 'entry-1');

    const records = listThoughtRecordsForEntry(testDb.adapter, 'entry-1');
    expect(records).toHaveLength(2);
  });

  it('cascade deletes thought records when entry is deleted', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');
    addEmotions(testDb.adapter, record.id, [{ name: 'anxious', intensityBefore: 80 }]);
    addDistortions(testDb.adapter, record.id, ['all_or_nothing']);

    deleteJournalEntry(testDb.adapter, 'entry-1');

    expect(getThoughtRecordById(testDb.adapter, record.id)).toBeNull();
    expect(listEmotionsForRecord(testDb.adapter, record.id)).toHaveLength(0);
    expect(listDistortionsForRecord(testDb.adapter, record.id)).toHaveLength(0);
  });
});

describe('Emotions CRUD', () => {
  it('adds emotions with intensity values', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');

    const emotions = addEmotions(testDb.adapter, record.id, [
      { name: 'anxious', intensityBefore: 80 },
      { name: 'sad', intensityBefore: 60 },
      { name: 'frustrated', intensityBefore: 70 },
    ]);

    expect(emotions).toHaveLength(3);
    expect(emotions.map((e) => e.emotionName).sort()).toEqual(['anxious', 'frustrated', 'sad']);
  });

  it('stores custom emotion names', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');

    const emotions = addEmotions(testDb.adapter, record.id, [
      { name: 'overwhelmed', intensityBefore: 90 },
    ]);

    expect(emotions[0].emotionName).toBe('overwhelmed');
  });

  it('updates emotion intensity after values', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');
    const emotions = addEmotions(testDb.adapter, record.id, [
      { name: 'anxious', intensityBefore: 80 },
    ]);

    updateEmotionAfter(testDb.adapter, emotions[0].id, 30);

    const updated = listEmotionsForRecord(testDb.adapter, record.id);
    expect(updated[0].intensityAfter).toBe(30);
  });
});

describe('Distortions CRUD', () => {
  it('adds distortions to a thought record', () => {
    createTestEntry();
    const record = createThoughtRecord(testDb.adapter, 'entry-1');

    const distortions = addDistortions(testDb.adapter, record.id, [
      'all_or_nothing',
      'labeling',
    ]);

    expect(distortions).toHaveLength(2);
  });

  it('computes distortion frequency across completed records', () => {
    createTestEntry();
    createTestEntry('entry-2');

    const r1 = createThoughtRecord(testDb.adapter, 'entry-1');
    addDistortions(testDb.adapter, r1.id, ['all_or_nothing', 'labeling']);
    completeThoughtRecord(testDb.adapter, r1.id);

    const r2 = createThoughtRecord(testDb.adapter, 'entry-2');
    addDistortions(testDb.adapter, r2.id, ['all_or_nothing', 'mind_reading']);
    completeThoughtRecord(testDb.adapter, r2.id);

    const freq = getDistortionFrequency(testDb.adapter);
    expect(freq[0].distortionType).toBe('all_or_nothing');
    expect(freq[0].count).toBe(2);
    expect(freq).toHaveLength(3);
  });
});

describe('CBT Engine - calculateEmotionalImpact', () => {
  it('calculates average reduction across emotions', () => {
    const emotions: RecordEmotion[] = [
      { id: '1', thoughtRecordId: 'tr-1', emotionName: 'anxious', intensityBefore: 80, intensityAfter: 40 },
      { id: '2', thoughtRecordId: 'tr-1', emotionName: 'sad', intensityBefore: 60, intensityAfter: 20 },
    ];

    const impact = calculateEmotionalImpact(emotions);
    expect(impact.averageReduction).toBe(40);
    expect(impact.emotions).toHaveLength(2);
  });

  it('handles emotions without after values', () => {
    const emotions: RecordEmotion[] = [
      { id: '1', thoughtRecordId: 'tr-1', emotionName: 'anxious', intensityBefore: 80, intensityAfter: null },
    ];

    const impact = calculateEmotionalImpact(emotions);
    expect(impact.averageReduction).toBe(0);
    expect(impact.emotions[0].reduction).toBeNull();
  });

  it('handles empty emotions array', () => {
    const impact = calculateEmotionalImpact([]);
    expect(impact.averageReduction).toBe(0);
    expect(impact.emotions).toHaveLength(0);
  });
});

describe('CBT Engine - calculateBeliefReduction', () => {
  it('calculates belief reduction', () => {
    expect(calculateBeliefReduction(90, 40)).toBe(50);
  });

  it('returns null when before is null', () => {
    expect(calculateBeliefReduction(null, 40)).toBeNull();
  });

  it('returns null when after is null', () => {
    expect(calculateBeliefReduction(90, null)).toBeNull();
  });

  it('handles no reduction', () => {
    expect(calculateBeliefReduction(50, 50)).toBe(0);
  });

  it('handles negative reduction (belief increased)', () => {
    expect(calculateBeliefReduction(40, 60)).toBe(-20);
  });
});

describe('CBT Engine - computeDistortionFrequency', () => {
  it('ranks distortions by frequency', () => {
    const types = [
      'all_or_nothing' as const,
      'all_or_nothing' as const,
      'all_or_nothing' as const,
      'labeling' as const,
      'labeling' as const,
    ];
    const freq = computeDistortionFrequency(types);
    expect(freq[0]).toEqual({ distortionType: 'all_or_nothing', count: 3 });
    expect(freq[1]).toEqual({ distortionType: 'labeling', count: 2 });
  });

  it('returns empty array for no distortions', () => {
    expect(computeDistortionFrequency([])).toEqual([]);
  });
});

describe('CBT Engine - isValidDistortionType', () => {
  it('accepts valid distortion types', () => {
    expect(isValidDistortionType('all_or_nothing')).toBe(true);
    expect(isValidDistortionType('labeling')).toBe(true);
    expect(isValidDistortionType('fallacy_of_fairness')).toBe(true);
  });

  it('rejects invalid types', () => {
    expect(isValidDistortionType('invalid_type')).toBe(false);
    expect(isValidDistortionType('')).toBe(false);
  });
});

describe('Distortion Definitions', () => {
  it('has 15 cognitive distortions defined', () => {
    expect(COGNITIVE_DISTORTIONS).toHaveLength(15);
  });

  it('retrieves a distortion by type', () => {
    const d = getDistortionByType('all_or_nothing');
    expect(d?.name).toBe('All-or-Nothing Thinking');
    expect(d?.description).toBeTruthy();
    expect(d?.example).toBeTruthy();
  });

  it('returns undefined for unknown type', () => {
    expect(getDistortionByType('nonexistent' as any)).toBeUndefined();
  });
});
