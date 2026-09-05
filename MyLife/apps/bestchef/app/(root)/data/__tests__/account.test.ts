import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';

const mocks = vi.hoisted(() => ({
  deleteAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  deleteAsync: mocks.deleteAsync,
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  deleteItemAsync: mocks.deleteItemAsync,
}));

import {
  BESTCHEF_LOCAL_ACCOUNT_TABLES,
  deleteBestChefAccount,
  wipeAccount,
} from '../account';

describe('BestChef account deletion helpers', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
    mocks.deleteAsync.mockClear();
    mocks.deleteItemAsync.mockClear();
  });

  afterEach(() => {
    closeDb();
  });

  function countRows(table: string): number {
    try {
      return db.query<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  function insertAccountRows(): void {
    db.execute(
      `INSERT INTO rc_recipes (id, title, image_uri) VALUES (?, ?, ?)`,
      ['recipe-1', 'Pad Thai', 'file:///doc/recipe.jpg'],
    );
    db.execute(
      `INSERT INTO rc_pantry_items (id, name, photo_path) VALUES (?, ?, ?)`,
      ['pantry-1', 'Rice noodles', 'file:///doc/noodles.jpg'],
    );
    db.execute(
      `INSERT INTO rc_pantry_batches (
        id, pantry_item_id, photos_json
      ) VALUES (?, ?, ?)`,
      ['batch-1', 'pantry-1', '["file:///doc/batch.jpg"]'],
    );
    db.execute(
      `INSERT INTO rc_bestchef_submissions (
        id, dish_id, dish_name, title, description, chef_id, chef_name,
        chef_handle, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'submission-1',
        'pad-thai',
        'Pad Thai',
        'My Pad Thai',
        '',
        'chef-1',
        'Chef',
        'chef',
        '2026-04-26T00:00:00Z',
        '2026-04-26T00:00:00Z',
      ],
    );
    db.execute(
      `INSERT INTO rc_saved_submissions_cache (
        submission_id, pending_op
      ) VALUES (?, ?)`,
      ['submission-1', 'save'],
    );
    db.execute(
      `INSERT INTO rc_bestchef_media_cache (
        id, owner_kind, owner_id, media_kind, remote_uri, local_uri, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'media-1',
        'submission',
        'submission-1',
        'image',
        'https://cdn.example/media.jpg',
        'file:///doc/cache.jpg',
        '2026-04-26T00:00:00Z',
        '2026-04-26T00:00:00Z',
      ],
    );
    db.execute(
      `CREATE TABLE IF NOT EXISTS rc_bestchef_reports (
        id TEXT PRIMARY KEY,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        reporter_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      )`,
    );
    db.execute(
      `INSERT INTO rc_bestchef_reports (
        id, target_kind, target_id, reporter_id, reason, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['report-1', 'submission', 'submission-1', 'chef-1', 'spam', 1, 'pending'],
    );
    db.execute(`INSERT INTO rc_settings (key, value) VALUES (?, ?)`, ['profile_handle', 'chef']);
  }

  it('wipes local account tables, media files, and known sync secrets', async () => {
    insertAccountRows();

    expect(countRows('rc_saved_submissions_cache')).toBeGreaterThan(0);

    await wipeAccount(db);

    for (const table of BESTCHEF_LOCAL_ACCOUNT_TABLES) {
      expect(countRows(table), table).toBe(0);
    }
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///doc/cache.jpg', { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///doc/recipe.jpg', { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///doc/noodles.jpg', { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///doc/batch.jpg', { idempotent: true });
    expect(mocks.deleteItemAsync).toHaveBeenCalledWith(
      'sync.identity.privateKey',
      expect.objectContaining({ keychainService: 'com.bestchef.bestchef.sync' }),
    );
  });

  it('restores exactly the default pantry staples after wiping extra rows', async () => {
    // Arrange
    const seededIds = db
      .query<{ id: string }>('SELECT id FROM rc_pantry_staples ORDER BY id')
      .map((row) => row.id);
    expect(seededIds).toHaveLength(16);
    expect(seededIds).toEqual(
      expect.arrayContaining(['staple-salt', 'staple-pepper', 'staple-olive-oil']),
    );
    db.execute(
      'INSERT INTO rc_pantry_staples (id, item) VALUES (?, ?)',
      ['staple-rice-noodles', 'rice noodles'],
    );
    expect(countRows('rc_pantry_staples')).toBe(17);

    // Act
    await wipeAccount(db);

    // Assert
    const restoredIds = db
      .query<{ id: string }>('SELECT id FROM rc_pantry_staples ORDER BY id')
      .map((row) => row.id);
    expect(restoredIds).toEqual(seededIds);
    expect(restoredIds).not.toContain('staple-rice-noodles');
  });

  it('deletes original and compressed media upload job files', async () => {
    // Arrange
    const localUri = 'file:///doc/upload-original.jpg';
    const compressedUri = 'file:///doc/upload-compressed.jpg';
    db.execute(
      `INSERT INTO rc_media_upload_jobs (
        id, owner_id, media_kind, local_uri, compressed_uri, mime_type, status, public_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'upload-1',
        'submission-1',
        'image',
        localUri,
        compressedUri,
        'image/jpeg',
        'done',
        'https://cdn.example/upload.jpg',
      ],
    );

    // Act
    await wipeAccount(db);

    // Assert
    expect(countRows('rc_media_upload_jobs')).toBe(0);
    expect(mocks.deleteAsync).toHaveBeenCalledWith(localUri, { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith(compressedUri, { idempotent: true });
  });

  it('deletes saved recipe media, vote proof photos, shopping list media, and submission video files', async () => {
    // Arrange
    db.execute(
      `INSERT INTO rc_recipes (id, title, image_uri) VALUES (?, ?, ?)`,
      ['recipe-2', 'Pho', null],
    );
    const savedRecipeMediaUri = 'file:///doc/saved-recipe-media.jpg';
    db.execute(
      `INSERT INTO rc_saved_recipe_media (id, recipe_id, uri) VALUES (?, ?, ?)`,
      ['media-2', 'recipe-2', savedRecipeMediaUri],
    );

    const voteProofUri = 'file:///doc/vote-proof.jpg';
    db.execute(
      `INSERT INTO rc_local_vote_proofs (
        id, submission_id, tier, local_image_uri, content_hash, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      ['proof-1', 'submission-1', 'gold', voteProofUri, 'hash-1', '2026-05-01T00:00:00Z'],
    );

    const shoppingListMediaUri = 'file:///doc/shopping-list-media.jpg';
    db.execute(
      `INSERT INTO rc_shopping_lists (id, name, media_uris_json) VALUES (?, ?, ?)`,
      ['list-1', 'Groceries', JSON.stringify([shoppingListMediaUri])],
    );

    db.execute(
      `INSERT INTO rc_bestchef_submissions (
        id, dish_id, dish_name, title, description, photo_uri, videos_json,
        chef_id, chef_name, chef_handle, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'submission-2',
        'pho',
        'Pho',
        'My Pho',
        '',
        'file:///doc/submission-photo.jpg',
        JSON.stringify([{ uri: 'file:///doc/submission-video.mp4', type: 'video/mp4' }]),
        'chef-1',
        'Chef',
        'chef',
        '2026-04-26T00:00:00Z',
        '2026-04-26T00:00:00Z',
      ],
    );

    // Act
    await wipeAccount(db);

    // Assert
    expect(countRows('rc_saved_recipe_media')).toBe(0);
    expect(countRows('rc_local_vote_proofs')).toBe(0);
    expect(countRows('rc_shopping_lists')).toBe(0);
    expect(countRows('rc_bestchef_submissions')).toBe(0);
    expect(mocks.deleteAsync).toHaveBeenCalledWith(savedRecipeMediaUri, { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith(voteProofUri, { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith(shoppingListMediaUri, { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///doc/submission-photo.jpg', { idempotent: true });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///doc/submission-video.mp4', { idempotent: true });
  });

  it('requests cloud deletion, deletes the social profile, signs out, then wipes local data', async () => {
    insertAccountRows();
    const eq = vi.fn(async () => ({ error: null }));
    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      rpc: vi.fn(async () => ({ data: { id: 'request-1' }, error: null })),
      from: vi.fn(() => ({
        delete: vi.fn(() => ({ eq })),
      })),
    } as unknown as SupabaseClient;

    const result = await deleteBestChefAccount(db, { supabase });

    expect(result).toMatchObject({
      cloudDeletionRequested: true,
      cloudProfileDeleted: true,
      cloudSignedOut: true,
      localWiped: true,
      warnings: [],
    });
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
