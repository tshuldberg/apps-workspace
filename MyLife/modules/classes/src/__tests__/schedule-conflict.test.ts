import { describe, expect, it } from 'vitest';
import { detectConflicts } from '../engine/schedule-conflict';
import type { ClassRow, DayTime } from '../models/schemas';

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
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('detectConflicts', () => {
  it('returns no conflicts when classes do not overlap', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ]);
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '10:00', end_time: '11:00' },
      { day: 'tue', start_time: '09:00', end_time: '10:00' },
    ]);
    expect(detectConflicts([a, b])).toHaveLength(0);
  });

  it('flags partial overlap with the correct overlap minutes', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:30' },
    ]);
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '10:00', end_time: '11:00' },
    ]);
    const conflicts = detectConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      day: 'mon',
      overlap_minutes: 30,
    });
    expect(conflicts[0].a.id).toBe('a');
    expect(conflicts[0].b.id).toBe('b');
  });

  it('flags identical time blocks with full overlap', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'wed', start_time: '13:00', end_time: '14:30' },
    ]);
    const b = makeClass('b', 'PHIL 220', [
      { day: 'wed', start_time: '13:00', end_time: '14:30' },
    ]);
    const conflicts = detectConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlap_minutes).toBe(90);
  });

  it('emits one conflict per overlapping day for multi-day classes', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
      { day: 'wed', start_time: '09:00', end_time: '10:00' },
      { day: 'fri', start_time: '09:00', end_time: '10:00' },
    ]);
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '09:30', end_time: '10:30' },
      { day: 'wed', start_time: '09:30', end_time: '10:30' },
      { day: 'thu', start_time: '09:00', end_time: '10:00' },
    ]);
    const conflicts = detectConflicts([a, b]);
    expect(conflicts).toHaveLength(2);
    const days = conflicts.map((c) => c.day).sort();
    expect(days).toEqual(['mon', 'wed']);
    expect(conflicts.every((c) => c.overlap_minutes === 30)).toBe(true);
  });

  it('handles classes with no day_times gracefully', () => {
    const a = makeClass('a', 'CS 101', []);
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ]);
    expect(detectConflicts([a, b])).toHaveLength(0);
  });

  it('does not flag back-to-back classes that meet at exact endpoint', () => {
    const a = makeClass('a', 'CS 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ]);
    const b = makeClass('b', 'MA 201', [
      { day: 'mon', start_time: '10:00', end_time: '11:00' },
    ]);
    expect(detectConflicts([a, b])).toHaveLength(0);
  });
});
