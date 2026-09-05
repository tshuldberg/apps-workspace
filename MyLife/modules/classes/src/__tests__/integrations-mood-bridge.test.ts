import { describe, expect, it } from 'vitest';
import {
  correlateMoodWithEvents,
  getAcademicEventsInRange,
  summarizeAcademicMoodInsight,
  type AcademicEvent,
} from '../integrations/mood-bridge';

const classes = [{ id: 'c1', name: 'Algorithms', code: 'CS 401' }];

describe('getAcademicEventsInRange', () => {
  it('returns class markers when no assignments', () => {
    const events = getAcademicEventsInRange(
      [],
      classes,
      '2026-04-01',
      '2026-04-30',
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('class');
  });

  it('emits due + grade_release events within window', () => {
    const events = getAcademicEventsInRange(
      [
        {
          title: 'Midterm',
          type: 'exam',
          due_at: '2026-04-10T00:00:00.000Z',
          graded_at: '2026-04-15T00:00:00.000Z',
          class_id: 'c1',
        },
      ],
      [],
      '2026-04-01',
      '2026-04-30',
    );
    expect(events.find((e) => e.kind === 'exam')).toBeDefined();
    expect(events.find((e) => e.kind === 'grade_release')).toBeDefined();
  });

  it('excludes events outside the window', () => {
    const events = getAcademicEventsInRange(
      [
        {
          title: 'Old HW',
          type: 'homework',
          due_at: '2025-01-01T00:00:00.000Z',
          graded_at: null,
          class_id: 'c1',
        },
      ],
      [],
      '2026-04-01',
      '2026-04-30',
    );
    expect(events).toHaveLength(0);
  });
});

describe('correlateMoodWithEvents', () => {
  const events: AcademicEvent[] = [
    { date: '2026-04-10', kind: 'due', title: 'HW', classId: 'c1' },
  ];

  it('returns null/0 with no data', () => {
    const r = correlateMoodWithEvents([], []);
    expect(r.n).toBe(0);
    expect(r.avg_mood_pre_event).toBeNull();
  });

  it('averages pre/post mood within 2-day window', () => {
    const r = correlateMoodWithEvents(events, [
      { date: '2026-04-09', score: 3 }, // pre (1 day before)
      { date: '2026-04-08', score: 5 }, // pre (2 days before)
      { date: '2026-04-11', score: 7 }, // post
      { date: '2026-04-12', score: 9 }, // post
    ]);
    expect(r.avg_mood_pre_event).toBeCloseTo(4);
    expect(r.avg_mood_post_event).toBeCloseTo(8);
    expect(r.n).toBe(1);
  });
});

describe('summarizeAcademicMoodInsight', () => {
  it('prompts for more data when n<5', () => {
    expect(
      summarizeAcademicMoodInsight({
        avg_mood_pre_event: 5,
        avg_mood_post_event: 6,
        n: 2,
      }),
    ).toContain('Log more moods');
  });

  it('reports a drop when delta is negative', () => {
    const text = summarizeAcademicMoodInsight({
      avg_mood_pre_event: 7,
      avg_mood_post_event: 5,
      n: 5,
    });
    expect(text).toMatch(/drops/);
  });

  it('reports steady when delta < 0.25', () => {
    expect(
      summarizeAcademicMoodInsight({
        avg_mood_pre_event: 5,
        avg_mood_post_event: 5.1,
        n: 6,
      }),
    ).toContain('steady');
  });
});
