import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  drainPendingSaves,
  isSubmissionSavedLocally,
  listCachedSavedIds,
  listPendingSaveOps,
  markSavedLocally,
  markUnsavedLocally,
  reconcileSavedCache,
} from '../saved-submissions-cache';

describe('saved submissions local cache (F-010)', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = () => testDb.close();
  });

  afterEach(() => {
    closeDb();
  });

  it('creates the cache table at schema v32', () => {
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
    markSavedLocally(db, 'sub-1');
    expect(isSubmissionSavedLocally(db, 'sub-1')).toBe(true);
  });

  it('optimistic save is visible and queued; unsave hides and queues', () => {
    markSavedLocally(db, 'sub-1');
    expect(listCachedSavedIds(db)).toEqual(['sub-1']);
    expect(listPendingSaveOps(db)).toMatchObject([{ submissionId: 'sub-1', pendingOp: 'save' }]);

    markUnsavedLocally(db, 'sub-1');
    expect(listCachedSavedIds(db)).toEqual([]);
    expect(isSubmissionSavedLocally(db, 'sub-1')).toBe(false);
    expect(listPendingSaveOps(db)).toMatchObject([{ submissionId: 'sub-1', pendingOp: 'unsave' }]);
  });

  it('reconcile replaces settled rows with cloud truth but keeps queued ops', () => {
    markSavedLocally(db, 'settled', { pending: false });
    markSavedLocally(db, 'queued');
    reconcileSavedCache(db, ['cloud-1', 'cloud-2']);

    const ids = listCachedSavedIds(db);
    expect(ids).toContain('cloud-1');
    expect(ids).toContain('cloud-2');
    expect(ids).toContain('queued');
    expect(ids).not.toContain('settled');
  });

  it('drain commits queued ops and settles rows', async () => {
    markSavedLocally(db, 'sub-1');
    markUnsavedLocally(db, 'sub-2');

    const calls: string[] = [];
    const result = await drainPendingSaves(db, {
      save: async (id) => { calls.push(`save:${id}`); return { ok: true }; },
      unsave: async (id) => { calls.push(`unsave:${id}`); return { ok: true }; },
    });

    expect(result).toMatchObject({ processed: 2, committed: 2, failed: 0 });
    expect(calls.sort()).toEqual(['save:sub-1', 'unsave:sub-2']);
    expect(listPendingSaveOps(db)).toEqual([]);
    expect(isSubmissionSavedLocally(db, 'sub-1')).toBe(true);
    expect(isSubmissionSavedLocally(db, 'sub-2')).toBe(false);
  });

  it('retryable failure keeps the op queued and stops the pass', async () => {
    markSavedLocally(db, 'sub-1');
    markSavedLocally(db, 'sub-2');

    const result = await drainPendingSaves(db, {
      save: async () => ({ ok: false, retryable: true }),
      unsave: async () => ({ ok: true }),
    });

    expect(result).toMatchObject({ processed: 1, failed: 1, stoppedOnFailure: true });
    expect(listPendingSaveOps(db)).toHaveLength(2);
  });

  it('permanent failure rolls the save back instead of wedging the queue', async () => {
    markSavedLocally(db, 'sub-1');

    await drainPendingSaves(db, {
      save: async () => ({ ok: false, retryable: false }),
      unsave: async () => ({ ok: true }),
    });

    expect(listPendingSaveOps(db)).toEqual([]);
    expect(isSubmissionSavedLocally(db, 'sub-1')).toBe(false);
  });
});
