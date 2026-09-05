import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { createRecipe } from '../../db/crud';
import {
  initBestChefClient,
  resetBestChefClient,
} from '../client';
import {
  MAX_SUBMISSIONS_PER_DISH,
  getLeaderboardSubmissions,
  getVoteFeed,
  normalizeUgcLanguage,
  publishRecipeToCloud,
} from '../submission';

describe('submission constants', () => {
  it('MAX_SUBMISSIONS_PER_DISH is 3', () => {
    expect(MAX_SUBMISSIONS_PER_DISH).toBe(3);
  });

  it('MAX_SUBMISSIONS_PER_DISH is a positive integer', () => {
    expect(Number.isInteger(MAX_SUBMISSIONS_PER_DISH)).toBe(true);
    expect(MAX_SUBMISSIONS_PER_DISH).toBeGreaterThan(0);
  });
});

// ── publishRecipeToCloud photo_url handling ───────────────────────────

interface InsertCapture {
  table: string;
  payload: Record<string, unknown>;
}

function buildFakeSupabase(captures: InsertCapture[]) {
  const submissionRow = {
    id: 'sub-1',
    dish_id: 'dish-1',
    recipe_snapshot_id: 'snap-1',
    profile_id: 'profile-1',
    photo_url: null,
    created_at: '2026-04-28T00:00:00.000Z',
    updated_at: '2026-04-28T00:00:00.000Z',
  };
  const snapshotRow = {
    id: 'snap-1',
    profile_id: 'profile-1',
    title: 'Test',
    created_at: '2026-04-28T00:00:00.000Z',
  };

  return {
    from(table: string) {
      return {
        select(_columns?: string, options?: { count?: string; head?: boolean }) {
          if (options?.count === 'exact' && options?.head === true) {
            // count query for countUserSubmissionsForDish
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ count: 0, error: null });
                  },
                };
              },
            };
          }
          return {
            single: async () => {
              // After insert path
              return { data: null, error: null };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          captures.push({ table, payload: { ...payload } });
          return {
            select: () => ({
              single: async () => {
                if (table === 'bc_submissions') {
                  // echo the photo_url that was inserted so the mapper sees it
                  return {
                    data: {
                      ...submissionRow,
                      photo_url: payload.photo_url ?? null,
                    },
                    error: null,
                  };
                }
                return { data: snapshotRow, error: null };
              },
            }),
          };
        },
      };
    },
  };
}

function buildVoteFeedSupabase(captures: { submissionSelects: string[] }) {
  const row = {
    id: '00000000-0000-4000-8000-000000000001',
    dish_id: '00000000-0000-4000-8000-000000000002',
    recipe_snapshot_id: '00000000-0000-4000-8000-000000000003',
    profile_id: '00000000-0000-4000-8000-000000000004',
    photo_url: null,
    photo_verified: true,
    photo_verified_at: null,
    verification_method: null,
    chef_location: null,
    chef_location_lat: null,
    chef_location_lng: null,
    chef_origin: null,
    country_code: null,
    vote_score: 42,
    like_count: 12,
    rank: 1,
    moderation_status: 'approved',
    region: null,
    is_restaurant: false,
    upvote_count: 11,
    downvote_count: 1,
    reviewed_count: 2,
    tap_count: 12,
    created_at: '2026-05-02T00:00:00.000Z',
    updated_at: '2026-05-02T00:00:00.000Z',
    social_profiles: [{
      display_name: 'ChefTom',
      handle: 'cheftom',
      avatar_url: null,
    }],
    bc_dishes: {
      name: 'Brownie Pudding',
      cuisine: 'American',
      region: 'Editorial Seed',
      gradient_from: '#D9742F',
      gradient_to: '#8C401E',
      emoji: null,
    },
    bc_recipe_snapshots: {
      title: 'ChefTom Brownie Pudding',
      ingredients_json: [
        { quantity: '1', unit: 'cup', item: 'cocoa powder' },
        'flour',
      ],
    },
    bc_comments: [{ count: 3 }],
  };

  return {
    from(table: string) {
      if (table === 'bc_submissions') {
        return {
          select(columns: string) {
            captures.submissionSelects.push(columns);
            const query = {
              eq: () => query,
              neq: () => query,
              not: () => query,
              order: () => query,
              limit: async () => ({ data: [row], error: null }),
            };
            return query;
          },
        };
      }

      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    },
  };
}

