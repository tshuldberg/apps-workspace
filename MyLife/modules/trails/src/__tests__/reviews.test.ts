import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createTrail,
  createRecording,
  createReview,
  getPhotos,
  getPhotosByDateRange,
  getPhotosByTrail,
  getNearbyTrails,
  getTrailPhotos,
  getReviewsByTrail,
  updateReview,
  deleteReview,
  getAverageRating,
  getReviewCount,
  getRecentConditions,
  getRatingDistribution,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});
afterEach(() => { testDb.close(); });

const trailInput = {
  name: 'Test Trail', difficulty: 'moderate' as const,
  distanceMeters: 5000, elevationGainMeters: 300, lat: 37.77, lng: -122.42,
};

describe('Review CRUD', () => {
  it('creates a review', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    const review = createReview(testDb.adapter, 'rev1', {
      trailId: 't1', rating: 4, title: 'Great views',
      body: 'Beautiful trail with wildflowers',
      photoUris: '["file:///photo-1.jpg"]',
      conditions: '["clear","well_maintained"]',
      visitedAt: '2026-03-15',
    });
    expect(review.id).toBe('rev1');
    expect(review.rating).toBe(4);
    expect(review.title).toBe('Great views');
    expect(review.photoUris).toBe('["file:///photo-1.jpg"]');
    expect(review.isShared).toBe(false);
  });

  it('creates a review linked to a recording', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'r1', {
      name: 'Rec', activityType: 'hike', startedAt: '2026-01-01T08:00:00Z',
      distanceMeters: 5000, elevationGainMeters: 300, durationSeconds: 3600, trailId: 't1',
    });
    const review = createReview(testDb.adapter, 'rev1', {
      trailId: 't1', recordingId: 'r1', rating: 5,
    });
    expect(review.recordingId).toBe('r1');
  });

  it('lists reviews for a trail', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 3 });
    createReview(testDb.adapter, 'rev2', { trailId: 't1', rating: 5 });
    const reviews = getReviewsByTrail(testDb.adapter, 't1');
    expect(reviews).toHaveLength(2);
  });

  it('updates a review', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 3, title: 'OK' });
    const updated = updateReview(testDb.adapter, 'rev1', {
      rating: 5,
      title: 'Amazing',
      photoUris: '["file:///photo-2.jpg"]',
    });
    expect(updated).not.toBeNull();
    expect(updated!.rating).toBe(5);
    expect(updated!.title).toBe('Amazing');
    expect(updated!.photoUris).toBe('["file:///photo-2.jpg"]');
  });

  it('deletes a review', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 4 });
    deleteReview(testDb.adapter, 'rev1');
    expect(getReviewsByTrail(testDb.adapter, 't1')).toHaveLength(0);
  });

  it('cascades delete when trail is deleted', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 4 });
    testDb.adapter.execute('DELETE FROM tr_trails WHERE id = ?', ['t1']);
    expect(getReviewsByTrail(testDb.adapter, 't1')).toHaveLength(0);
  });
});

describe('Review Aggregates', () => {
  it('calculates average rating', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 4 });
    createReview(testDb.adapter, 'rev2', { trailId: 't1', rating: 5 });
    const avg = getAverageRating(testDb.adapter, 't1');
    expect(avg).toBe(4.5);
  });

  it('returns null average for no reviews', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    expect(getAverageRating(testDb.adapter, 't1')).toBeNull();
  });

  it('counts reviews', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 4 });
    createReview(testDb.adapter, 'rev2', { trailId: 't1', rating: 3 });
    expect(getReviewCount(testDb.adapter, 't1')).toBe(2);
  });

  it('returns 0 count for no reviews', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    expect(getReviewCount(testDb.adapter, 't1')).toBe(0);
  });

  it('gets recent conditions', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', {
      trailId: 't1', rating: 4, conditions: '["muddy","buggy"]',
    });
    const conditions = getRecentConditions(testDb.adapter, 't1');
    expect(conditions).toContain('muddy');
    expect(conditions).toContain('buggy');
  });

  it('returns empty conditions when no reviews have conditions', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 4 });
    const conditions = getRecentConditions(testDb.adapter, 't1');
    expect(conditions).toHaveLength(0);
  });

  it('gets rating distribution', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createReview(testDb.adapter, 'rev1', { trailId: 't1', rating: 5 });
    createReview(testDb.adapter, 'rev2', { trailId: 't1', rating: 5 });
    createReview(testDb.adapter, 'rev3', { trailId: 't1', rating: 3 });
    const dist = getRatingDistribution(testDb.adapter, 't1');
    expect(dist[5]).toBe(2);
    expect(dist[3]).toBe(1);
    expect(dist[1]).toBe(0);
    expect(dist[2]).toBe(0);
    expect(dist[4]).toBe(0);
  });
});

