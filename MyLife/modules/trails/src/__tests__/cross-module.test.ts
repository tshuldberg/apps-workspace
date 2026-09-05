import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import { getTodayCards } from '../cross-module';
import { createRecording } from '../db/crud';

let testDb: InMemoryTestDatabase;

const FIXED_NOW = new Date('2026-04-18T15:00:00.000Z');

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('trails.getTodayCards', () => {
  it('returns empty array on an empty database', () => {
    const cards = getTodayCards(testDb.adapter, { now: FIXED_NOW });
    expect(cards).toEqual([]);
  });

  it('surfaces a recently completed hike as a progress card', () => {
    createRecording(testDb.adapter, 'rec-done', {
      name: 'Sunset Loop',
      activityType: 'hike',
      startedAt: '2026-04-18T07:00:00.000Z',
      endedAt: '2026-04-18T09:30:00.000Z',
      distanceMeters: 6760,
      elevationGainMeters: 340,
      durationSeconds: 9000,
    });

    const cards = getTodayCards(testDb.adapter, { now: FIXED_NOW });
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card.moduleId).toBe('trails');
    expect(card.kind).toBe('progress');
    expect(card.priority).toBe(40);
    expect(card.title).toBe('Sunset Loop');
    expect(card.subtitle).toContain('mi');
    expect(card.subtitle).toContain('ft');
  });

  it('skips a completed hike older than 24h', () => {
    createRecording(testDb.adapter, 'rec-old', {
      name: 'Old Hike',
      activityType: 'hike',
      startedAt: '2026-04-15T07:00:00.000Z',
      endedAt: '2026-04-15T09:30:00.000Z',
      distanceMeters: 5000,
      elevationGainMeters: 200,
      durationSeconds: 9000,
    });

    const cards = getTodayCards(testDb.adapter, { now: FIXED_NOW });
    expect(cards).toEqual([]);
  });

  it('surfaces an in-progress recording as an action card', () => {
    createRecording(testDb.adapter, 'rec-active', {
      name: 'Morning Trail',
      activityType: 'hike',
      startedAt: '2026-04-18T13:00:00.000Z',
      distanceMeters: 1200,
      elevationGainMeters: 80,
      durationSeconds: 1800,
    });

    const cards = getTodayCards(testDb.adapter, { now: FIXED_NOW });
    const action = cards.find((c) => c.kind === 'action');
    expect(action).toBeDefined();
    expect(action!.priority).toBe(90);
    expect(action!.cta?.route).toBe('/trails/record');
    expect(action!.dismissible).toBe(false);
  });

  it('caps at 3 cards and ranks by priority desc with valid bounds', () => {
    createRecording(testDb.adapter, 'rec-active', {
      name: 'Live Hike',
      activityType: 'hike',
      startedAt: '2026-04-18T13:00:00.000Z',
      distanceMeters: 800,
      elevationGainMeters: 50,
      durationSeconds: 600,
    });
    createRecording(testDb.adapter, 'rec-done', {
      name: 'Earlier Hike',
      activityType: 'hike',
      startedAt: '2026-04-18T05:00:00.000Z',
      endedAt: '2026-04-18T08:00:00.000Z',
      distanceMeters: 4500,
      elevationGainMeters: 220,
      durationSeconds: 10800,
    });

    const cards = getTodayCards(testDb.adapter, { now: FIXED_NOW });
    expect(cards.length).toBeLessThanOrEqual(3);
    for (const card of cards) {
      expect(card.priority).toBeGreaterThanOrEqual(0);
      expect(card.priority).toBeLessThanOrEqual(100);
      expect(card.moduleId).toBe('trails');
    }
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].priority).toBeGreaterThanOrEqual(cards[i].priority);
    }
  });
});
