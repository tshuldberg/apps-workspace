import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  initBestChefClient,
  resetBestChefClient,
  type CloudDish,
} from '@mylife/bestchef';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadDishCatalog,
  loadDishRecord,
  loadTrendingDishes,
  mapCloudDish,
  resetDishCatalogCache,
} from '../cloud-dishes';
import { loadFeedVideos, loadFeedVideoById, mapFeedVideo } from '../cloud-videos';
import { DEMO_DISHES } from '../demo';

const ENV_KEYS = [
  'EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH',
  'EXPO_PUBLIC_USE_DEMO_FIXTURES',
] as const;
const savedEnv: Record<string, string | undefined> = {};

function fakeQuery(rows: unknown) {
  const builder: Record<string, unknown> = {};
  const methods = [
    'select',
    'or',
    'order',
    'range',
    'eq',
    'in',
    'not',
    'limit',
    'ilike',
  ];
  for (const method of methods) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = () =>
    Promise.resolve({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null });
  (builder as { then: (resolve: (value: unknown) => void) => void }).then = (resolve) =>
    resolve({ data: rows, error: null });
  return builder;
}

function fakeClient(tables: Record<string, unknown>): SupabaseClient {
  return {
    from: (table: string) => fakeQuery(tables[table] ?? []),
    // searchDishes rides the bc_search_dishes RPC (plan 33 Phase 2.3); the
    // fake serves bc_dishes rows wrapped in the RPC row shape.
    rpc: (fn: string) =>
      Promise.resolve(
        fn === 'bc_search_dishes'
          ? {
              data: ((tables.bc_dishes as unknown[]) ?? []).map((dish) => ({
                dish,
                localized_name: null,
                localized_description: null,
              })),
              error: null,
            }
          : { data: null, error: { message: `unknown rpc ${fn}` } },
      ),
  } as unknown as SupabaseClient;
}

const CLOUD_DISH: CloudDish = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Smash Burger',
  slug: 'smash-burger',
  nativeName: null,
  category: 'main',
  cuisine: 'American',
  region: null,
  description: null,
  photoUrl: null,
  gradientFrom: '#101010',
  gradientTo: '#202020',
  emoji: '🍔',
  aliasCount: 0,
  submissionCount: 42,
  status: 'active',
  proposedBy: null,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
};

const CLOUD_DISH_ROW = {
  id: CLOUD_DISH.id,
  name: CLOUD_DISH.name,
  slug: CLOUD_DISH.slug,
  native_name: null,
  category: 'main',
  cuisine: 'American',
  region: null,
  description: null,
  photo_url: null,
  gradient_from: '#101010',
  gradient_to: '#202020',
  emoji: '🍔',
  alias_count: 0,
  submission_count: 42,
  status: 'active',
  proposed_by: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  resetBestChefClient();
  resetDishCatalogCache();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetBestChefClient();
  resetDishCatalogCache();
});

describe('mapCloudDish', () => {
  it('maps cloud dish fields onto the catalog shape', () => {
    const mapped = mapCloudDish(CLOUD_DISH);
    expect(mapped.id).toBe(CLOUD_DISH.id);
    expect(mapped.name).toBe('Smash Burger');
    expect(mapped.slug).toBe('smash-burger');
    expect(mapped.gradientFrom).toBe('#101010');
    expect(mapped.emoji).toBe('🍔');
    expect(mapped.submissionCount).toBe(42);
    expect(mapped.tags).toEqual([]);
    expect(mapped.createdAtMs).toBe(new Date('2026-05-01T00:00:00Z').getTime());
  });

  it('falls back to derived visuals when cloud visuals are null', () => {
    const mapped = mapCloudDish({
      ...CLOUD_DISH,
      gradientFrom: null,
      gradientTo: null,
      emoji: null,
    });
    expect(mapped.gradientFrom).toBeTruthy();
    expect(mapped.gradientTo).toBeTruthy();
    expect(mapped.emoji).toBeTruthy();
  });
});

describe('loadDishCatalog', () => {
  it('returns cloud dishes when the client responds', async () => {
    initBestChefClient(fakeClient({ bc_dishes: [CLOUD_DISH_ROW] }));
    const result = await loadDishCatalog({ force: true });
    expect(result.source).toBe('cloud');
    expect(result.dishes).toHaveLength(1);
    expect(result.dishes[0]?.name).toBe('Smash Burger');
  });

  it('falls back to demo fixtures in internal builds when cloud is unavailable', async () => {
    const result = await loadDishCatalog({ force: true });
    expect(result.source).toBe('demo');
    expect(result.dishes.length).toBe(DEMO_DISHES.length);
  });

  it('fails closed to an empty catalog in public-launch builds', async () => {
    process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH = '1';
    const result = await loadDishCatalog({ force: true });
    expect(result.source).toBe('none');
    expect(result.dishes).toEqual([]);
  });

  it('serves trending as a slice of the catalog', async () => {
    initBestChefClient(fakeClient({ bc_dishes: [CLOUD_DISH_ROW] }));
    resetDishCatalogCache();
    const result = await loadTrendingDishes(8);
    expect(result.dishes.length).toBeLessThanOrEqual(8);
  });
});

describe('loadDishRecord', () => {
  it('resolves dishes from the cloud catalog by id or slug', async () => {
    initBestChefClient(fakeClient({ bc_dishes: [CLOUD_DISH_ROW] }));
    const byId = await loadDishRecord(CLOUD_DISH.id);
    expect(byId.dish?.name).toBe('Smash Burger');
    const bySlug = await loadDishRecord('smash-burger');
    expect(bySlug.dish?.name).toBe('Smash Burger');
  });

  it('fails closed in public-launch builds when the dish is unknown', async () => {
    process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH = '1';
    const result = await loadDishRecord('d1');
    expect(result.dish).toBeNull();
    expect(result.source).toBe('none');
  });
});

describe('cloud video feed adapter', () => {
  it('maps feed videos onto the app video shape', () => {
    const mapped = mapFeedVideo({
      id: 'asset-1',
      submissionId: 'sub-1',
      videoUrl: 'https://cdn.example.com/v.mp4',
      durationSeconds: null,
      dishId: 'dish-1',
      dishName: 'Smash Burger',
      cuisine: 'American',
      chefName: 'Chef Tom',
      chefHandle: 'cheftom',
      title: 'Backyard Double Smash',
      description: 'Crust city.',
      likeCount: 842,
      chefProfileId: 'profile-1',
      commentCount: 0,
      createdAt: new Date('2026-05-01T00:00:00Z'),
    });
    expect(mapped.id).toBe('asset-1');
    expect(mapped.videoUrl).toBe('https://cdn.example.com/v.mp4');
    expect(mapped.duration).toBe(0);
    expect(mapped.likes).toBe(842);
    expect(mapped.chefHandle).toBe('cheftom');
  });

  it('falls back to demo videos in internal builds when cloud is unavailable', async () => {
    const result = await loadFeedVideos();
    expect(result.source).toBe('demo');
    expect(result.videos.length).toBeGreaterThan(0);
  });

  it('fails closed to an empty feed in public-launch builds', async () => {
    process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH = '1';
    const result = await loadFeedVideos();
    expect(result.source).toBe('none');
    expect(result.videos).toEqual([]);
  });

  it('returns null for unknown video ids in public-launch builds', async () => {
    process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH = '1';
    const video = await loadFeedVideoById('v1');
    expect(video).toBeNull();
  });
});
