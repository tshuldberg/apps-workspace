import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createClass,
  createDegreeProgram,
  createRequirement,
  createRequirementSatisfaction,
  createSemester,
  deleteClass,
  deleteRequirement,
  deleteRequirementSatisfaction,
  getRequirementSatisfaction,
  listSatisfactionsByClass,
  listSatisfactionsByRequirement,
  updateRequirementSatisfaction,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
  createSemester(adapter, 'sem-1', { name: 'F26' });
  createClass(adapter, 'c-1', { semester_id: 'sem-1', name: 'CS 101', credits: 3 });
  createClass(adapter, 'c-2', { semester_id: 'sem-1', name: 'CS 201', credits: 4 });
  createDegreeProgram(adapter, 'p-1', { name: 'BS CS', total_credits_required: 120 });
  createRequirement(adapter, 'r-1', { program_id: 'p-1', name: 'Major' });
  createRequirement(adapter, 'r-2', { program_id: 'p-1', name: 'Elective' });
});

afterEach(() => close());

describe('requirement-satisfactions CRUD', () => {
  it('round-trips a satisfaction with defaults', () => {
    const row = createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    expect(row.status).toBe('planned');
    expect(getRequirementSatisfaction(adapter, 's-1')).toMatchObject({
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
  });

  it('updates status and approved_by', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    updateRequirementSatisfaction(adapter, 's-1', {
      status: 'completed',
      approved_by: 'Dr. Lee, 2026-04-20',
    });
    const row = getRequirementSatisfaction(adapter, 's-1');
    expect(row?.status).toBe('completed');
    expect(row?.approved_by).toBe('Dr. Lee, 2026-04-20');
  });

  it('enforces UNIQUE(requirement_id, class_id)', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    expect(() =>
      createRequirementSatisfaction(adapter, 's-2', {
        requirement_id: 'r-1',
        class_id: 'c-1',
        credits_applied: 3,
      }),
    ).toThrow();
  });

  it('allows the same class to satisfy a different requirement (double-count)', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    const second = createRequirementSatisfaction(adapter, 's-2', {
      requirement_id: 'r-2',
      class_id: 'c-1',
      credits_applied: 3,
    });
    expect(second.id).toBe('s-2');
  });

  it('cascades delete when the requirement is removed', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    deleteRequirement(adapter, 'r-1');
    expect(getRequirementSatisfaction(adapter, 's-1')).toBeNull();
  });

  it('cascades delete when the class is removed', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    deleteClass(adapter, 'c-1');
    expect(getRequirementSatisfaction(adapter, 's-1')).toBeNull();
  });

  it('lists satisfactions by requirement and by class', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    createRequirementSatisfaction(adapter, 's-2', {
      requirement_id: 'r-1',
      class_id: 'c-2',
      credits_applied: 4,
    });
    createRequirementSatisfaction(adapter, 's-3', {
      requirement_id: 'r-2',
      class_id: 'c-1',
      credits_applied: 3,
    });

    expect(listSatisfactionsByRequirement(adapter, 'r-1').map((s) => s.id)).toEqual([
      's-1',
      's-2',
    ]);
    expect(listSatisfactionsByClass(adapter, 'c-1').map((s) => s.id)).toEqual([
      's-1',
      's-3',
    ]);
  });

  it('deletes a single satisfaction', () => {
    createRequirementSatisfaction(adapter, 's-1', {
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    deleteRequirementSatisfaction(adapter, 's-1');
    expect(getRequirementSatisfaction(adapter, 's-1')).toBeNull();
  });
});
