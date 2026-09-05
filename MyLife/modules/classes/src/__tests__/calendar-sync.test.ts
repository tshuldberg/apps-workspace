import { describe, expect, it } from 'vitest';
import {
  classToICS,
  classesToICS,
  commuteBuffer,
  eventKitPayload,
} from '../engine/calendar-sync';
import type { ClassRow, DayTime, SemesterRow } from '../models/schemas';

function makeSemester(overrides: Partial<SemesterRow> = {}): SemesterRow {
  return {
    id: 'sem-1',
    name: 'Spring 2026',
    start_date: '2026-01-12', // Monday
    end_date: '2026-05-08', // Friday
    institution: 'Test U',
    credit_hours: 0,
    gpa: null,
    is_current: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeClass(
  id: string,
  name: string,
  blocks: DayTime[],
  overrides: Partial<ClassRow> = {},
): ClassRow {
  return {
    id,
    semester_id: 'sem-1',
    name,
    code: null,
    section: null,
    credits: 3,
    day_times: blocks.length > 0 ? JSON.stringify(blocks) : null,
    room: null,
    building: null,
    teacher_id: null,
    category_weights: null,
    current_grade: null,
    target_grade: null,
    color: '#3B82F6',
    notes_md: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('classToICS', () => {
  it('emits a valid VCALENDAR with one VEVENT for a single weekly block', () => {
    const sem = makeSemester();
    const cls = makeClass('c-1', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], { code: 'CS 101', room: '204', building: 'Tech Hall' });
    const ics = classToICS(cls, sem);
    expect(ics).toMatch(/BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR/);
    expect(ics).toMatch(/SUMMARY:CS 101: CS 101/);
    expect(ics).toMatch(/LOCATION:204\\, Tech Hall/);
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260508T235959Z/);
    expect(ics).toMatch(/DTSTART:20260112T090000/);
    expect(ics).toMatch(/DTEND:20260112T100000/);
  });

  it('combines MWF blocks with matching times into a single RRULE', () => {
    const sem = makeSemester();
    const cls = makeClass('c-2', 'MA 201', [
      { day: 'mon', start_time: '11:00', end_time: '11:50' },
      { day: 'wed', start_time: '11:00', end_time: '11:50' },
      { day: 'fri', start_time: '11:00', end_time: '11:50' },
    ]);
    const ics = classToICS(cls, sem);
    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(1);
    expect(ics).toMatch(/BYDAY=MO,WE,FR/);
  });

  it('emits separate VEVENTs when same class has different times on different days', () => {
    const sem = makeSemester();
    const cls = makeClass('c-3', 'PHYS 301', [
      { day: 'tue', start_time: '13:00', end_time: '14:30' },
      { day: 'thu', start_time: '15:00', end_time: '16:30' },
    ]);
    const ics = classToICS(cls, sem);
    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(2);
  });

  it('omits UNTIL when semester has no end_date', () => {
    const sem = makeSemester({ end_date: null });
    const cls = makeClass('c-4', 'BIO 110', [
      { day: 'wed', start_time: '14:00', end_time: '15:00' },
    ]);
    const ics = classToICS(cls, sem);
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=WE/);
    expect(ics).not.toMatch(/UNTIL=/);
  });

  it('returns calendar shell with no VEVENTs when class has no day_times', () => {
    const sem = makeSemester();
    const cls = makeClass('c-5', 'Independent Study', []);
    const ics = classToICS(cls, sem);
    expect(ics).toMatch(/BEGIN:VCALENDAR/);
    expect(ics).not.toMatch(/BEGIN:VEVENT/);
  });

  it('returns calendar shell with no VEVENTs when semester has no start_date', () => {
    const sem = makeSemester({ start_date: null });
    const cls = makeClass('c-6', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ]);
    const ics = classToICS(cls, sem);
    expect(ics).not.toMatch(/BEGIN:VEVENT/);
  });

  it('escapes commas, semicolons, and newlines in description', () => {
    const sem = makeSemester();
    const cls = makeClass('c-7', 'Lit 100', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], { notes_md: 'Reading: Whitman, Dickinson;\nSee syllabus' });
    const ics = classToICS(cls, sem);
    expect(ics).toMatch(/Whitman\\, Dickinson\\;\\nSee syllabus/);
  });
});