describe('Trail detail helpers', () => {
  it('returns trail photos linked directly and through recordings', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'r1', {
      name: 'Rec', activityType: 'hike', startedAt: '2026-01-01T08:00:00Z',
      distanceMeters: 5000, elevationGainMeters: 300, durationSeconds: 3600, trailId: 't1',
    });

    testDb.adapter.execute(
      `INSERT INTO tr_photos (id, recording_id, trail_id, lat, lng, uri, caption, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p1', null, 't1', 37.77, -122.42, 'file:///trail.jpg', 'Trail photo', '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z'],
    );
    testDb.adapter.execute(
      `INSERT INTO tr_photos (id, recording_id, trail_id, lat, lng, uri, caption, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p2', 'r1', null, 37.77, -122.42, 'file:///recording.jpg', 'Recording photo', '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z'],
    );

    const photos = getTrailPhotos(testDb.adapter, 't1');
    expect(photos).toHaveLength(2);
    expect(photos[0].uri).toBe('file:///recording.jpg');
    expect(photos[1].uri).toBe('file:///trail.jpg');
  });

  it('filters photos across trail, date range, and global library views', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createTrail(testDb.adapter, 't2', { ...trailInput, name: 'North Loop', lat: 38.1, lng: -121.9 });
    createRecording(testDb.adapter, 'r1', {
      name: 'Rec',
      activityType: 'hike',
      startedAt: '2026-01-01T08:00:00Z',
      distanceMeters: 5000,
      elevationGainMeters: 300,
      durationSeconds: 3600,
      trailId: 't1',
    });

    testDb.adapter.execute(
      `INSERT INTO tr_photos (id, recording_id, trail_id, lat, lng, uri, caption, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p1', null, 't1', 37.77, -122.42, 'file:///trail.jpg', 'Trail photo', '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z'],
    );
    testDb.adapter.execute(
      `INSERT INTO tr_photos (id, recording_id, trail_id, lat, lng, uri, caption, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p2', 'r1', null, 37.78, -122.41, 'file:///recording.jpg', 'Recording photo', '2026-01-10T09:00:00Z', '2026-01-10T09:00:00Z'],
    );
    testDb.adapter.execute(
      `INSERT INTO tr_photos (id, recording_id, trail_id, lat, lng, uri, caption, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p3', null, 't2', 38.10, -121.90, 'file:///north.jpg', 'North photo', '2026-02-10T09:00:00Z', '2026-02-10T09:00:00Z'],
    );

    expect(getPhotos(testDb.adapter)).toHaveLength(3);
    expect(getPhotosByTrail(testDb.adapter, 't1').map((photo) => photo.id)).toEqual(['p1']);
    expect(
      getPhotosByDateRange(
        testDb.adapter,
        '2026-01-01T00:00:00Z',
        '2026-01-31T23:59:59Z',
      ).map((photo) => photo.id),
    ).toEqual(['p2', 'p1']);
  });

  it('prioritizes nearby trails with similar region and difficulty', () => {
    createTrail(testDb.adapter, 't1', {
      ...trailInput,
      region: 'Marin',
      difficulty: 'moderate',
      lat: 37.88,
      lng: -122.56,
    });
    createTrail(testDb.adapter, 't2', {
      ...trailInput,
      name: 'Closest Match',
      region: 'Marin',
      difficulty: 'moderate',
      lat: 37.881,
      lng: -122.561,
    });
    createTrail(testDb.adapter, 't3', {
      ...trailInput,
      name: 'Closer But Different',
      region: 'Marin',
      difficulty: 'hard',
      lat: 37.8805,
      lng: -122.5605,
    });
    createTrail(testDb.adapter, 't4', {
      ...trailInput,
      name: 'Farther Match',
      region: 'Marin',
      difficulty: 'moderate',
      lat: 37.95,
      lng: -122.63,
    });

    const nearby = getNearbyTrails(testDb.adapter, 't1', 3);
    expect(nearby.map((trail) => trail.id)).toEqual(['t2', 't4', 't3']);
  });
});