function buildVoteFeedRow(index: number) {
  const suffix = index.toString(16).padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    dish_id: `00000000-0000-4000-8001-${suffix}`,
    recipe_snapshot_id: `00000000-0000-4000-8002-${suffix}`,
    profile_id: '00000000-0000-4000-8000-000000000999',
    photo_url: null,
    photo_verified: true,
    photo_verified_at: null,
    verification_method: null,
    chef_location: null,
    chef_location_lat: null,
    chef_location_lng: null,
    chef_origin: null,
    country_code: null,
    vote_score: 1000,
    like_count: 1000,
    rank: 1,
    moderation_status: 'approved',
    region: 'Editorial Seed',
    is_restaurant: false,
    upvote_count: 1000,
    downvote_count: 0,
    reviewed_count: 1000,
    tap_count: 1000,
    created_at: new Date(Date.UTC(2026, 4, 2, 12, index, 0)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 4, 2, 12, index, 0)).toISOString(),
    social_profiles: [{
      display_name: 'ChefTom',
      handle: 'cheftom',
      avatar_url: null,
    }],
    bc_dishes: {
      name: `Seed Dish ${index}`,
      cuisine: 'American',
      region: 'Editorial Seed',
      gradient_from: null,
      gradient_to: null,
      emoji: null,
    },
    bc_recipe_snapshots: {
      title: `ChefTom Seed Dish ${index}`,
      ingredients_json: ['test ingredient'],
    },
    bc_comments: [{ count: 0 }],
  };
}

function buildOverlappingVoteFeedSupabase(rows: Array<ReturnType<typeof buildVoteFeedRow>>) {
  return {
    from(table: string) {
      if (table === 'bc_submissions') {
        return {
          select() {
            let limitCount = rows.length;
            const query = {
              eq: () => query,
              neq: () => query,
              not: () => query,
              order: () => query,
              limit: (count: number) => {
                limitCount = count;
                return query;
              },
              then: (resolve: (value: { data: typeof rows; error: null }) => void) => (
                Promise.resolve({ data: rows.slice(0, limitCount), error: null }).then(resolve)
              ),
            };
            return query;
          },
        };
      }

      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    },
  };
}

function buildLeaderboardSupabase(captures: { submissionSelects: string[] }) {
  const row = buildVoteFeedRow(1);

  return {
    from(table: string) {
      if (table === 'bc_submissions') {
        return {
          select(columns: string) {
            captures.submissionSelects.push(columns);
            const query = {
              eq: () => query,
              order: () => query,
              limit: () => query,
              then: (resolve: (value: { data: Array<typeof row>; error: null }) => void) => (
                Promise.resolve({ data: [row], error: null }).then(resolve)
              ),
            };
            return query;
          },
        };
      }

      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }),
      };
    },
  };
}

