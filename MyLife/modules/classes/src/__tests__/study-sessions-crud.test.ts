import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createClass,
  createSemester,
  createStudySession,
  deleteStudySession,
  getLocationStats,
  getStreakInfo,
  getStudySession,
  getSubjectTimeAllocation,
  getWeeklySummary,
  listStudySessionsByClass,
  listStudySessionsByDateRange,
  updateStudySession,
} from '../db';
import type { StudySessionRow } from '../models/schemas';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
  createSemester(adapter, 'sem-1', { name: 'Fall 2026' });
  createClass(adapter, 'c-cs', { semester_id: 'sem-1', name: 'CS 101', credits: 4 });
  createClass(adapter, 'c-ma', { semester_id: 'sem-1', name: 'MA 201', credits: 3 });
});

afterEach(() => close());

describe('study-sessions CRUD', () => {
  it('round-trips a created study session with arrays serialized', () => {
    const row = createStudySession(adapter, 's-1', {
      class_id: 'c-cs',
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 50,
      location: 'Library',
      productivity_rating: 4,
      focus_notes: 'Deep work block',
      companion_ids: ['p-1', 'p-2'],
      topics_covered: ['recursion', 'big-O'],
      timer_type: 'pomodoro',
      pomodoro_count: 2,
    });

    expect(row.timer_type).toBe('pomodoro');
    expect(row.pomodoro_count).toBe(2);
    const fetched = getStudySession(adapter, 's-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.companion_ids).toBe(JSON.stringify(['p-1', 'p-2']));
    expect(fetched?.topics_covered).toBe(JSON.stringify(['recursion', 'big-O']));
  });

  it('defaults timer_type to freeform and pomodoro_count to 0', () => {
    const row = createStudySession(adapter, 's-2', {
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 30,
    });
    expect(row.timer_type).toBe('freeform');
    expect(row.pomodoro_count).toBe(0);
    expect(row.class_id).toBeNull();
  });

  it('updates fields including array re-serialization', () => {
    createStudySession(adapter, 's-1', {
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 30,
    });
    updateStudySession(adapter, 's-1', {
      duration_minutes: 60,
      location: 'Cafe',
      topics_covered: ['hashing'],
    });
    const row = getStudySession(adapter, 's-1');
    expect(row?.duration_minutes).toBe(60);
    expect(row?.location).toBe('Cafe');
    expect(row?.topics_covered).toBe(JSON.stringify(['hashing']));
  });

  it('deletes a study session', () => {
    createStudySession(adapter, 's-1', {
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 30,
    });
    deleteStudySession(adapter, 's-1');
    expect(getStudySession(adapter, 's-1')).toBeNull();
  });

  it('lists sessions by class with optional limit, newest first', () => {
    createStudySession(adapter, 's-a', {
      class_id: 'c-cs',
      started_at: '2026-04-18T10:00:00.000Z',
      duration_minutes: 30,
    });
    createStudySession(adapter, 's-b', {
      class_id: 'c-cs',
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 30,
    });
    createStudySession(adapter, 's-c', {
      class_id: 'c-ma',
      started_at: '2026-04-19T10:00:00.000Z',
      duration_minutes: 30,
    });

    const csRows = listStudySessionsByClass(adapter, 'c-cs');
    expect(csRows.map((r) => r.id)).toEqual(['s-b', 's-a']);

    const limited = listStudySessionsByClass(adapter, 'c-cs', 1);
    expect(limited.map((r) => r.id)).toEqual(['s-b']);
  });

  it('lists sessions in a [start,end) date range', () => {
    createStudySession(adapter, 's-a', {
      started_at: '2026-04-18T23:59:00.000Z',
      duration_minutes: 30,
    });
    createStudySession(adapter, 's-b', {
      started_at: '2026-04-19T00:00:00.000Z',
      duration_minutes: 30,
    });
    createStudySession(adapter, 's-c', {
      started_at: '2026-04-20T00:00:00.000Z',
      duration_minutes: 30,
    });

    const rows = listStudySessionsByDateRange(
      adapter,
      '2026-04-19T00:00:00.000Z',
      '2026-04-20T00:00:00.000Z',
    );
    expect(rows.map((r) => r.id)).toEqual(['s-b']);
  });

  it('preserves a study session when its class is deleted (SET NULL)', () => {
    createStudySession(adapter, 's-1', {
      class_id: 'c-cs',
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 30,
    });
    adapter.execute(`DELETE FROM cs_classes WHERE id = ?`, ['c-cs']);
    const row = getStudySession(adapter, 's-1');
    expect(row?.class_id).toBeNull();
  });
});

describe('getWeeklySummary', () => {
  it('returns zero-state for a quiet week', () => {
    const summary = getWeeklySummary(adapter, '2026-04-13');
    expect(summary).toEqual({
      total_hours: 0,
      by_class: [],
      avg_productivity: null,
      study_days: 0,
      streak: 0,
    });
  });

  it('aggregates hours across multiple classes with percent shares', () => {
    createStudySession(adapter, 's-1', {
      class_id: 'c-cs',
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 60,
      productivity_rating: 4,
    });
    createStudySession(adapter, 's-2', {
      class_id: 'c-cs',
      started_at: '2026-04-21T10:00:00.000Z',
      duration_minutes: 30,
      productivity_rating: 5,
    });
    createStudySession(adapter, 's-3', {
      class_id: 'c-ma',
      started_at: '2026-04-22T10:00:00.000Z',
      duration_minutes: 30,
      productivity_rating: 3,
    });

    const summary = getWeeklySummary(adapter, '2026-04-20');
    expect(summary.total_hours).toBeCloseTo(2, 5);
    expect(summary.by_class[0].class_id).toBe('c-cs');
    expect(summary.by_class[0].hours).toBeCloseTo(1.5, 5);
    expect(summary.by_class[0].percent).toBeCloseTo(75, 5);
    expect(summary.avg_productivity).toBeCloseTo(4, 5);
    expect(summary.study_days).toBe(3);
    expect(summary.streak).toBe(3);
  });

  it('counts a weekend gap as broken streak inside the week', () => {
    createStudySession(adapter, 's-1', {
      started_at: '2026-04-20T10:00:00.000Z',
      duration_minutes: 30,
    });
    createStudySession(adapter, 's-2', {
      started_at: '2026-04-22T10:00:00.000Z',
      duration_minutes: 30,
    });
    const summary = getWeeklySummary(adapter, '2026-04-20');
    expect(summary.study_days).toBe(2);
    // Streak ends at the latest day (Apr 22) and the prior day (Apr 21) is missing,
    // so the consecutive run is 1.
    expect(summary.streak).toBe(1);
  });
});

describe('getSubjectTimeAllocation', () => {
  it('compares actual vs credit-weighted target', () => {
    const sessions = [
      {
        class_id: 'c-cs',
        duration_minutes: 60,
      } as unknown as StudySessionRow,
      {
        class_id: 'c-ma',
        duration_minutes: 60,
      } as unknown as StudySessionRow,
    ];
    const allocation = getSubjectTimeAllocation(
      [
        { id: 'c-cs', credits: 4 },
        { id: 'c-ma', credits: 3 },
      ],
      sessions,
    );
    const cs = allocation.find((a) => a.class_id === 'c-cs');
    const ma = allocation.find((a) => a.class_id === 'c-ma');
    expect(cs?.target_percent).toBeCloseTo((4 / 7) * 100, 5);
    expect(cs?.actual_percent).toBeCloseTo(50, 5);
    expect(cs?.delta_percent).toBeCloseTo(50 - (4 / 7) * 100, 5);
    expect(ma?.actual_hours).toBeCloseTo(1, 5);
  });

  it('returns 0% targets when no credits exist', () => {
    const allocation = getSubjectTimeAllocation([{ id: 'c-cs', credits: 0 }], []);
    expect(allocation[0].target_percent).toBe(0);
    expect(allocation[0].actual_percent).toBe(0);
  });
});

describe('getLocationStats', () => {
  it('ranks locations by total hours and averages productivity', () => {
    const sessions: StudySessionRow[] = [
      {
        id: 's-1',
        class_id: null,
        started_at: '2026-04-20T10:00:00.000Z',
        duration_minutes: 60,
        location: 'Library',
        productivity_rating: 5,
        focus_notes: null,
        companion_ids: null,
        topics_covered: null,
        timer_type: 'freeform',
        pomodoro_count: 0,
        created_at: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 's-2',
        class_id: null,
        started_at: '2026-04-20T10:00:00.000Z',
        duration_minutes: 30,
        location: 'Library',
        productivity_rating: 3,
        focus_notes: null,
        companion_ids: null,
        topics_covered: null,
        timer_type: 'freeform',
        pomodoro_count: 0,
        created_at: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 's-3',
        class_id: null,
        started_at: '2026-04-20T10:00:00.000Z',
        duration_minutes: 45,
        location: 'Cafe',
        productivity_rating: null,
        focus_notes: null,
        companion_ids: null,
        topics_covered: null,
        timer_type: 'freeform',
        pomodoro_count: 0,
        created_at: '2026-04-20T10:00:00.000Z',
      },
    ];
    const stats = getLocationStats(sessions);
    expect(stats[0].location).toBe('Library');
    expect(stats[0].total_hours).toBeCloseTo(1.5, 5);
    expect(stats[0].avg_productivity).toBe(4);
    expect(stats[1].location).toBe('Cafe');
    expect(stats[1].avg_productivity).toBeNull();
  });
});

describe('getStreakInfo', () => {
  function s(id: string, started: string): StudySessionRow {
    return {
      id,
      class_id: null,
      started_at: started,
      duration_minutes: 30,
      location: null,
      productivity_rating: null,
      focus_notes: null,
      companion_ids: null,
      topics_covered: null,
      timer_type: 'freeform',
      pomodoro_count: 0,
      created_at: started,
    };
  }

  it('returns zero streaks with no sessions', () => {
    expect(getStreakInfo([])).toEqual({
      current_streak_days: 0,
      longest_streak_days: 0,
      last_study_date: null,
    });
  });

  it('counts current streak when last study day is today', () => {
    const today = '2026-04-20';
    const info = getStreakInfo(
      [
        s('a', '2026-04-18T10:00:00.000Z'),
        s('b', '2026-04-19T10:00:00.000Z'),
        s('c', '2026-04-20T10:00:00.000Z'),
      ],
      today,
    );
    expect(info.current_streak_days).toBe(3);
    expect(info.longest_streak_days).toBe(3);
    expect(info.last_study_date).toBe('2026-04-20');
  });

  it('counts current streak when last study day is yesterday', () => {
    const today = '2026-04-20';
    const info = getStreakInfo(
      [
        s('a', '2026-04-18T10:00:00.000Z'),
        s('b', '2026-04-19T10:00:00.000Z'),
      ],
      today,
    );
    expect(info.current_streak_days).toBe(2);
    expect(info.last_study_date).toBe('2026-04-19');
  });

  it('returns zero current streak when last study day is older than yesterday', () => {
    const today = '2026-04-20';
    const info = getStreakInfo([s('a', '2026-04-15T10:00:00.000Z')], today);
    expect(info.current_streak_days).toBe(0);
    expect(info.longest_streak_days).toBe(1);
  });

  it('reports longest streak independent of current streak', () => {
    const today = '2026-04-20';
    const info = getStreakInfo(
      [
        s('a', '2026-04-10T10:00:00.000Z'),
        s('b', '2026-04-11T10:00:00.000Z'),
        s('c', '2026-04-12T10:00:00.000Z'),
        s('d', '2026-04-13T10:00:00.000Z'),
        s('e', '2026-04-19T10:00:00.000Z'),
        s('f', '2026-04-20T10:00:00.000Z'),
      ],
      today,
    );
    expect(info.current_streak_days).toBe(2);
    expect(info.longest_streak_days).toBe(4);
  });
});
