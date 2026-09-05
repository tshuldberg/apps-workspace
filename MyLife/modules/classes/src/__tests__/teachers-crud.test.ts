import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createClass,
  createSemester,
  createTeacher,
  deleteTeacher,
  getTeacher,
  getTeacherByClass,
  listTeachers,
  updateTeacher,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('teachers CRUD', () => {
  it('round-trips a teacher with serialized office hours', () => {
    const created = createTeacher(adapter, 't-1', {
      name: 'Dr. Smith',
      title: 'Professor',
      department: 'Computer Science',
      email: 'smith@example.edu',
      office_location: 'Building A 312',
      office_hours: [
        { day: 'mon', start_time: '14:00', end_time: '16:00' },
        { day: 'wed', start_time: '14:00', end_time: '16:00' },
      ],
      rating: 5,
      rec_potential: 1,
      teaching_style_notes: 'Lectures fast',
    });

    expect(created.id).toBe('t-1');
    expect(created.name).toBe('Dr. Smith');
    const fetched = getTeacher(adapter, 't-1');
    expect(fetched?.email).toBe('smith@example.edu');
    expect(fetched?.rating).toBe(5);
    expect(JSON.parse(fetched!.office_hours!)).toHaveLength(2);
  });

  it('lists teachers alphabetically', () => {
    createTeacher(adapter, '1', { name: 'Zelda Vance' });
    createTeacher(adapter, '2', { name: 'alice baker' });
    createTeacher(adapter, '3', { name: 'Maya Chen' });

    const all = listTeachers(adapter);
    expect(all.map((t) => t.name)).toEqual(['alice baker', 'Maya Chen', 'Zelda Vance']);
  });

  it('updates teacher fields including office_hours', () => {
    createTeacher(adapter, 't-1', { name: 'Dr. A' });
    updateTeacher(adapter, 't-1', {
      grading_notes: 'Generous with partial credit',
      office_hours: [{ day: 'fri', start_time: '10:00', end_time: '11:00' }],
      rating: 4,
    });

    const row = getTeacher(adapter, 't-1');
    expect(row?.grading_notes).toBe('Generous with partial credit');
    expect(row?.rating).toBe(4);
    expect(JSON.parse(row!.office_hours!)).toEqual([
      { day: 'fri', start_time: '10:00', end_time: '11:00' },
    ]);
  });

  it('deletes a teacher and nulls related class references', () => {
    createSemester(adapter, 's-1', { name: 'Fall 2026' });
    createTeacher(adapter, 't-1', { name: 'Dr. A' });
    createClass(adapter, 'c-1', { semester_id: 's-1', name: 'CS 101', teacher_id: 't-1' });

    deleteTeacher(adapter, 't-1');
    expect(getTeacher(adapter, 't-1')).toBeNull();

    const cls = adapter.query<{ teacher_id: string | null }>(
      `SELECT teacher_id FROM cs_classes WHERE id = 'c-1'`,
    );
    expect(cls[0].teacher_id).toBeNull();
  });

  describe('getByClass', () => {
    it('returns the teacher attached to a class', () => {
      createSemester(adapter, 's-1', { name: 'Fall 2026' });
      createTeacher(adapter, 't-1', { name: 'Dr. A' });
      createClass(adapter, 'c-1', { semester_id: 's-1', name: 'CS 101', teacher_id: 't-1' });

      const teacher = getTeacherByClass(adapter, 'c-1');
      expect(teacher?.id).toBe('t-1');
      expect(teacher?.name).toBe('Dr. A');
    });

    it('returns null when the class has no teacher', () => {
      createSemester(adapter, 's-1', { name: 'Fall 2026' });
      createClass(adapter, 'c-1', { semester_id: 's-1', name: 'CS 101' });
      expect(getTeacherByClass(adapter, 'c-1')).toBeNull();
    });
  });
});
