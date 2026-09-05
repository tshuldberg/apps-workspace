import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { JOURNAL_MODULE } from '../../definition';
import { createJournalEntry } from '../../db/crud';
import {
  addTherapyTopic,
  listTherapyTopicsForEntry,
  reorderTherapyTopics,
  toggleTherapyTopicCompleted,
} from '../../db/therapy';
import {
  getNextSessionNumber,
  getTherapySessionInfo,
  autoPopulateMoodSummary,
  getRecentThoughtRecordCount,
} from '../session-engine';
import { THERAPY_TEMPLATES, getTemplateByType, getTemplateSections, SECTION_LABELS } from '../templates';
import { createThoughtRecord, completeThoughtRecord } from '../../db/cbt';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('journal', JOURNAL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function createTherapyEntry(id: string, sessionNumber: number, entryDate = '2026-03-22'): void {
  createJournalEntry(testDb.adapter, id, {
    body: 'Therapy entry',
    entryDate,
  });
  // Manually set therapy fields via raw SQL since createJournalEntry doesn't set them
  testDb.adapter.execute(
    `UPDATE jn_entries SET entry_type = 'therapy_prep', therapy_session_number = ?, therapy_template_type = 'pre_session' WHERE id = ?`,
    [sessionNumber, id],
  );
}

describe('Session Numbering', () => {
  it('returns 1 for first session', () => {
    expect(getNextSessionNumber(testDb.adapter)).toBe(1);
  });

  it('auto-increments from existing sessions', () => {
    createTherapyEntry('e1', 1, '2026-03-01');
    createTherapyEntry('e2', 2, '2026-03-08');
    createTherapyEntry('e3', 3, '2026-03-15');

    expect(getNextSessionNumber(testDb.adapter)).toBe(4);
  });

  it('handles gaps in session numbers', () => {
    createTherapyEntry('e1', 1, '2026-03-01');
    createTherapyEntry('e2', 5, '2026-03-15');

    expect(getNextSessionNumber(testDb.adapter)).toBe(6);
  });
});

describe('Session Info', () => {
  it('returns null days for first session', () => {
    const info = getTherapySessionInfo(testDb.adapter, '2026-03-22');
    expect(info.sessionNumber).toBe(1);
    expect(info.daysSinceLastSession).toBeNull();
    expect(info.lastSessionDate).toBeNull();
  });

  it('calculates days since last session', () => {
    createTherapyEntry('e1', 1, '2026-03-08');

    const info = getTherapySessionInfo(testDb.adapter, '2026-03-22');
    expect(info.sessionNumber).toBe(2);
    expect(info.daysSinceLastSession).toBe(14);
    expect(info.lastSessionDate).toBe('2026-03-08');
  });
});

describe('Mood Auto-Population', () => {
  it('returns empty for no mood entries', () => {
    const result = autoPopulateMoodSummary(testDb.adapter, null);
    expect(result.averageMood).toBeNull();
    expect(result.distribution).toEqual({});
  });

  it('summarizes mood distribution since last session', () => {
    createJournalEntry(testDb.adapter, 'e1', {
      body: 'Good day', entryDate: '2026-03-20', mood: 'good',
    });
    createJournalEntry(testDb.adapter, 'e2', {
      body: 'Great day', entryDate: '2026-03-21', mood: 'great',
    });
    createJournalEntry(testDb.adapter, 'e3', {
      body: 'Good again', entryDate: '2026-03-22', mood: 'good',
    });

    const result = autoPopulateMoodSummary(testDb.adapter, '2026-03-19');
    expect(result.averageMood).toBe('good');
    expect(result.distribution).toEqual({ good: 2, great: 1 });
  });

  it('uses 14-day lookback when no last session date', () => {
    // Entry older than 14 days should be excluded when lastSessionDate is null
    createJournalEntry(testDb.adapter, 'e1', {
      body: 'Old', entryDate: '2025-01-01', mood: 'low',
    });

    const result = autoPopulateMoodSummary(testDb.adapter, null);
    // The old entry is outside the 14-day window
    expect(result.averageMood).toBeNull();
    expect(result.distribution).toEqual({});
  });
});

describe('Thought Record Count', () => {
  it('returns 0 when no completed records exist', () => {
    expect(getRecentThoughtRecordCount(testDb.adapter, null)).toBe(0);
  });

  it('counts completed records since last session', () => {
    createJournalEntry(testDb.adapter, 'e1', { body: 'test', entryDate: '2026-03-20' });
    createJournalEntry(testDb.adapter, 'e2', { body: 'test', entryDate: '2026-03-21' });

    const r1 = createThoughtRecord(testDb.adapter, 'e1');
    completeThoughtRecord(testDb.adapter, r1.id);

    const r2 = createThoughtRecord(testDb.adapter, 'e2');
    completeThoughtRecord(testDb.adapter, r2.id);

    expect(getRecentThoughtRecordCount(testDb.adapter, '2026-03-19')).toBe(2);
  });
});

describe('Therapy Topics CRUD', () => {
  it('adds topics to therapy entry sections', () => {
    createTherapyEntry('e1', 1);

    addTherapyTopic(testDb.adapter, 'e1', 'topics', 'Discuss relationship', 0);
    addTherapyTopic(testDb.adapter, 'e1', 'topics', 'Work stress', 1);
    addTherapyTopic(testDb.adapter, 'e1', 'wins', 'Meditated 3 days', 0);

    const topics = listTherapyTopicsForEntry(testDb.adapter, 'e1', 'topics');
    expect(topics).toHaveLength(2);
    expect(topics[0].content).toBe('Discuss relationship');

    const allTopics = listTherapyTopicsForEntry(testDb.adapter, 'e1');
    expect(allTopics).toHaveLength(3);
  });

  it('reorders topics within a section', () => {
    createTherapyEntry('e1', 1);

    const t1 = addTherapyTopic(testDb.adapter, 'e1', 'topics', 'First', 0);
    const t2 = addTherapyTopic(testDb.adapter, 'e1', 'topics', 'Second', 1);

    reorderTherapyTopics(testDb.adapter, t1.id, t2.id);

    const topics = listTherapyTopicsForEntry(testDb.adapter, 'e1', 'topics');
    const first = topics.find((t) => t.content === 'First');
    const second = topics.find((t) => t.content === 'Second');
    expect(first?.sortOrder).toBe(1);
    expect(second?.sortOrder).toBe(0);
  });

  it('toggles action item completion', () => {
    createTherapyEntry('e1', 1);
    const topic = addTherapyTopic(testDb.adapter, 'e1', 'action_items', 'Practice breathing', 0);

    expect(topic.isCompleted).toBe(false);

    toggleTherapyTopicCompleted(testDb.adapter, topic.id);

    const topics = listTherapyTopicsForEntry(testDb.adapter, 'e1', 'action_items');
    expect(topics[0].isCompleted).toBe(true);
  });
});

describe('Template Definitions', () => {
  it('has 4 therapy templates', () => {
    expect(THERAPY_TEMPLATES).toHaveLength(4);
  });

  it('maps pre_session to correct sections', () => {
    const sections = getTemplateSections('pre_session');
    expect(sections).toEqual(['topics', 'wins', 'challenges', 'questions']);
  });

  it('maps post_session to correct sections', () => {
    const sections = getTemplateSections('post_session');
    expect(sections).toEqual(['takeaways', 'action_items', 'followup_questions']);
  });

  it('maps crisis_plan to correct sections', () => {
    const sections = getTemplateSections('crisis_plan');
    expect(sections).toEqual(['warning_signs', 'coping_strategies', 'support_contacts', 'safe_actions']);
  });

  it('maps progress_checkin to correct sections', () => {
    const sections = getTemplateSections('progress_checkin');
    expect(sections).toEqual(['original_goals', 'new_goals', 'patterns', 'working', 'not_working']);
  });

  it('retrieves template by type', () => {
    const template = getTemplateByType('pre_session');
    expect(template?.name).toBe('Pre-Session Prep');
  });

  it('has labels for all sections', () => {
    expect(Object.keys(SECTION_LABELS)).toHaveLength(16);
    expect(SECTION_LABELS.topics).toBe('Topics I Want to Discuss');
  });
});

describe('Entry Type - filter by therapy entries', () => {
  it('filters entries by entry_type', () => {
    createJournalEntry(testDb.adapter, 'standard-1', {
      body: 'Normal entry', entryDate: '2026-03-22',
    });
    createTherapyEntry('therapy-1', 1, '2026-03-22');

    const therapyEntries = testDb.adapter.query<{ id: string }>(
      `SELECT id FROM jn_entries WHERE entry_type = 'therapy_prep'`,
    );
    expect(therapyEntries).toHaveLength(1);
    expect(therapyEntries[0].id).toBe('therapy-1');
  });

  it('crisis plan entries have no session number', () => {
    createJournalEntry(testDb.adapter, 'crisis-1', {
      body: 'Crisis plan', entryDate: '2026-03-22',
    });
    testDb.adapter.execute(
      `UPDATE jn_entries SET entry_type = 'therapy_prep', therapy_template_type = 'crisis_plan' WHERE id = ?`,
      ['crisis-1'],
    );

    const entry = testDb.adapter.query<{ therapy_session_number: number | null }>(
      `SELECT therapy_session_number FROM jn_entries WHERE id = 'crisis-1'`,
    )[0];
    expect(entry.therapy_session_number).toBeNull();
  });
});
