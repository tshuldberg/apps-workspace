import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  applyFollowerUpdateSeed,
  buildFollowerUpdateSeedPayload,
  countFollowedChefs,
  followChef,
  getFollowedChef,
  getFollowerUpdateSeed,
  getLatestFollowerUpdateSeed,
  isFollowingChef,
  listFollowedChefs,
  publishFollowerUpdateSeed,
  unfollowChef,
} from '../follower-updates';

describe('BestChef follower updates', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates the local follow and follower seed tables in the module migration', () => {
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name IN ('rc_chef_follows', 'rc_follower_update_seeds')
       ORDER BY name`,
    );

    expect(rows.map((row) => row.name)).toEqual([
      'rc_chef_follows',
      'rc_follower_update_seeds',
    ]);
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
  });

  it('creates syncable beta social activity tables', () => {
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name IN ('rc_bestchef_submissions', 'rc_bestchef_comments', 'rc_bestchef_votes')
       ORDER BY name`,
    );

    expect(rows.map((row) => row.name)).toEqual([
      'rc_bestchef_comments',
      'rc_bestchef_submissions',
      'rc_bestchef_votes',
    ]);

    const policyTables = new Set(
      RECIPES_MODULE.syncPolicy?.entityRules.map((rule) => rule.tableName) ?? [],
    );
    expect(policyTables.has('bestchef_submissions')).toBe(true);
    expect(policyTables.has('bestchef_comments')).toBe(true);
    expect(policyTables.has('bestchef_votes')).toBe(true);
  });

  it('keeps media cache metadata device local', () => {
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name = 'rc_bestchef_media_cache'`,
    );
    expect(rows.map((row) => row.name)).toEqual(['rc_bestchef_media_cache']);

    const mediaRule = RECIPES_MODULE.syncPolicy?.entityRules.find(
      (rule) => rule.tableName === 'bestchef_media_cache',
    );
    expect(mediaRule?.defaultScope).toBe('device_local');
  });

  it('syncs private recipe grocery flags as personal replica data', () => {
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name = 'rc_recipe_grocery_flags'`,
    );
    expect(rows.map((row) => row.name)).toEqual(['rc_recipe_grocery_flags']);

    const groceryFlagRule = RECIPES_MODULE.syncPolicy?.entityRules.find(
      (rule) => rule.tableName === 'recipe_grocery_flags',
    );
    expect(groceryFlagRule?.defaultScope).toBe('personal_replica');
  });

  it('syncs shopping lists and items as personal replica kitchen data', () => {
    const policyTables = new Set(
      RECIPES_MODULE.syncPolicy?.entityRules.map((rule) => rule.tableName) ?? [],
    );

    expect(policyTables.has('shopping_lists')).toBe(true);
    expect(policyTables.has('shopping_list_items')).toBe(true);
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'shopping_lists')
        ?.defaultScope,
    ).toBe('personal_replica');
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'shopping_lists')
        ?.maxScope,
    ).toBe('shared_workspace');
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'shopping_list_items')
        ?.defaultScope,
    ).toBe('personal_replica');
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'shopping_list_items')
        ?.maxScope,
    ).toBe('shared_workspace');
  });

  it('persists a followed chef and updates the cached local map snapshot', () => {
    const first = followChef(
      db,
      {
        chefId: 'c1',
        displayName: 'Somchai K.',
        handle: '@somchai_bkk',
        location: 'Bangkok, Thailand',
        topCuisine: 'Thai',
        followerCount: 1240,
        submissions: [
          {
            id: 's1',
            dishId: 'd1',
            dishName: 'Pad Thai',
            title: 'Grandma Pad Thai',
            ingredients: ['Rice noodles', 'tamarind', 'rice noodles'],
            tags: ['cuisine:thai'],
            voteScore: 847,
            rank: 1,
            createdAt: '2026-03-15',
          },
        ],
      },
      '2026-04-24T12:00:00.000Z',
    );

    expect(first.handle).toBe('somchai_bkk');
    expect(first.followedAt).toBe('2026-04-24T12:00:00.000Z');
    expect(first.cachedPayload?.localMap.ingredientNames).toEqual([
      'Rice noodles',
      'tamarind',
    ]);
    expect(isFollowingChef(db, 'c1')).toBe(true);
    expect(countFollowedChefs(db)).toBe(1);

    const second = followChef(
      db,
      {
        chefId: 'c1',
        displayName: 'Somchai K.',
        handle: 'somchai_bkk',
        followerCount: 1241,
        submissions: [
          {
            id: 's2',
            dishId: 'd2',
            dishName: 'Tom Yum',
            title: 'Tom Yum',
            ingredients: ['lemongrass'],
          },
        ],
      },
      '2026-04-24T13:00:00.000Z',
    );

    expect(second.followedAt).toBe(first.followedAt);
    expect(second.updatedAt).toBe('2026-04-24T13:00:00.000Z');
    expect(second.followerCount).toBe(1241);
    expect(second.cachedPayload?.localMap.dishNames).toEqual(['Tom Yum']);
    expect(listFollowedChefs(db)).toHaveLength(1);
  });

  it('removes a followed chef', () => {
    followChef(
      db,
      { chefId: 'c1', displayName: 'Somchai K.', handle: 'somchai_bkk' },
      '2026-04-24T12:00:00.000Z',
    );

    unfollowChef(db, 'c1');

    expect(getFollowedChef(db, 'c1')).toBeNull();
    expect(isFollowingChef(db, 'c1')).toBe(false);
  });

  it('builds follower update seed payloads with stats and map data', () => {
    const payload = buildFollowerUpdateSeedPayload(
      {
        chefId: 'local',
        displayName: 'Chef Local',
        handle: '@chef_local',
        bio: 'Regional cooking notes',
        location: 'Los Angeles, CA',
        topCuisine: 'Thai',
        topCuisines: ['Mexican', 'Thai'],
        followerCount: 4,
        followingCount: 2,
        totalVotes: 10,
        wins: 1,
        submissions: [
          {
            id: 'local-1',
            dishId: 'd1',
            dishName: 'Pad Thai',
            title: 'Weeknight Pad Thai',
            ingredients: ['rice noodles', 'tofu'],
          },
        ],
      },
      3,
      '2026-04-24T12:00:00.000Z',
    );

    expect(payload.chef.handle).toBe('chef_local');
    expect(payload.chef.topCuisines).toEqual(['Mexican', 'Thai']);
    expect(payload.stats).toMatchObject({
      followerCount: 4,
      followingCount: 2,
      submissionCount: 1,
      totalVotes: 10,
      wins: 1,
    });
    expect(payload.localMap.dishIds).toEqual(['d1']);
    expect(payload.localMap.ingredientNames).toEqual(['rice noodles', 'tofu']);
  });

  it('publishes versioned follower update seeds and supersedes older seeds', () => {
    const first = publishFollowerUpdateSeed(
      db,
      {
        chefId: 'local',
        displayName: 'Chef Local',
        handle: 'chef_local',
        followerCount: 1,
      },
      '2026-04-24T12:00:00.000Z',
    );
    const second = publishFollowerUpdateSeed(
      db,
      {
        chefId: 'local',
        displayName: 'Chef Local',
        handle: 'chef_local',
        followerCount: 2,
        submissions: [
          {
            id: 'local-1',
            dishId: 'd1',
            title: 'Pad Thai',
          },
        ],
      },
      '2026-04-24T13:00:00.000Z',
    );

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(getFollowerUpdateSeed(db, first.id)?.status).toBe('superseded');
    expect(getLatestFollowerUpdateSeed(db, 'local')?.id).toBe(second.id);
    expect(second.payload?.stats.followerCount).toBe(2);
    expect(second.payload?.submissions).toHaveLength(1);
  });

  it('applies a follower update seed to the local follow cache', () => {
    followChef(
      db,
      {
        chefId: 'chef-seed',
        displayName: 'Old Name',
        handle: 'old_handle',
        followerCount: 1,
      },
      '2026-04-24T10:00:00.000Z',
    );

    const seed = publishFollowerUpdateSeed(
      db,
      {
        chefId: 'chef-seed',
        displayName: 'Updated Chef',
        handle: '@updated_chef',
        location: 'Seoul, South Korea',
        topCuisines: ['Korean'],
        followerCount: 48,
        submissions: [
          {
            id: 'seed-submission-1',
            dishId: 'kimchi-jjigae',
            dishName: 'Kimchi Jjigae',
            title: 'Family Kimchi Jjigae',
            ingredients: ['kimchi', 'tofu'],
            tags: ['cuisine:korean'],
          },
        ],
      },
      '2026-04-24T14:00:00.000Z',
    );

    const updated = applyFollowerUpdateSeed(db, seed, '2026-04-24T15:00:00.000Z');

    expect(updated.followedAt).toBe('2026-04-24T10:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-04-24T15:00:00.000Z');
    expect(updated.lastSeedAt).toBe('2026-04-24T14:00:00.000Z');
    expect(updated.seedRevision).toBe(1);
    expect(updated.displayName).toBe('Updated Chef');
    expect(updated.followerCount).toBe(48);
    expect(updated.cachedPayload?.source).toBe('bestchef_follower_update_seed');
    expect(updated.cachedPayload?.localMap.dishNames).toEqual(['Kimchi Jjigae']);
    expect(updated.cachedPayload?.localMap.ingredientNames).toEqual(['kimchi', 'tofu']);
  });
});