describe('classesToICS', () => {
  it('aggregates events from multiple classes into one calendar', () => {
    const sem = makeSemester();
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ]);
    const b = makeClass('b', 'MA 201', [
      { day: 'tue', start_time: '11:00', end_time: '12:00' },
    ]);
    const ics = classesToICS([a, b], sem);
    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(2);
  });
});

describe('eventKitPayload', () => {
  it('returns one payload per recurrence bucket with correct first occurrence', () => {
    // Semester starts Monday 2026-01-12. First Wednesday occurrence is 2026-01-14.
    const sem = makeSemester();
    const cls = makeClass('c-1', 'CS 101', [
      { day: 'wed', start_time: '13:00', end_time: '14:30' },
    ], { room: '204', building: 'Tech Hall' });
    const payloads = eventKitPayload(cls, sem);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      classId: 'c-1',
      title: 'CS 101',
      location: '204, Tech Hall',
      startDate: '2026-01-14T13:00:00',
      endDate: '2026-01-14T14:30:00',
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byDay: ['wed'],
        endDate: '2026-05-08',
      },
    });
  });

  it('rolls forward to first matching weekday past start_date', () => {
    // Start = Mon 2026-01-12; first Friday after = 2026-01-16.
    const sem = makeSemester();
    const cls = makeClass('c-2', 'PHIL 220', [
      { day: 'fri', start_time: '10:00', end_time: '11:00' },
    ]);
    const payloads = eventKitPayload(cls, sem);
    expect(payloads[0].startDate).toBe('2026-01-16T10:00:00');
  });

  it('returns empty array when no day_times', () => {
    expect(eventKitPayload(makeClass('c', 'X', []), makeSemester())).toEqual([]);
  });
});

describe('commuteBuffer', () => {
  it('flags tight gaps when travel exceeds buffer', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], { building: 'Tech Hall' });
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '10:05', end_time: '11:00' },
    ], { building: 'Math Hall' });
    const gaps = commuteBuffer([a, b], { travelMinutes: 10 });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      from_class_id: 'a',
      to_class_id: 'b',
      day: 'mon',
      gap_minutes: 5,
      tight: true,
    });
  });

  it('marks gaps as not tight when travelMinutes met or exceeded', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'tue', start_time: '09:00', end_time: '10:00' },
    ], { building: 'Tech Hall' });
    const b = makeClass('b', 'MA 201', [
      { day: 'tue', start_time: '10:30', end_time: '11:30' },
    ], { building: 'Math Hall' });
    const gaps = commuteBuffer([a, b], { travelMinutes: 15 });
    expect(gaps[0].tight).toBe(false);
    expect(gaps[0].gap_minutes).toBe(30);
  });

  it('skips consecutive blocks in the same room', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'wed', start_time: '09:00', end_time: '10:00' },
    ], { building: 'Tech Hall', room: '204' });
    const b = makeClass('b', 'CS 102', [
      { day: 'wed', start_time: '10:05', end_time: '11:00' },
    ], { building: 'Tech Hall', room: '204' });
    expect(commuteBuffer([a, b], { travelMinutes: 10 })).toHaveLength(0);
  });

  it('emits gaps per day when a class repeats across multiple days', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
      { day: 'wed', start_time: '09:00', end_time: '10:00' },
    ], { building: 'Tech' });
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '10:15', end_time: '11:00' },
      { day: 'wed', start_time: '10:15', end_time: '11:00' },
    ], { building: 'Math' });
    const gaps = commuteBuffer([a, b], { travelMinutes: 20 });
    expect(gaps).toHaveLength(2);
    expect(gaps.map((g) => g.day).sort()).toEqual(['mon', 'wed']);
    expect(gaps.every((g) => g.tight)).toBe(true);
  });

  it('skips negative gaps (overlapping classes are conflicts, not commutes)', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:30' },
    ], { building: 'Tech' });
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '10:00', end_time: '11:00' },
    ], { building: 'Math' });
    expect(commuteBuffer([a, b], { travelMinutes: 10 })).toHaveLength(0);
  });
});
