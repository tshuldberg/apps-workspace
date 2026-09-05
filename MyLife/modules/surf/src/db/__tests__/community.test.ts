import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { SURF_MODULE } from '../../definition';
import {
  createSpot,
  createSpotReview,
  getSpotReviews,
  deleteSpotReview,
  createSpotPhoto,
  getSpotPhotos,
  deleteSpotPhoto,
  upsertSpotGuide,
  getSpotGuide,
} from '../crud';

describe('@mylife/surf - community CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('surf', SURF_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    createSpot(adapter, 'spot-1', {
      name: 'Ocean Beach',
      region: 'san_francisco',
      breakType: 'beach',
    });
  });

  afterEach(() => {
    closeDb();
  });

  // ── Reviews ──

  describe('reviews', () => {
    it('creates a review and retrieves it', () => {
      createSpotReview(adapter, 'rev-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        rating: 4,
        title: 'Great spot',
        body: 'Consistent waves, fun session',
      });

      const reviews = getSpotReviews(adapter, 'spot-1');
      expect(reviews).toHaveLength(1);
      expect(reviews[0]!.id).toBe('rev-1');
      expect(reviews[0]!.spotId).toBe('spot-1');
      expect(reviews[0]!.userId).toBe('user-1');
      expect(reviews[0]!.rating).toBe(4);
      expect(reviews[0]!.title).toBe('Great spot');
      expect(reviews[0]!.body).toBe('Consistent waves, fun session');
    });

    it('creates a review without title', () => {
      createSpotReview(adapter, 'rev-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        rating: 3,
        body: 'Decent day',
      });

      const reviews = getSpotReviews(adapter, 'spot-1');
      expect(reviews[0]!.title).toBeUndefined();
    });

    it('retrieves multiple reviews for the same spot', () => {
      createSpotReview(adapter, 'rev-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        rating: 4,
        body: 'Great',
      });
      createSpotReview(adapter, 'rev-2', {
        spotId: 'spot-1',
        userId: 'user-2',
        rating: 5,
        body: 'Epic',
      });

      const reviews = getSpotReviews(adapter, 'spot-1');
      expect(reviews).toHaveLength(2);
    });

    it('limits results with limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        createSpotReview(adapter, `rev-${i}`, {
          spotId: 'spot-1',
          userId: `user-${i}`,
          rating: 3,
          body: `Review ${i}`,
        });
      }
      const limited = getSpotReviews(adapter, 'spot-1', 2);
      expect(limited).toHaveLength(2);
    });

    it('deletes a review by id', () => {
      createSpotReview(adapter, 'rev-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        rating: 4,
        body: 'Nice',
      });
      deleteSpotReview(adapter, 'rev-1');
      expect(getSpotReviews(adapter, 'spot-1')).toEqual([]);
    });

    it('returns empty array when no reviews exist', () => {
      expect(getSpotReviews(adapter, 'spot-1')).toEqual([]);
    });
  });

  // ── Photos ──

  describe('photos', () => {
    it('creates a photo and retrieves it', () => {
      createSpotPhoto(adapter, 'photo-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        imageUrl: 'https://cdn.example.com/photo1.jpg',
        caption: 'Perfect barrel',
        latitude: 37.75,
        longitude: -122.51,
        takenAt: '2026-03-08T08:00:00Z',
      });

      const photos = getSpotPhotos(adapter, 'spot-1');
      expect(photos).toHaveLength(1);
      expect(photos[0]!.id).toBe('photo-1');
      expect(photos[0]!.imageUrl).toBe('https://cdn.example.com/photo1.jpg');
      expect(photos[0]!.caption).toBe('Perfect barrel');
      expect(photos[0]!.latitude).toBeCloseTo(37.75);
      expect(photos[0]!.longitude).toBeCloseTo(-122.51);
      expect(photos[0]!.takenAt).toBe('2026-03-08T08:00:00Z');
    });

    it('creates a photo with minimal fields', () => {
      createSpotPhoto(adapter, 'photo-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        imageUrl: 'https://cdn.example.com/photo1.jpg',
      });

      const photos = getSpotPhotos(adapter, 'spot-1');
      expect(photos[0]!.caption).toBeUndefined();
      expect(photos[0]!.reviewId).toBeUndefined();
    });

    it('creates a photo linked to a review', () => {
      createSpotReview(adapter, 'rev-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        rating: 4,
        body: 'Nice',
      });
      createSpotPhoto(adapter, 'photo-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        imageUrl: 'https://cdn.example.com/photo1.jpg',
        reviewId: 'rev-1',
      });

      const photos = getSpotPhotos(adapter, 'spot-1');
      expect(photos[0]!.reviewId).toBe('rev-1');
    });

    it('limits results', () => {
      for (let i = 0; i < 5; i++) {
        createSpotPhoto(adapter, `photo-${i}`, {
          spotId: 'spot-1',
          userId: 'user-1',
          imageUrl: `https://cdn.example.com/photo${i}.jpg`,
        });
      }
      const limited = getSpotPhotos(adapter, 'spot-1', 2);
      expect(limited).toHaveLength(2);
    });

    it('deletes a photo by id', () => {
      createSpotPhoto(adapter, 'photo-1', {
        spotId: 'spot-1',
        userId: 'user-1',
        imageUrl: 'https://cdn.example.com/photo1.jpg',
      });
      deleteSpotPhoto(adapter, 'photo-1');
      expect(getSpotPhotos(adapter, 'spot-1')).toEqual([]);
    });

    it('returns empty array when no photos exist', () => {
      expect(getSpotPhotos(adapter, 'spot-1')).toEqual([]);
    });
  });

  // ── Guides ──

  describe('guides', () => {
    it('creates a guide and retrieves it', () => {
      upsertSpotGuide(adapter, {
        id: 'guide-1',
        spotId: 'spot-1',
        bestTideWindow: 'Mid to high',
        bestSwellDirection: 'W-NW',
        hazards: ['rip_currents', 'shore_break'],
        parkingNotes: 'Metered lot at Sloat',
        crowdNotes: 'Crowded on weekends',
        localTips: 'Best at the VFW section',
      });

      const guide = getSpotGuide(adapter, 'spot-1');
      expect(guide).not.toBeNull();
      expect(guide!.spotId).toBe('spot-1');
      expect(guide!.bestTideWindow).toBe('Mid to high');
      expect(guide!.bestSwellDirection).toBe('W-NW');
      expect(guide!.hazards).toEqual(['rip_currents', 'shore_break']);
      expect(guide!.parkingNotes).toBe('Metered lot at Sloat');
      expect(guide!.crowdNotes).toBe('Crowded on weekends');
      expect(guide!.localTips).toBe('Best at the VFW section');
    });

    it('upserts (replaces) an existing guide', () => {
      upsertSpotGuide(adapter, {
        id: 'guide-1',
        spotId: 'spot-1',
        bestTideWindow: 'Mid',
        bestSwellDirection: 'W',
        hazards: [],
        parkingNotes: 'Old notes',
        crowdNotes: 'Old',
        localTips: 'Old',
      });

      upsertSpotGuide(adapter, {
        id: 'guide-1',
        spotId: 'spot-1',
        bestTideWindow: 'Mid to high',
        bestSwellDirection: 'W-NW',
        hazards: ['rocks'],
        parkingNotes: 'Updated notes',
        crowdNotes: 'Updated',
        localTips: 'Updated tips',
      });

      const guide = getSpotGuide(adapter, 'spot-1');
      expect(guide!.bestTideWindow).toBe('Mid to high');
      expect(guide!.parkingNotes).toBe('Updated notes');
      expect(guide!.hazards).toEqual(['rocks']);
    });

    it('returns null for non-existent spot guide', () => {
      expect(getSpotGuide(adapter, 'no-spot')).toBeNull();
    });
  });
});
