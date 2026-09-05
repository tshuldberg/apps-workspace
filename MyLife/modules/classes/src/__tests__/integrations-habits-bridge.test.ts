import { describe, expect, it } from 'vitest';
import {
  suggestClassHabits,
  summarizeStudyStreak,
} from '../integrations/habits-bridge';
import type { StudySessionRow } from '../models/schemas';

function session(startedAt: string): StudySessionRow {
  return {
    id: `s-${startedAt}`,
    class_id: 'c1',
    started_at: startedAt,
    duration_minutes: 60,
    location: null,
    productivity_rating: null,
    focus_notes: null,
    companion_ids: null,
    topics_covered: null,
    timer_type: 'freeform',
    pomodoro_count: 0,
    created_at: startedAt,
  };
}

describe('suggestClassHabits', () => {
  it('always returns universal study + attendance habits', () => {
    const habits = suggestClassHabits([]);
    expect(habits).toHaveLength(2);
    expect(habits.find((h) => h.name === 'Study daily')?.frequency).toBe('daily');
    expect(habits.find((h) => h.name === 'Attend all classes')?.frequency).toBe(
      'class_days',
    );
  });

  it('appends a Read habit per class with code preference', () => {
    const habits = suggestClassHabits([
      { id: 'c1', name: 'Algorithms', code: 'CS 401' },
      { id: 'c2', name: 'Music Theory', code: null },
    ]);
    const reads = habits.filter((h) => h.name.startsWith('Read for'));
    expect(reads).toHaveLength(2);
    expect(reads[0].name).toBe('Read for CS 401');
    expect(reads[0].classId).toBe('c1');
    expect(reads[1].name).toBe('Read for Music Theory');
  });
});

describe('summarizeStudyStreak', () => {
  it('returns zero streak on empty sessions', () => {
    const r = summarizeStudyStreak([], '2026-04-20');
    expect(r.current_streak_days).toBe(0);
    expect(r.longest_streak_days).toBe(0);
    expect(r.last_study_date).toBeNull();
  });

  it('counts a 3-day streak ending today', () => {
    const r = summarizeStudyStreak(
      [
        session('2026-04-18T10:00:00.000Z'),
        session('2026-04-19T10:00:00.000Z'),
        session('2026-04-20T10:00:00.000Z'),
      ],
      '2026-04-20',
    );
    expect(r.current_streak_days).toBe(3);
    expect(r.last_study_date).toBe('2026-04-20');
  });

  it('current streak is 0 if last session > 1 day ago', () => {
    const r = summarizeStudyStreak(
      [session('2026-04-15T10:00:00.000Z')],
      '2026-04-20',
    );
    expect(r.current_streak_days).toBe(0);
    expect(r.longest_streak_days).toBe(1);
  });
});
