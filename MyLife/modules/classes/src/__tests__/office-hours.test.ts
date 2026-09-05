import { describe, expect, it } from 'vitest';
import { getUpcomingOfficeHours } from '../engine/office-hours';
import type { ClassRow, DayTime, TeacherRow } from '../models/schemas';

function makeTeacher(
  id: string,
  name: string,
  blocks: DayTime[] | null,
  overrides: Partial<TeacherRow> = {},
): TeacherRow {
  return {
    id,
    name,
    title: null,
    department: null,
    email: null,
    office_location: 'Smith Hall 201',
    office_hours: blocks === null ? null : JSON.stringify(blocks),
    teaching_style_notes: null,
    grading_notes: null,
    rec_potential: null,
    rating: null,
    notes_md: null,
    created_at: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeClass(
  id: string,
  code: string,
  teacherId: string | null,
  overrides: Partial<ClassRow> = {},
): ClassRow {
  return {
    id,
    semester_id: 'sem-1',
    name: code,
    code,
    section: null,
    credits: 3,
    day_times: null,
    room: null,
    building: null,
    teacher_id: teacherId,
    category_weights: null,
    current_grade: null,
    target_grade: null,
    color: '#3B82F6',
    notes_md: null,
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

// Monday 2026-04-20 09:00 (Apr 20 2026 is a Monday).
const MONDAY = new Date(2026, 3, 20, 9, 0, 0);

describe('getUpcomingOfficeHours', () => {
  it('sorts by day-distance then by start_time', () => {
    const t1 = makeTeacher('t1', 'Dr. Aiko', [
      { day: 'wed', start_time: '14:00', end_time: '15:00' },
    ]);
    const t2 = makeTeacher('t2', 'Dr. Bell', [
      { day: 'tue', start_time: '10:00', end_time: '11:00' },
      { day: 'tue', start_time: '15:00', end_time: '16:00' },
    ]);
    const result = getUpcomingOfficeHours([t1, t2], [], MONDAY);
    expect(result.map((r) => `${r.day}-${r.start_time}`)).toEqual([
      'tue-10:00',
      'tue-15:00',
      'wed-14:00',
    ]);
  });

  it('caps at default limit of 5', () => {
    const t1 = makeTeacher('t1', 'Dr. Aiko', [
      { day: 'mon', start_time: '13:00', end_time: '14:00' },
      { day: 'tue', start_time: '10:00', end_time: '11:00' },
      { day: 'wed', start_time: '10:00', end_time: '11:00' },
      { day: 'thu', start_time: '10:00', end_time: '11:00' },
      { day: 'fri', start_time: '10:00', end_time: '11:00' },
      { day: 'sat', start_time: '10:00', end_time: '11:00' },
    ]);
    const result = getUpcomingOfficeHours([t1], [], MONDAY);
    expect(result).toHaveLength(5);
    expect(result[0]?.day).toBe('mon');
    expect(result[4]?.day).toBe('fri');
  });

  it('respects explicit limit', () => {
    const t1 = makeTeacher('t1', 'Dr. Aiko', [
      { day: 'mon', start_time: '13:00', end_time: '14:00' },
      { day: 'tue', start_time: '10:00', end_time: '11:00' },
      { day: 'wed', start_time: '10:00', end_time: '11:00' },
    ]);
    const result = getUpcomingOfficeHours([t1], [], MONDAY, 2);
    expect(result).toHaveLength(2);
  });

  it('wraps around the week (today=mon, block on sun returns days_from_today=6)', () => {
    const t1 = makeTeacher('t1', 'Dr. Aiko', [
      { day: 'sun', start_time: '12:00', end_time: '13:00' },
    ]);
    const result = getUpcomingOfficeHours([t1], [], MONDAY);
    expect(result).toHaveLength(1);
    expect(result[0]?.days_from_today).toBe(6);
  });

  it('past-today block sorts last (after future days)', () => {
    // MONDAY 09:00. Past block on monday = 07:00-08:00.
    const t1 = makeTeacher('t1', 'Past', [
      { day: 'mon', start_time: '07:00', end_time: '08:00' },
    ]);
    const t2 = makeTeacher('t2', 'Future', [
      { day: 'fri', start_time: '10:00', end_time: '11:00' },
    ]);
    const result = getUpcomingOfficeHours([t1, t2], [], MONDAY);
    expect(result.map((r) => r.teacher_name)).toEqual(['Future', 'Past']);
    expect(result[1]?.days_from_today).toBe(7);
  });

  it('today block in progress (start passed, end not) is still today=0', () => {
    // MONDAY 09:00. Block 08:00-10:00 is in progress.
    const t1 = makeTeacher('t1', 'Dr. Now', [
      { day: 'mon', start_time: '08:00', end_time: '10:00' },
    ]);
    const result = getUpcomingOfficeHours([t1], [], MONDAY);
    expect(result).toHaveLength(1);
    expect(result[0]?.days_from_today).toBe(0);
  });

  it('lists all class codes when teacher teaches multiple classes', () => {
    const t1 = makeTeacher('t1', 'Dr. Aiko', [
      { day: 'wed', start_time: '14:00', end_time: '15:00' },
    ]);
    const c1 = makeClass('c1', 'CS 101', 't1');
    const c2 = makeClass('c2', 'CS 201', 't1');
    const c3 = makeClass('c3', 'MA 100', 'tX');
    const result = getUpcomingOfficeHours([t1], [c1, c2, c3], MONDAY);
    expect(result).toHaveLength(1);
    expect(result[0]?.class_codes).toEqual(['CS 101', 'CS 201']);
  });

  it('skips teacher with null office_hours', () => {
    const t1 = makeTeacher('t1', 'No Hours', null);
    const result = getUpcomingOfficeHours([t1], [], MONDAY);
    expect(result).toEqual([]);
  });

  it('skips teacher with empty office_hours array', () => {
    const t1 = makeTeacher('t1', 'Empty Hours', []);
    const result = getUpcomingOfficeHours([t1], [], MONDAY);
    expect(result).toEqual([]);
  });

  it('handles multiple blocks on the same day for one teacher', () => {
    const t1 = makeTeacher('t1', 'Dr. Triple', [
      { day: 'tue', start_time: '15:00', end_time: '16:00' },
      { day: 'tue', start_time: '09:00', end_time: '10:00' },
      { day: 'tue', start_time: '12:00', end_time: '13:00' },
    ]);
    const result = getUpcomingOfficeHours([t1], [], MONDAY);
    expect(result.map((r) => r.start_time)).toEqual(['09:00', '12:00', '15:00']);
  });

  it('falls back to class name when code is null/empty', () => {
    const t1 = makeTeacher('t1', 'Dr. Aiko', [
      { day: 'wed', start_time: '14:00', end_time: '15:00' },
    ]);
    const c1 = makeClass('c1', '', 't1', { code: null, name: 'Intro Bio' });
    const result = getUpcomingOfficeHours([t1], [c1], MONDAY);
    expect(result[0]?.class_codes).toEqual(['Intro Bio']);
  });

  it('returns empty array when no teachers', () => {
    expect(getUpcomingOfficeHours([], [], MONDAY)).toEqual([]);
  });
});