describe('publishRecipeToCloud photo_url enforcement', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;
  let recipeId: string;
  let captures: InsertCapture[];

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
    recipeId = 'recipe-1';
    createRecipe(db, recipeId, { title: 'Test recipe' });
    captures = [];
    const fake = buildFakeSupabase(captures);
    initBestChefClient(fake as never);
  });

  afterEach(() => {
    resetBestChefClient();
    closeDb();
    vi.restoreAllMocks();
  });

  it('writes the caller-provided https photo_url into bc_submissions', async () => {
    const result = await publishRecipeToCloud(
      db,
      recipeId,
      'dish-1',
      'profile-1',
      undefined,
      'https://cdn.example.com/photo.jpg',
    );

    expect(result.ok).toBe(true);
    const submissionInsert = captures.find((c) => c.table === 'bc_submissions');
    expect(submissionInsert).toBeDefined();
    expect(submissionInsert?.payload.photo_url).toBe(
      'https://cdn.example.com/photo.jpg',
    );
  });

  it('rejects file:// URIs before reaching the database', async () => {
    const result = await publishRecipeToCloud(
      db,
      recipeId,
      'dish-1',
      'profile-1',
      undefined,
      'file:///var/mobile/photo.jpg' as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/https:\/\//);
    }
    // Constraint check happens BEFORE any insert.
    expect(captures.find((c) => c.table === 'bc_submissions')).toBeUndefined();
  });

  it('writes null photo_url when no photoUrl is provided and the recipe image is local', async () => {
    const result = await publishRecipeToCloud(
      db,
      recipeId,
      'dish-1',
      'profile-1',
    );

    expect(result.ok).toBe(true);
    const submissionInsert = captures.find((c) => c.table === 'bc_submissions');
    expect(submissionInsert).toBeDefined();
    expect(submissionInsert?.payload.photo_url).toBeNull();
  });

  it('tags snapshot and submission with the normalized app language (Phase 2.5)', async () => {
    const result = await publishRecipeToCloud(
      db,
      recipeId,
      'dish-1',
      'profile-1',
      undefined,
      undefined,
      'PT-BR',
    );

    expect(result.ok).toBe(true);
    expect(captures.find((c) => c.table === 'bc_recipe_snapshots')?.payload.language).toBe('pt-br');
    expect(captures.find((c) => c.table === 'bc_submissions')?.payload.language).toBe('pt-br');
  });

  it('writes null language for junk or missing language tags', async () => {
    const result = await publishRecipeToCloud(
      db,
      recipeId,
      'dish-1',
      'profile-1',
      undefined,
      undefined,
      'not a locale',
    );

    expect(result.ok).toBe(true);
    expect(captures.find((c) => c.table === 'bc_submissions')?.payload.language).toBeNull();
  });
});

describe('normalizeUgcLanguage', () => {
  it('lowercases valid tags and rejects junk', () => {
    expect(normalizeUgcLanguage('DE')).toBe('de');
    expect(normalizeUgcLanguage('pt-BR')).toBe('pt-br');
    expect(normalizeUgcLanguage('zh-Hans')).toBe('zh-hans');
    expect(normalizeUgcLanguage('not a locale')).toBeNull();
    expect(normalizeUgcLanguage('')).toBeNull();
    expect(normalizeUgcLanguage(null)).toBeNull();
    expect(normalizeUgcLanguage(undefined)).toBeNull();
  });
});

describe('language filters (Phase 2.5)', () => {
  afterEach(() => {
    resetBestChefClient();
  });

  function buildEqCaptureClient(eqCalls: Array<[string, unknown]>) {
    function chain() {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'order', 'limit', 'range', 'gte', 'neq', 'not', 'in']) {
        builder[method] = () => builder;
      }
      builder.eq = (column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return builder;
      };
      (builder as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
        resolve({ data: [], error: null });
      return builder;
    }
    return { from: () => chain() };
  }

  it('getVoteFeed applies a normalized language filter', async () => {
    const eqCalls: Array<[string, unknown]> = [];
    initBestChefClient(buildEqCaptureClient(eqCalls) as never);

    const result = await getVoteFeed({ limit: 5, language: 'DE' });
    expect(result.ok).toBe(true);
    expect(eqCalls).toContainEqual(['language', 'de']);
  });

  it('getLeaderboardSubmissions applies a normalized language filter', async () => {
    const eqCalls: Array<[string, unknown]> = [];
    initBestChefClient(buildEqCaptureClient(eqCalls) as never);

    const result = await getLeaderboardSubmissions({
      kind: 'allTime',
      subFilter: null,
      language: 'pt-BR',
    });
    expect(result.ok).toBe(true);
    expect(eqCalls).toContainEqual(['language', 'pt-br']);
  });

  it('omits the language filter when not requested', async () => {
    const eqCalls: Array<[string, unknown]> = [];
    initBestChefClient(buildEqCaptureClient(eqCalls) as never);

    await getVoteFeed({ limit: 5 });
    expect(eqCalls.some(([column]) => column === 'language')).toBe(false);
  });

  it('skips the filter for junk language input instead of querying raw text', async () => {
    const eqCalls: Array<[string, unknown]> = [];
    initBestChefClient(buildEqCaptureClient(eqCalls) as never);

    await getVoteFeed({ limit: 5, language: 'not a locale' });
    await getLeaderboardSubmissions({ kind: 'allTime', subFilter: null, language: 'nope!!' });
    expect(eqCalls.some(([column]) => column === 'language')).toBe(false);
  });
});

