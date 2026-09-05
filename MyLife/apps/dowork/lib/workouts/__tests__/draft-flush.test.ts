import { describe, expect, it } from 'vitest';
import {
  resolveDraftSetFlush,
  type DraftFlushArgs,
  type DraftFlushDraft,
} from '../draft-flush';

function statusWith(
  overrides: Partial<DraftFlushArgs['status']> = {},
): DraftFlushArgs['status'] {
  return {
    state: 'playing',
    currentExerciseIndex: 0,
    currentSet: 2,
    exercises: [{ exercise_id: 'bench', reps: 8 }],
    ...overrides,
  };
}

function draftLookup(
  drafts: Record<string, DraftFlushDraft>,
): DraftFlushArgs['getDraft'] {
  return (exerciseId, setNumber) => drafts[`${exerciseId}:${setNumber}`];
}

describe('resolveDraftSetFlush', () => {
  it('flushes a mid-set draft with typed weight and reps', () => {
    const result = resolveDraftSetFlush({
      status: statusWith(),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: '135', reps: '5' } }),
    });
    expect(result).toEqual({ exerciseId: 'bench', setNumber: 2, weight: 135, reps: 5 });
  });

  it('uses the programmed reps when the draft supplies weight but no reps value', () => {
    // Matches session.tsx: reps resolves as `draft.reps ?? exercise.reps ?? 0`.
    // A draft carrying a weight but an undefined reps field falls through to
    // the exercise's programmed reps. weight has no fallback.
    const result = resolveDraftSetFlush({
      status: statusWith({ exercises: [{ exercise_id: 'bench', reps: 8 }] }),
      completedSets: [],
      getDraft: () => ({ weight: '100', reps: undefined as unknown as string }),
    });
    expect(result).toEqual({ exerciseId: 'bench', setNumber: 2, weight: 100, reps: 8 });
  });

  it('treats a blank reps field as omitted and falls back to the programmed reps', () => {
    // A user who typed a weight but left the reps field blank should not lose
    // the whole set; a blank reps field counts as omitted and falls back to the
    // exercise's programmed reps (BH-1: do not silently drop a logged set).
    const result = resolveDraftSetFlush({
      status: statusWith({ exercises: [{ exercise_id: 'bench', reps: 8 }] }),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: '100', reps: '' } }),
    });
    expect(result).toEqual({ exerciseId: 'bench', setNumber: 2, weight: 100, reps: 8 });
  });

  it('skips a blank-reps draft when the exercise has no programmed reps either', () => {
    const result = resolveDraftSetFlush({
      status: statusWith({ exercises: [{ exercise_id: 'plank', reps: null }] }),
      completedSets: [],
      getDraft: draftLookup({ 'plank:2': { weight: '100', reps: '' } }),
    });
    expect(result).toBeNull();
  });

  it('does not double-write a set already recorded via Mark Complete', () => {
    const result = resolveDraftSetFlush({
      status: statusWith(),
      completedSets: [{ exerciseId: 'bench', setNumber: 2 }],
      getDraft: draftLookup({ 'bench:2': { weight: '135', reps: '5' } }),
    });
    expect(result).toBeNull();
  });

  it('still flushes when a different set of the same exercise was recorded', () => {
    const result = resolveDraftSetFlush({
      status: statusWith({ currentSet: 3 }),
      completedSets: [{ exerciseId: 'bench', setNumber: 2 }],
      getDraft: draftLookup({ 'bench:3': { weight: '140', reps: '4' } }),
    });
    expect(result).toEqual({ exerciseId: 'bench', setNumber: 3, weight: 140, reps: 4 });
  });

  it('skips a zero-weight draft', () => {
    const result = resolveDraftSetFlush({
      status: statusWith(),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: '0', reps: '5' } }),
    });
    expect(result).toBeNull();
  });

  it('skips an absent draft with no programmed reps to fall back to', () => {
    const result = resolveDraftSetFlush({
      status: statusWith({ exercises: [{ exercise_id: 'plank', reps: null }] }),
      completedSets: [],
      getDraft: draftLookup({}),
    });
    expect(result).toBeNull();
  });

  it('skips when the draft has reps but no typed weight', () => {
    const result = resolveDraftSetFlush({
      status: statusWith(),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: '', reps: '5' } }),
    });
    expect(result).toBeNull();
  });

  it('skips when the workout is already completed', () => {
    const result = resolveDraftSetFlush({
      status: statusWith({ state: 'completed' }),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: '135', reps: '5' } }),
    });
    expect(result).toBeNull();
  });

  it('skips when there is no exercise at the current index', () => {
    const result = resolveDraftSetFlush({
      status: statusWith({ currentExerciseIndex: 5 }),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: '135', reps: '5' } }),
    });
    expect(result).toBeNull();
  });

  it('rejects a NaN weight from a garbled draft', () => {
    const result = resolveDraftSetFlush({
      status: statusWith(),
      completedSets: [],
      getDraft: draftLookup({ 'bench:2': { weight: 'abc', reps: '5' } }),
    });
    expect(result).toBeNull();
  });
});
