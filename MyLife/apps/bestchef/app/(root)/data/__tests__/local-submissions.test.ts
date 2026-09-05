import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';
import {
  addLocalComment,
  addLocalSubmission,
  blockUser,
  getAllLocalSubmissions,
  getLocalComments,
  getLocalSubmission,
  getLocalSubmissionsForDish,
  isBlocked,
  isContentFromBlockedUser,
  listBlocked,
  reportContent,
  saveVote,
  unblockUser,
} from '../local-submissions';
import { setUgcLanguage } from '../app-language';
import {
  ensureChefTomSeedSubmissions,
  getChefTomSeedRecipeCount,
} from '../cheftom-seed';

interface TestDatabaseAdapter extends DatabaseAdapter {
  recordSyncChange?: (
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    rowId: string,
    data: Record<string, unknown> | null,
  ) => void;
  syncDeviceId?: string;
}

describe('BestChef local submissions', () => {
  let db: TestDatabaseAdapter;
  let closeDb: () => void;
  let changes: Array<{ table: string; operation: string; rowId: string }>;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter as TestDatabaseAdapter;
    closeDb = testDb.close;
    changes = [];
    db.syncDeviceId = 'device-chef-1';
    db.recordSyncChange = (table, operation, rowId) => {
      changes.push({ table, operation, rowId });
    };
  });

  afterEach(() => {
    closeDb();
  });

  it('stamps the authoring-time UGC language and reads it back (V31)', () => {
    setUgcLanguage('fr');
    try {
      const submission = addLocalSubmission(db, {
        dishId: 'd9',
        dishName: 'Ratatouille',
        title: 'Ratatouille de Mamie',
        description: '',
        ingredients: [],
        instructions: [],
        photoUri: null,
        videos: [],
      });
      expect(submission.language).toBe('fr');
      expect(getLocalSubmission(db, submission.id)?.language).toBe('fr');

      const override = addLocalSubmission(db, {
        dishId: 'd9',
        dishName: 'Ratatouille',
        title: 'Nonna style',
        description: '',
        ingredients: [],
        instructions: [],
        photoUri: null,
        videos: [],
        language: 'it',
      });
      expect(getLocalSubmission(db, override.id)?.language).toBe('it');
    } finally {
      // The holder's validating setter ignores null; reset explicitly.
      setUgcLanguage('en');
    }
  });

  it('stores submissions in syncable tables and records a sync change', () => {
    const submission = addLocalSubmission(db, {
      dishId: 'd1',
      dishName: 'Pad Thai',
      title: 'Beta Pad Thai',
      description: 'A beta tester recipe.',
      ingredients: ['rice noodles', 'tofu'],
      instructions: ['Soak noodles', 'Stir fry'],
      photoUri: null,
      videos: [],
    });

    const rows = db.query<{ id: string; chef_id: string }>(
      'SELECT id, chef_id FROM rc_bestchef_submissions WHERE id = ?',
      [submission.id],
    );
    expect(rows).toEqual([{ id: submission.id, chef_id: 'device-chef-1' }]);
    expect(getLocalSubmissionsForDish(db, 'd1')[0]?.title).toBe('Beta Pad Thai');
    expect(getAllLocalSubmissions(db)[0]?.id).toBe(submission.id);
    expect(changes).toContainEqual({
      table: 'rc_bestchef_submissions',
      operation: 'INSERT',
      rowId: submission.id,
    });
  });

  it('seeds ChefTom baseline submissions idempotently without sync changes', () => {
    ensureChefTomSeedSubmissions(db);
    ensureChefTomSeedSubmissions(db);

    const rows = db.query<{
      chef_name: string;
      chef_handle: string;
      title: string;
    }>(
      `SELECT chef_name, chef_handle, title
       FROM rc_bestchef_submissions
       WHERE chef_handle = ?
       ORDER BY rank ASC`,
      ['cheftom'],
    );

    expect(rows).toHaveLength(getChefTomSeedRecipeCount());
    expect(rows[0]).toMatchObject({
      chef_name: 'ChefTom',
      chef_handle: 'cheftom',
      title: 'ChefTom Brownie Pudding',
    });
    expect(getAllLocalSubmissions(db)).toHaveLength(getChefTomSeedRecipeCount());
    expect(changes).toEqual([]);
  });

  it('stores comments and votes as syncable activity', () => {
    const submission = addLocalSubmission(db, {
      dishId: 'd1',
      dishName: 'Pad Thai',
      title: 'Commentable Pad Thai',
      description: '',
      ingredients: ['rice noodles'],
      instructions: ['Cook'],
      photoUri: null,
      videos: [],
    });

    const comment = addLocalComment(db, submission.id, 'I tried this with extra lime.');
    saveVote(db, submission.id, 5);

    expect(getLocalComments(db, submission.id)[0]).toMatchObject({
      id: comment.id,
      text: 'I tried this with extra lime.',
      authorHandle: 'device-c',
    });
    expect(changes.map((change) => change.table)).toEqual([
      'rc_bestchef_submissions',
      'rc_bestchef_comments',
      'rc_bestchef_votes',
      'rc_bestchef_submissions',
    ]);
    expect(changes.at(-1)).toMatchObject({
      table: 'rc_bestchef_submissions',
      operation: 'UPDATE',
      rowId: submission.id,
    });
  });

  it('persists reports with target metadata and records a sync change', () => {
    const { id } = reportContent(db, {
      targetKind: 'submission',
      targetId: 'sub-1',
      reason: 'Spam or scam',
      reporterId: 'reporter-42',
    });

    const rows = db.query<{
      id: string;
      target_kind: string;
      target_id: string;
      reporter_id: string;
      reason: string;
      status: string;
    }>(
      `SELECT id, target_kind, target_id, reporter_id, reason, status
       FROM rc_bestchef_reports WHERE id = ?`,
      [id],
    );
    expect(rows).toEqual([
      {
        id,
        target_kind: 'submission',
        target_id: 'sub-1',
        reporter_id: 'reporter-42',
        reason: 'Spam or scam',
        status: 'pending',
      },
    ]);
    expect(changes).toContainEqual({
      table: 'rc_bestchef_reports',
      operation: 'INSERT',
      rowId: id,
    });
  });

  it('blockUser and isBlocked round-trip, unblock clears state', () => {
    expect(isBlocked(db, 'viewer-1', 'troll_handle')).toBe(false);

    const row = blockUser(db, { blockerId: 'viewer-1', blockedHandle: '@TrollHandle' });
    expect(row?.blockedHandle).toBe('trollhandle');
    expect(isBlocked(db, 'viewer-1', 'trollhandle')).toBe(true);
    expect(isBlocked(db, 'viewer-1', '@TrollHandle')).toBe(true);
    expect(isBlocked(db, 'viewer-2', 'trollhandle')).toBe(false);

    expect(listBlocked(db, 'viewer-1').map((b) => b.blockedHandle)).toEqual(['trollhandle']);

    unblockUser(db, { blockerId: 'viewer-1', blockedHandle: 'trollhandle' });
    expect(isBlocked(db, 'viewer-1', 'trollhandle')).toBe(false);
    expect(listBlocked(db, 'viewer-1')).toEqual([]);
  });

  it('isContentFromBlockedUser reports true for blocked handles only', () => {
    blockUser(db, { blockerId: 'viewer-1', blockedHandle: 'badactor' });
    expect(isContentFromBlockedUser(db, 'viewer-1', 'badactor')).toBe(true);
    expect(isContentFromBlockedUser(db, 'viewer-1', '@BadActor')).toBe(true);
    expect(isContentFromBlockedUser(db, 'viewer-1', 'someoneelse')).toBe(false);
    expect(isContentFromBlockedUser(db, 'viewer-2', 'badactor')).toBe(false);
  });
});
