import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createDegreeProgram,
  createRequirement,
  deleteDegreeProgram,
  deleteRequirement,
  getRequirement,
  listRequirementsByProgram,
  updateRequirement,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
  createDegreeProgram(adapter, 'p-1', {
    name: 'BS CS',
    total_credits_required: 120,
  });
});

afterEach(() => close());

describe('requirements CRUD', () => {
  it('round-trips a requirement with allowed_course_codes serialized', () => {
    const row = createRequirement(adapter, 'r-1', {
      program_id: 'p-1',
      name: 'Major core',
      category: 'major',
      credits_required: 30,
      course_count_required: 10,
      min_grade: 'C',
      allowed_course_codes: ['CS-101', 'CS-2*'],
      sort_order: 1,
    });

    expect(row.name).toBe('Major core');
    expect(row.allowed_course_codes).toBe(JSON.stringify(['CS-101', 'CS-2*']));

    const fetched = getRequirement(adapter, 'r-1');
    expect(fetched?.category).toBe('major');
    expect(fetched?.min_grade).toBe('C');
  });

  it('updates fields and re-serializes allowed_course_codes', () => {
    createRequirement(adapter, 'r-1', { program_id: 'p-1', name: 'X' });
    updateRequirement(adapter, 'r-1', {
      name: 'Y',
      credits_required: 9,
      allowed_course_codes: ['MATH-2*'],
    });
    const row = getRequirement(adapter, 'r-1');
    expect(row?.name).toBe('Y');
    expect(row?.credits_required).toBe(9);
    expect(row?.allowed_course_codes).toBe(JSON.stringify(['MATH-2*']));
  });

  it('lists requirements ordered by sort_order then created_at', () => {
    createRequirement(adapter, 'r-3', {
      program_id: 'p-1',
      name: 'C',
      sort_order: 3,
    });
    createRequirement(adapter, 'r-1', {
      program_id: 'p-1',
      name: 'A',
      sort_order: 1,
    });
    createRequirement(adapter, 'r-2', {
      program_id: 'p-1',
      name: 'B',
      sort_order: 2,
    });

    const rows = listRequirementsByProgram(adapter, 'p-1');
    expect(rows.map((r) => r.id)).toEqual(['r-1', 'r-2', 'r-3']);
  });

  it('cascades delete when parent program is removed', () => {
    createRequirement(adapter, 'r-1', { program_id: 'p-1', name: 'A' });
    deleteDegreeProgram(adapter, 'p-1');
    expect(getRequirement(adapter, 'r-1')).toBeNull();
  });

  it('deletes a single requirement', () => {
    createRequirement(adapter, 'r-1', { program_id: 'p-1', name: 'A' });
    deleteRequirement(adapter, 'r-1');
    expect(getRequirement(adapter, 'r-1')).toBeNull();
  });

  it('rejects unknown category via Zod', () => {
    expect(() =>
      createRequirement(adapter, 'bad', {
        program_id: 'p-1',
        name: 'Bad',
        // @ts-expect-error testing runtime validation
        category: 'wishful',
      }),
    ).toThrow();
  });

  it('clears allowed_course_codes when set to null', () => {
    createRequirement(adapter, 'r-1', {
      program_id: 'p-1',
      name: 'X',
      allowed_course_codes: ['CS-101'],
    });
    updateRequirement(adapter, 'r-1', { allowed_course_codes: null });
    expect(getRequirement(adapter, 'r-1')?.allowed_course_codes).toBeNull();
  });
});