describe('getVoteFeed display joins', () => {
  afterEach(() => {
    resetBestChefClient();
    vi.restoreAllMocks();
  });

  it('joins social profiles, dishes, and snapshots for Vote cards', async () => {
    const captures = { submissionSelects: [] as string[] };
    initBestChefClient(buildVoteFeedSupabase(captures) as never);

    const result = await getVoteFeed({ limit: 2 });

    expect(result.ok).toBe(true);
    expect(captures.submissionSelects[0]).toContain(
      'social_profiles!bc_submissions_profile_id_fkey',
    );
    expect(captures.submissionSelects[0]).toContain(
      'bc_dishes!bc_submissions_dish_id_fkey',
    );
    expect(captures.submissionSelects[0]).toContain(
      'bc_recipe_snapshots!bc_submissions_recipe_snapshot_id_fkey',
    );
    expect(captures.submissionSelects[0]).not.toContain('bc_profiles');

    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      chefDisplayName: 'ChefTom',
      dishName: 'Brownie Pudding',
      cuisine: 'American',
      dishRegion: 'Editorial Seed',
      comment_count: 3,
      topIngredients: ['1 cup cocoa powder', 'flour'],
    });
  });

  it('returns 20 unique feed rows when fresh and top queries overlap', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => buildVoteFeedRow(index + 1));
    initBestChefClient(buildOverlappingVoteFeedSupabase(rows) as never);

    const result = await getVoteFeed({
      limit: 20,
      viewerProfileId: '00000000-0000-4000-8000-000000000123',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(20);
    expect(new Set(result.data.map((entry) => entry.id)).size).toBe(20);
  });
});

describe('getLeaderboardSubmissions display joins', () => {
  afterEach(() => {
    resetBestChefClient();
    vi.restoreAllMocks();
  });

  it('joins dish and profile display fields for Top 100 leaderboard rows', async () => {
    const captures = { submissionSelects: [] as string[] };
    initBestChefClient(buildLeaderboardSupabase(captures) as never);

    const result = await getLeaderboardSubmissions({
      kind: 'allTime',
      subFilter: null,
      limit: 20,
      range: 'all',
    });

    expect(result.ok).toBe(true);
    expect(captures.submissionSelects[0]).toContain(
      'social_profiles!bc_submissions_profile_id_fkey',
    );
    expect(captures.submissionSelects[0]).toContain(
      'bc_dishes!bc_submissions_dish_id_fkey',
    );
    expect(captures.submissionSelects[0]).toContain(
      'bc_recipe_snapshots!bc_submissions_recipe_snapshot_id_fkey',
    );

    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      chefDisplayName: 'ChefTom',
      dishName: 'Seed Dish 1',
      cuisine: 'American',
      dishRegion: 'Editorial Seed',
      reviewedCount: 1000,
      voteScore: 1000,
      rank: 1,
    });
  });
});
