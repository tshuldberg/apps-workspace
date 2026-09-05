import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../definition';

// ── Plate Calculator ──
import { calculatePlates } from '../workout/plates';
import type { InventoryPlate } from '../workout/plates';

// ── Plate Inventory CRUD ──
import {
  createPlateInventory,
  getPlateInventories,
  getPlateInventoryById,
  updatePlateInventory,
  deletePlateInventory,
} from '../db/crud';

// ── Progress Photo CRUD ──
import {
  createProgressPhoto,
  getProgressPhotos,
  getProgressPhotoById,
  deleteProgressPhoto,
  getProgressPhotoCount,
} from '../db/crud';

// ── Demo ──
import { resolveDemoAsset, getDemoStatus, isBundledAsset, extractAssetPath } from '../demo';

// ── Sharing ──
import { buildWorkoutSummary } from '../sharing';

// ── Social ──
import { applyPrivacyFilter, normalizePrivacySettings } from '../social/privacy';
import { sortFeedChronological, paginateFeed, isPostVisible, enrichPost } from '../social/feed';
import type { WorkoutSummaryCard, SocialPost } from '../types';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function setupDb(): DatabaseAdapter {
  const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  return adapter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plate Calculator Improvements
// ─────────────────────────────────────────────────────────────────────────────

describe('plate calculator with custom inventory', () => {
  it('uses standard lbs plates when no custom inventory', () => {
    const result = calculatePlates(225, 45, 'lbs');
    expect(result.totalWeight).toBe(225);
    expect(result.remainder).toBe(0);
    expect(result.perSide).toEqual([{ weight: 45, count: 2 }]);
  });

  it('uses standard kg plates when no custom inventory', () => {
    const result = calculatePlates(100, 20, 'kg');
    expect(result.totalWeight).toBe(100);
    expect(result.remainder).toBe(0);
    expect(result.perSide).toEqual([{ weight: 25, count: 1 }, { weight: 15, count: 1 }]);
  });

  it('returns empty when target <= bar weight', () => {
    const result = calculatePlates(40, 45, 'lbs');
    expect(result.perSide).toEqual([]);
    expect(result.totalWeight).toBe(45);
    expect(result.remainder).toBe(0);
  });

  it('respects custom plate count limits', () => {
    const custom: InventoryPlate[] = [
      { weight: 45, count: 2 }, // 1 per side max
      { weight: 25, count: 4 }, // 2 per side max
      { weight: 10, count: 4 },
    ];
    // Target: 225 lbs, bar: 45, need 90 per side
    // 1x45 = 45, 1x25 = 25, 2x10 = 20, total per side = 90
    const result = calculatePlates(225, 45, 'lbs', custom);
    expect(result.totalWeight).toBe(225);
    expect(result.remainder).toBe(0);
  });

  it('shows remainder when custom inventory cannot reach target', () => {
    const custom: InventoryPlate[] = [
      { weight: 25, count: 4 },
    ];
    // Target: 135, bar: 45, need 45 per side
    // Max per side: 2x25 = 50, but greedy takes 1x25=25, remaining 20, no more -> remainder
    const result = calculatePlates(135, 45, 'lbs', custom);
    expect(result.totalWeight).toBe(95); // 45 + 25*2
    expect(result.remainder).toBe(20);
  });

  it('handles empty custom inventory', () => {
    const result = calculatePlates(135, 45, 'lbs', []);
    // Falls through to standard plates since array is empty
    expect(result.totalWeight).toBe(135);
  });

  it('handles plate with count 1 (not enough for both sides)', () => {
    const custom: InventoryPlate[] = [
      { weight: 45, count: 1 }, // floor(1/2) = 0, can't use
      { weight: 25, count: 4 },
    ];
    const result = calculatePlates(135, 45, 'lbs', custom);
    // Can't use 45s, use 25s: need 45 per side, 1x25=25, remaining 20, no more
    expect(result.perSide[0].weight).toBe(25);
  });
});

describe('plate inventory CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    closeDb();
  });

  it('creates and retrieves a plate inventory', () => {
    const inv = createPlateInventory(db, {
      name: 'Home Gym',
      unit: 'lbs',
      platesJson: JSON.stringify([{ weight: 25, count: 4 }, { weight: 10, count: 4 }]),
      barWeight: 45,
    });
    expect(inv.name).toBe('Home Gym');
    expect(inv.plates).toEqual([{ weight: 25, count: 4 }, { weight: 10, count: 4 }]);
    expect(inv.barWeight).toBe(45);
  });

  it('lists all inventories', () => {
    createPlateInventory(db, { name: 'Gym A', platesJson: '[]', barWeight: 45 });
    createPlateInventory(db, { name: 'Gym B', platesJson: '[]', barWeight: 35 });
    const list = getPlateInventories(db);
    expect(list).toHaveLength(2);
  });

  it('updates an inventory', () => {
    const inv = createPlateInventory(db, { name: 'Old', platesJson: '[]', barWeight: 45 });
    updatePlateInventory(db, inv.id, { name: 'New', barWeight: 35 });
    const updated = getPlateInventoryById(db, inv.id);
    expect(updated?.name).toBe('New');
    expect(updated?.barWeight).toBe(35);
  });

  it('deletes an inventory', () => {
    const inv = createPlateInventory(db, { name: 'Delete Me', platesJson: '[]', barWeight: 45 });
    deletePlateInventory(db, inv.id);
    expect(getPlateInventoryById(db, inv.id)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Progress Photos
// ─────────────────────────────────────────────────────────────────────────────

describe('progress photo CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    closeDb();
  });

  it('creates a progress photo', () => {
    const photo = createProgressPhoto(db, {
      photoUri: '/docs/photos/abc.jpg',
      viewType: 'front',
      notes: 'Week 1',
      takenAt: '2026-03-01T10:00:00Z',
      fileSizeBytes: 1024000,
      width: 1080,
      height: 1920,
    });
    expect(photo.photoUri).toBe('/docs/photos/abc.jpg');
    expect(photo.viewType).toBe('front');
    expect(photo.notes).toBe('Week 1');
    expect(photo.width).toBe(1080);
  });

  it('lists photos sorted by taken_at DESC', () => {
    createProgressPhoto(db, { photoUri: '/a.jpg', viewType: 'front', takenAt: '2026-01-01T00:00:00Z' });
    createProgressPhoto(db, { photoUri: '/b.jpg', viewType: 'back', takenAt: '2026-03-01T00:00:00Z' });
    createProgressPhoto(db, { photoUri: '/c.jpg', viewType: 'side_left', takenAt: '2026-02-01T00:00:00Z' });
    const photos = getProgressPhotos(db);
    expect(photos).toHaveLength(3);
    expect(photos[0].photoUri).toBe('/b.jpg'); // newest first
  });

  it('filters by view type', () => {
    createProgressPhoto(db, { photoUri: '/front1.jpg', viewType: 'front', takenAt: '2026-01-01T00:00:00Z' });
    createProgressPhoto(db, { photoUri: '/back1.jpg', viewType: 'back', takenAt: '2026-01-02T00:00:00Z' });
    createProgressPhoto(db, { photoUri: '/front2.jpg', viewType: 'front', takenAt: '2026-01-03T00:00:00Z' });
    const frontPhotos = getProgressPhotos(db, 'front');
    expect(frontPhotos).toHaveLength(2);
    expect(frontPhotos.every((p) => p.viewType === 'front')).toBe(true);
  });

  it('deletes a photo', () => {
    const photo = createProgressPhoto(db, { photoUri: '/del.jpg', viewType: 'front', takenAt: '2026-01-01T00:00:00Z' });
    deleteProgressPhoto(db, photo.id);
    expect(getProgressPhotoById(db, photo.id)).toBeNull();
  });

  it('counts photos', () => {
    createProgressPhoto(db, { photoUri: '/a.jpg', viewType: 'front', takenAt: '2026-01-01T00:00:00Z' });
    createProgressPhoto(db, { photoUri: '/b.jpg', viewType: 'back', takenAt: '2026-01-02T00:00:00Z' });
    expect(getProgressPhotoCount(db)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workout Sharing
// ─────────────────────────────────────────────────────────────────────────────

describe('workout sharing', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = setupDb();
    // Seed an exercise
    db.execute(
      `INSERT INTO wk_exercises (id, name, category, muscle_groups_json, difficulty)
       VALUES ('ex1', 'Bench Press', 'strength', '["chest","triceps"]', 'intermediate')`,
    );
    // Seed a workout
    db.execute(
      `INSERT INTO wk_workouts (id, title, exercises_json, estimated_duration)
       VALUES ('w1', 'Chest Day', '[{"exerciseId":"ex1","name":"Bench Press"}]', 45)`,
    );
  });

  afterEach(() => {
    closeDb();
  });

  it('builds a summary from a completed session', () => {
    db.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at, completed_at, exercises_completed_json)
       VALUES ('s1', 'w1', '2026-03-01T10:00:00Z', '2026-03-01T10:45:00Z', '[{"exercise_id":"ex1","sets_completed":3,"reps_completed":24,"skipped":false}]')`,
    );
    db.execute(
      `INSERT INTO wk_workout_set_weights (id, session_id, exercise_id, set_number, weight, reps, estimated_1rm)
       VALUES ('sw1', 's1', 'ex1', 1, 135, 8, 170), ('sw2', 's1', 'ex1', 2, 135, 8, 170), ('sw3', 's1', 'ex1', 3, 135, 6, 162)`,
    );
    const summary = buildWorkoutSummary(db, 's1');
    expect(summary).not.toBeNull();
    expect(summary!.title).toBe('Chest Day');
    expect(summary!.durationMinutes).toBe(45);
    expect(summary!.exerciseCount).toBe(1);
    expect(summary!.totalSets).toBe(3);
    expect(summary!.totalReps).toBe(22); // 8+8+6
    expect(summary!.totalVolume).toBe(Math.round(135 * 8 + 135 * 8 + 135 * 6)); // 2970
    expect(summary!.muscleGroups).toContain('chest');
  });

  it('returns null for nonexistent session', () => {
    expect(buildWorkoutSummary(db, 'nonexistent')).toBeNull();
  });

  it('handles session with zero set weights', () => {
    db.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at, completed_at, exercises_completed_json)
       VALUES ('s2', 'w1', '2026-03-01T10:00:00Z', '2026-03-01T10:30:00Z', '[{"exercise_id":"ex1","sets_completed":3,"reps_completed":24,"skipped":false}]')`,
    );
    const summary = buildWorkoutSummary(db, 's2');
    expect(summary).not.toBeNull();
    expect(summary!.totalVolume).toBe(0);
    expect(summary!.totalSets).toBe(3); // fallback from exercises_completed
  });

  it('truncates long titles', () => {
    db.execute(
      `INSERT INTO wk_workouts (id, title, exercises_json, estimated_duration)
       VALUES ('w2', 'This Is An Extremely Long Workout Title That Exceeds Forty Characters', '[]', 30)`,
    );
    db.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at, completed_at, exercises_completed_json)
       VALUES ('s3', 'w2', '2026-03-01T10:00:00Z', '2026-03-01T10:30:00Z', '[]')`,
    );
    const summary = buildWorkoutSummary(db, 's3');
    expect(summary!.title.length).toBeLessThanOrEqual(40);
    expect(summary!.title.endsWith('...')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Video Exercise Demos
// ─────────────────────────────────────────────────────────────────────────────

describe('demo asset resolution', () => {
  it('resolves lottie bundled asset', () => {
    const asset = resolveDemoAsset('asset://demos/pushup.lottie.json', null);
    expect(asset).not.toBeNull();
    expect(asset!.type).toBe('lottie');
    expect(asset!.uri).toBe('asset://demos/pushup.lottie.json');
  });

  it('resolves GIF asset', () => {
    const asset = resolveDemoAsset('asset://demos/squat.gif', null);
    expect(asset!.type).toBe('gif');
  });

  it('resolves remote video URL', () => {
    const asset = resolveDemoAsset('https://cdn.example.com/demo.mp4', 'https://cdn.example.com/thumb.jpg');
    expect(asset!.type).toBe('video');
    expect(asset!.thumbnailUri).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('returns null for null video_url', () => {
    expect(resolveDemoAsset(null, null)).toBeNull();
  });

  it('returns null for empty string video_url', () => {
    expect(resolveDemoAsset('', null)).toBeNull();
  });

  it('getDemoStatus returns available when video_url exists', () => {
    expect(getDemoStatus('asset://demos/pushup.lottie.json')).toBe('available');
  });

  it('getDemoStatus returns unavailable when video_url is null', () => {
    expect(getDemoStatus(null)).toBe('unavailable');
  });

  it('isBundledAsset detects asset:// URIs', () => {
    expect(isBundledAsset('asset://demos/pushup.lottie.json')).toBe(true);
    expect(isBundledAsset('https://cdn.example.com/demo.mp4')).toBe(false);
  });

  it('extractAssetPath strips asset:// prefix', () => {
    expect(extractAssetPath('asset://demos/pushup.lottie.json')).toBe('demos/pushup.lottie.json');
    expect(extractAssetPath('https://cdn.example.com')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Social Feed
// ─────────────────────────────────────────────────────────────────────────────

describe('social privacy filter', () => {
  const card: WorkoutSummaryCard = {
    sessionId: 's1',
    title: 'Chest Day',
    date: '2026-03-01',
    durationMinutes: 45,
    exerciseCount: 5,
    totalSets: 15,
    totalReps: 120,
    totalVolume: 5000,
    prsHit: [{ exerciseName: 'Bench Press', estimated1rm: 225 }],
    muscleGroups: ['chest', 'triceps'],
  };

  it('applies default privacy (weight details hidden)', () => {
    const filtered = applyPrivacyFilter(card, {});
    expect(filtered.title).toBe('Chest Day'); // title shared by default
    expect(filtered.durationMinutes).toBe(45); // duration shared by default
    expect(filtered.totalSets).toBe(0); // weight details hidden by default
    expect(filtered.totalReps).toBe(0);
    expect(filtered.totalVolume).toBe(0);
    expect(filtered.prsHit).toHaveLength(1); // PRs shared by default
    expect(filtered.exerciseCount).toBe(5); // exercises shared by default
  });

  it('hides everything when all sharing disabled', () => {
    const filtered = applyPrivacyFilter(card, {
      shareTitle: false,
      shareExercises: false,
      shareWeightDetails: false,
      sharePrs: false,
      shareDuration: false,
    });
    expect(filtered.title).toBe('Workout');
    expect(filtered.durationMinutes).toBe(0);
    expect(filtered.exerciseCount).toBe(0);
    expect(filtered.totalSets).toBe(0);
    expect(filtered.prsHit).toHaveLength(0);
    expect(filtered.muscleGroups).toHaveLength(0);
  });

  it('shows everything when all sharing enabled', () => {
    const filtered = applyPrivacyFilter(card, {
      shareTitle: true,
      shareExercises: true,
      shareWeightDetails: true,
      sharePrs: true,
      shareDuration: true,
    });
    expect(filtered.title).toBe('Chest Day');
    expect(filtered.totalSets).toBe(15);
    expect(filtered.totalVolume).toBe(5000);
  });

  it('normalizePrivacySettings fills defaults', () => {
    const settings = normalizePrivacySettings({ shareTitle: false });
    expect(settings.shareTitle).toBe(false);
    expect(settings.shareWeightDetails).toBe(false); // default
    expect(settings.shareDuration).toBe(true); // default
  });
});

describe('social feed helpers', () => {
  const makePost = (id: string, createdAt: string): SocialPost => ({
    id,
    userId: 'user1',
    sessionId: 's1',
    content: {
      sessionId: 's1',
      title: 'Workout',
      date: createdAt,
      durationMinutes: 30,
      exerciseCount: 3,
      totalSets: 9,
      totalReps: 72,
      totalVolume: 2000,
      prsHit: [],
      muscleGroups: [],
    },
    privacySettings: {},
    createdAt,
  });

  it('sorts posts chronologically (newest first)', () => {
    const posts = [
      makePost('p1', '2026-03-01T10:00:00Z'),
      makePost('p3', '2026-03-03T10:00:00Z'),
      makePost('p2', '2026-03-02T10:00:00Z'),
    ];
    const sorted = sortFeedChronological(posts);
    expect(sorted[0].id).toBe('p3');
    expect(sorted[1].id).toBe('p2');
    expect(sorted[2].id).toBe('p1');
  });

  it('paginates feed correctly', () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePost(`p${i}`, `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    );
    const page = paginateFeed(posts, 3, 5);
    expect(page).toHaveLength(5);
    expect(page[0].id).toBe('p3');
    expect(page[4].id).toBe('p7');
  });

  it('isPostVisible returns true for visible post', () => {
    expect(isPostVisible({
      sessionId: 's1', title: 'Workout', date: '', durationMinutes: 30,
      exerciseCount: 0, totalSets: 0, totalReps: 0, totalVolume: 0,
      prsHit: [], muscleGroups: [],
    })).toBe(true); // duration > 0
  });

  it('isPostVisible returns false for fully hidden post', () => {
    expect(isPostVisible({
      sessionId: 's1', title: 'Workout', date: '', durationMinutes: 0,
      exerciseCount: 0, totalSets: 0, totalReps: 0, totalVolume: 0,
      prsHit: [], muscleGroups: [],
    })).toBe(false);
  });

  it('enriches a post with counts and author', () => {
    const post = makePost('p1', '2026-03-01T10:00:00Z');
    const enriched = enrichPost(post, 5, 2, true, 'Alice', 'https://avatar.url');
    expect(enriched.likeCount).toBe(5);
    expect(enriched.commentCount).toBe(2);
    expect(enriched.isLikedByMe).toBe(true);
    expect(enriched.authorName).toBe('Alice');
    expect(enriched.authorAvatarUrl).toBe('https://avatar.url');
  });
});
