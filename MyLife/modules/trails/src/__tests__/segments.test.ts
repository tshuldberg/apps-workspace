import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createTrail,
  createRecording,
  createSegment,
  getSegmentsByTrail,
  createSegmentEffort,
  getEffortsBySegment,
  getPersonalBest,
  recalculatePersonalBest,
} from '../db/crud';
import { isWithinRadius, matchSegmentEntry, matchSegmentExit } from '../engine/segment-matcher';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});
afterEach(() => { testDb.close(); });

const trailInput = {
  name: 'Test Trail', difficulty: 'moderate' as const,
  distanceMeters: 5000, elevationGainMeters: 300, lat: 37.77, lng: -122.42,
};

const recordingInput = {
  name: 'Test Rec', activityType: 'hike' as const, startedAt: '2026-01-01T08:00:00Z',
  distanceMeters: 5000, elevationGainMeters: 300, durationSeconds: 3600, trailId: 't1',
};

describe('Segment CRUD', () => {
  it('creates a segment', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    const seg = createSegment(testDb.adapter, 's1', {
      trailId: 't1', name: 'Summit Push',
      startLat: 37.770, startLng: -122.420, endLat: 37.775, endLng: -122.415,
      distanceMeters: 700, elevationGainMeters: 150,
    });
    expect(seg.id).toBe('s1');
    expect(seg.name).toBe('Summit Push');
    expect(seg.distanceMeters).toBe(700);
  });

  it('lists segments by trail', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createSegment(testDb.adapter, 's1', { trailId: 't1', name: 'A', startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100, elevationGainMeters: 10 });
    createSegment(testDb.adapter, 's2', { trailId: 't1', name: 'B', startLat: 1, startLng: 1, endLat: 2, endLng: 2, distanceMeters: 200, elevationGainMeters: 20 });
    const segs = getSegmentsByTrail(testDb.adapter, 't1');
    expect(segs).toHaveLength(2);
  });

  it('cascades segment delete when trail is deleted', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createSegment(testDb.adapter, 's1', { trailId: 't1', name: 'A', startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100, elevationGainMeters: 10 });
    testDb.adapter.execute('DELETE FROM tr_trails WHERE id = ?', ['t1']);
    expect(getSegmentsByTrail(testDb.adapter, 't1')).toHaveLength(0);
  });
});

describe('Segment Effort CRUD', () => {
  it('creates an effort and marks first as personal best', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'r1', recordingInput);
    createSegment(testDb.adapter, 's1', { trailId: 't1', name: 'A', startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100, elevationGainMeters: 10 });
    const effort = createSegmentEffort(testDb.adapter, 'e1', {
      segmentId: 's1', recordingId: 'r1', durationSeconds: 300,
      startedAt: '2026-01-01T08:10:00Z', endedAt: '2026-01-01T08:15:00Z',
    });
    expect(effort.isPersonalBest).toBe(true);
  });

  it('marks faster effort as new PB', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'r1', recordingInput);
    createRecording(testDb.adapter, 'r2', { ...recordingInput, name: 'Rec 2' });
    createSegment(testDb.adapter, 's1', { trailId: 't1', name: 'A', startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100, elevationGainMeters: 10 });
    createSegmentEffort(testDb.adapter, 'e1', { segmentId: 's1', recordingId: 'r1', durationSeconds: 300, startedAt: 'a', endedAt: 'b' });
    const e2 = createSegmentEffort(testDb.adapter, 'e2', { segmentId: 's1', recordingId: 'r2', durationSeconds: 200, startedAt: 'c', endedAt: 'd' });
    expect(e2.isPersonalBest).toBe(true);

    // Old one should no longer be PB
    const efforts = getEffortsBySegment(testDb.adapter, 's1');
    const old = efforts.find(e => e.id === 'e1');
    expect(old!.isPersonalBest).toBe(false);
  });

  it('getPersonalBest returns fastest effort', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'r1', recordingInput);
    createRecording(testDb.adapter, 'r2', { ...recordingInput, name: 'R2' });
    createSegment(testDb.adapter, 's1', { trailId: 't1', name: 'A', startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100, elevationGainMeters: 10 });
    createSegmentEffort(testDb.adapter, 'e1', { segmentId: 's1', recordingId: 'r1', durationSeconds: 300, startedAt: 'a', endedAt: 'b' });
    createSegmentEffort(testDb.adapter, 'e2', { segmentId: 's1', recordingId: 'r2', durationSeconds: 200, startedAt: 'c', endedAt: 'd' });
    const pb = getPersonalBest(testDb.adapter, 's1');
    expect(pb).not.toBeNull();
    expect(pb!.id).toBe('e2');
  });

  it('recalculates PB after deletion', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'r1', recordingInput);
    createRecording(testDb.adapter, 'r2', { ...recordingInput, name: 'R2' });
    createSegment(testDb.adapter, 's1', { trailId: 't1', name: 'A', startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100, elevationGainMeters: 10 });
    createSegmentEffort(testDb.adapter, 'e1', { segmentId: 's1', recordingId: 'r1', durationSeconds: 300, startedAt: 'a', endedAt: 'b' });
    createSegmentEffort(testDb.adapter, 'e2', { segmentId: 's1', recordingId: 'r2', durationSeconds: 200, startedAt: 'c', endedAt: 'd' });

    // Delete the PB effort's recording
    testDb.adapter.execute('DELETE FROM tr_recordings WHERE id = ?', ['r2']);
    recalculatePersonalBest(testDb.adapter, 's1');

    const pb = getPersonalBest(testDb.adapter, 's1');
    expect(pb!.id).toBe('e1');
    expect(pb!.isPersonalBest).toBe(true);
  });
});

describe('Segment Matcher', () => {
  it('isWithinRadius detects point within 30m', () => {
    expect(isWithinRadius({ lat: 37.7700, lng: -122.4200 }, { lat: 37.7700, lng: -122.4200 }, 30)).toBe(true);
  });

  it('isWithinRadius rejects point outside 30m', () => {
    expect(isWithinRadius({ lat: 37.7700, lng: -122.4200 }, { lat: 37.7710, lng: -122.4200 }, 30)).toBe(false);
  });

  it('matchSegmentEntry finds segment at start', () => {
    const segments = [{ id: 's1', trailId: 't1', name: 'A', startLat: 37.77, startLng: -122.42, endLat: 37.78, endLng: -122.41, distanceMeters: 100, elevationGainMeters: 10, createdAt: '' }];
    const match = matchSegmentEntry({ lat: 37.77, lng: -122.42 }, segments);
    expect(match).not.toBeNull();
    expect(match!.id).toBe('s1');
  });

  it('matchSegmentExit detects end point', () => {
    const seg = { id: 's1', trailId: 't1', name: 'A', startLat: 37.77, startLng: -122.42, endLat: 37.78, endLng: -122.41, distanceMeters: 100, elevationGainMeters: 10, createdAt: '' };
    expect(matchSegmentExit({ lat: 37.78, lng: -122.41 }, seg)).toBe(true);
    expect(matchSegmentExit({ lat: 37.79, lng: -122.40 }, seg)).toBe(false);
  });
});
