import { describe, expect, it } from 'vitest';
import type { ClassRow, DayTime, SemesterRow } from '@mylife/classes';
import {
  firstWeekdayOnOrAfter,
  mapClassToManhattanEvents,
} from '../classes-bridge';

// Semester starts on a Monday (2026-01-05 is a Monday).
const semester: SemesterRow = {
  id: 'sem-1',
  name: 'Spring 2026',
  start_date: '2026-01-05',
  end_date: '2026-05-15',
  institution: 'NYU',
  credit_hours: 15,
  gpa: null,
  is_current: 1,
  created_at: '2026-01-01T00:00:00Z',
};

// Two distinct time buckets:
//  - Mon/Wed 10:00-11:15  -> earliest day Monday  -> first date 2026-01-05
//  - Friday  14:00-15:30  -> first date 2026-01-09
const dayTimes: DayTime[] = [
  { day: 'mon', start_time: '10:00', end_time: '11:15' },
  { day: 'wed', start_time: '10:00', end_time: '11:15' },
  { day: 'fri', start_time: '14:00', end_time: '15:30' },
];

const cls: ClassRow = {
  id: 'cls-42',
  semester_id: 'sem-1',
  name: 'Linear Algebra',
  code: 'MATH-201',
  section: '001',
  credits: 4,
  day_times: JSON.stringify(dayTimes),
  room: '305',
  building: 'Silver Center',
  teacher_id: null,
  category_weights: null,
  current_grade: null,
  target_grade: null,
  color: '#FFB877',
  notes_md: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('firstWeekdayOnOrAfter', () => {
  it('returns the same date when the weekday already matches', () => {
    // 2026-01-05 is a Monday.
    expect(firstWeekdayOnOrAfter('2026-01-05', 'mon')).toBe('2026-01-05');
  });

  it('rolls forward to the next matching weekday', () => {
    expect(firstWeekdayOnOrAfter('2026-01-05', 'fri')).toBe('2026-01-09');
    expect(firstWeekdayOnOrAfter('2026-01-05', 'sun')).toBe('2026-01-11');
  });

  it('accepts a full ISO date and only uses the date portion', () => {
    expect(firstWeekdayOnOrAfter('2026-01-05T23:30:00Z', 'wed')).toBe('2026-01-07');
  });
});

describe('mapClassToManhattanEvents', () => {
  it('produces one EventInput per start_time|end_time bucket', () => {
    const events = mapClassToManhattanEvents(cls, semester);
    expect(events).toHaveLength(2);
  });

  it('anchors each bucket to the first occurrence at the bucket time (floating local)', () => {
    const events = mapClassToManhattanEvents(cls, semester);
    const byTitleTime = events.map((e) => ({
      startAt: e.startAt,
      endAt: e.endAt,
    }));
    // Mon/Wed bucket -> earliest day Monday 2026-01-05.
    expect(byTitleTime).toContainEqual({
      startAt: '2026-01-05T10:00:00',
      endAt: '2026-01-05T11:15:00',
    });
    // Friday bucket -> 2026-01-09.
    expect(byTitleTime).toContainEqual({
      startAt: '2026-01-09T14:00:00',
      endAt: '2026-01-09T15:30:00',
    });
    // No timezone suffix (floating local).
    for (const e of events) {
      expect(e.startAt).not.toMatch(/[zZ]|[+-]\d\d:\d\d$/);
      expect(e.endAt).not.toMatch(/[zZ]|[+-]\d\d:\d\d$/);
    }
  });

  it('sets sourceId, category, title, venueName, and saved correctly', () => {
    const events = mapClassToManhattanEvents(cls, semester);
    for (const e of events) {
      expect(e.sourceId).toBe('classes');
      expect(e.category).toBe('Education/Class');
      expect(e.title).toBe('Linear Algebra');
      expect(e.venueName).toBe('Silver Center 305');
      expect(e.saved).toBe(true);
    }
  });

  it('emits stable externalIds keyed by class, earliest day, and start_time', () => {
    const events = mapClassToManhattanEvents(cls, semester);
    const ids = events.map((e) => e.externalId).sort();
    expect(ids).toEqual([
      'class-cls-42-fri-14:00',
      'class-cls-42-mon-10:00',
    ]);
    // Re-running yields identical ids (deterministic, no timestamps).
    const again = mapClassToManhattanEvents(cls, semester).map(
      (e) => e.externalId,
    );
    expect(again.sort()).toEqual(ids);
  });

  it('returns [] when the class has no day_times', () => {
    expect(
      mapClassToManhattanEvents({ ...cls, day_times: null }, semester),
    ).toEqual([]);
  });

  it('returns [] when the semester has no start_date', () => {
    expect(
      mapClassToManhattanEvents(cls, { ...semester, start_date: null }),
    ).toEqual([]);
  });
});
