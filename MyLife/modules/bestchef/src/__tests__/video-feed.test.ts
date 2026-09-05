import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { initBestChefClient, resetBestChefClient } from '../cloud/client';
import { getFeedVideoById, listFeedVideos } from '../cloud/video-feed';

function fakeQuery(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'or', 'order', 'range', 'eq', 'in', 'not', 'limit', 'ilike'];
  for (const method of methods) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  (builder as { then: (resolve: (value: unknown) => void) => void }).then = (resolve) =>
    resolve({ data: rows, error: null });
  return builder;
}

function fakeClient(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from: (table: string) => fakeQuery(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

const ASSET_ROW = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  owner_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  remote_url: 'https://cdn.example.com/cook.mp4',
  duration_ms: 4500,
  created_at: '2026-05-01T00:00:00Z',
};

const SUBMISSION_ROW = {
  id: ASSET_ROW.owner_id,
  dish_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  recipe_snapshot_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  profile_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  like_count: 7,
  moderation_status: 'approved',
};

const TABLES = {
  bc_media_assets: [ASSET_ROW],
  bc_submissions: [SUBMISSION_ROW],
  bc_recipe_snapshots: [
    { id: SUBMISSION_ROW.recipe_snapshot_id, title: 'Backyard Smash', description: 'Crust.' },
  ],
  bc_dishes: [
    { id: SUBMISSION_ROW.dish_id, name: 'Smash Burger', cuisine: 'American' },
  ],
  social_profiles: [
    { id: SUBMISSION_ROW.profile_id, display_name: 'Chef Tom', handle: 'cheftom' },
  ],
};

afterEach(() => {
  resetBestChefClient();
});

describe('listFeedVideos', () => {
  it('composes approved video assets with submission, dish, and chef context', async () => {
    initBestChefClient(fakeClient(TABLES));
    const result = await listFeedVideos();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    const video = result.data[0];
    expect(video?.videoUrl).toBe('https://cdn.example.com/cook.mp4');
    expect(video?.durationSeconds).toBe(5);
    expect(video?.title).toBe('Backyard Smash');
    expect(video?.dishName).toBe('Smash Burger');
    expect(video?.chefHandle).toBe('cheftom');
    expect(video?.likeCount).toBe(7);
  });

  it('returns an empty list when no video assets exist', async () => {
    initBestChefClient(fakeClient({ ...TABLES, bc_media_assets: [] }));
    const result = await listFeedVideos();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('drops assets whose submissions are not approved', async () => {
    initBestChefClient(fakeClient({ ...TABLES, bc_submissions: [] }));
    const result = await listFeedVideos();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('applies the dishId filter after composition', async () => {
    initBestChefClient(fakeClient(TABLES));
    const result = await listFeedVideos({ dishId: 'not-this-dish' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});

describe('getFeedVideoById', () => {
  it('returns the composed video for a known asset id', async () => {
    initBestChefClient(fakeClient(TABLES));
    const result = await getFeedVideoById(ASSET_ROW.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.id).toBe(ASSET_ROW.id);
    expect(result.data?.title).toBe('Backyard Smash');
  });

  it('returns null for unknown asset ids', async () => {
    initBestChefClient(fakeClient({ ...TABLES, bc_media_assets: [] }));
    const result = await getFeedVideoById('missing');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });
});
