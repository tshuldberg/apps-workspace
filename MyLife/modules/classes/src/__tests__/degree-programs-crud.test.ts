import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createDegreeProgram,
  deleteDegreeProgram,
  getProgram,
  listPrograms,
  setPrimaryProgram,
  updateDegreeProgram,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('degree-programs CRUD', () => {
  it('round-trips a program with optional fields', () => {
    const row = createDegreeProgram(adapter, 'p-1', {
      name: 'BS Computer Science',
      institution: 'State U',
      degree_type: 'BS',
      total_credits_required: 120,
      gpa_required: 2.0,
      catalog_year: '2024-2025',
      start_date: '2024-08-15',
      expected_completion: '2028-05-15',
      notes_md: '## Notes',
    });

    expect(row.name).toBe('BS Computer Science');
    expect(row.is_primary).toBe(0);
    expect(row.degree_type).toBe('BS');

    const fetched = getProgram(adapter, 'p-1');
    expect(fetched).toMatchObject({
      id: 'p-1',
      institution: 'State U',
      total_credits_required: 120,
      gpa_required: 2.0,
    });
  });

  it('updates scalar fields', () => {
    createDegreeProgram(adapter, 'p-1', {
      name: 'BS CS',
      total_credits_required: 120,
    });

    updateDegreeProgram(adapter, 'p-1', {
      total_credits_required: 124,
      catalog_year: '2026-2027',
    });
    const after = getProgram(adapter, 'p-1');
    expect(after?.total_credits_required).toBe(124);
    expect(after?.catalog_year).toBe('2026-2027');
    expect(after?.updated_at).toBeTruthy();
  });

  it('lists programs with primary pinned to top', () => {
    createDegreeProgram(adapter, 'a', { name: 'A', total_credits_required: 100 });
    createDegreeProgram(adapter, 'b', {
      name: 'B',
      total_credits_required: 100,
      is_primary: true,
    });
    createDegreeProgram(adapter, 'c', { name: 'C', total_credits_required: 100 });

    const all = listPrograms(adapter);
    expect(all[0].id).toBe('b');
    expect(all[0].is_primary).toBe(1);
  });

  it('setPrimaryProgram enforces single-primary invariant', () => {
    createDegreeProgram(adapter, 'a', {
      name: 'A',
      total_credits_required: 100,
      is_primary: true,
    });
    createDegreeProgram(adapter, 'b', { name: 'B', total_credits_required: 100 });
    createDegreeProgram(adapter, 'c', { name: 'C', total_credits_required: 100 });

    setPrimaryProgram(adapter, 'b');
    const all = listPrograms(adapter);
    const primaries = all.filter((p) => p.is_primary === 1).map((p) => p.id);
    expect(primaries).toEqual(['b']);
  });

  it('creating a second is_primary program clears the prior one', () => {
    createDegreeProgram(adapter, 'a', {
      name: 'A',
      total_credits_required: 100,
      is_primary: true,
    });
    createDegreeProgram(adapter, 'b', {
      name: 'B',
      total_credits_required: 100,
      is_primary: true,
    });
    const all = listPrograms(adapter);
    expect(all.filter((p) => p.is_primary === 1).map((p) => p.id)).toEqual(['b']);
  });

  it('deletes a program', () => {
    createDegreeProgram(adapter, 'p-1', {
      name: 'Gone',
      total_credits_required: 60,
    });
    deleteDegreeProgram(adapter, 'p-1');
    expect(getProgram(adapter, 'p-1')).toBeNull();
  });

  it('rejects unknown degree_type via Zod', () => {
    expect(() =>
      createDegreeProgram(adapter, 'bad', {
        name: 'Bad',
        total_credits_required: 60,
        // @ts-expect-error testing runtime validation
        degree_type: 'Doctorate',
      }),
    ).toThrow();
  });

  it('updateDegreeProgram with only is_primary still flips the flag', () => {
    createDegreeProgram(adapter, 'a', { name: 'A', total_credits_required: 100 });
    updateDegreeProgram(adapter, 'a', { is_primary: true });
    expect(getProgram(adapter, 'a')?.is_primary).toBe(1);
  });
});
