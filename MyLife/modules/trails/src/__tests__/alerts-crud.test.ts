import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createTrail,
  createRecording,
  getAlertSettings,
  createAlertSettings,
  updateAlertSettings,
  createDeviationEvent,
  getDeviationEvents,
  getDeviationsByRecording,
  acknowledgeDeviation,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Alert Settings ────────────────────────────────────────────────────

describe('Alert Settings CRUD', () => {
  it('creates default alert settings', () => {
    const settings = createAlertSettings(testDb.adapter, 'as1');
    expect(settings.id).toBe('as1');
    expect(settings.deviationThresholdMeters).toBe(30);
    expect(settings.alertCooldownSeconds).toBe(60);
    expect(settings.vibrationEnabled).toBe(true);
    expect(settings.soundEnabled).toBe(false);
    expect(settings.autoPauseOnDeviation).toBe(false);
  });

  it('getAlertSettings returns existing or creates defaults', () => {
    // First call should create default settings
    const settings = getAlertSettings(testDb.adapter);
    expect(settings.deviationThresholdMeters).toBe(30);

    // Second call should return the same
    const again = getAlertSettings(testDb.adapter);
    expect(again.id).toBe(settings.id);
  });

  it('updates threshold', () => {
    getAlertSettings(testDb.adapter); // ensure exists
    const updated = updateAlertSettings(testDb.adapter, {
      deviationThresholdMeters: 50,
    });
    expect(updated.deviationThresholdMeters).toBe(50);
    expect(updated.alertCooldownSeconds).toBe(60); // unchanged
  });

  it('updates multiple fields at once', () => {
    getAlertSettings(testDb.adapter);
    const updated = updateAlertSettings(testDb.adapter, {
      deviationThresholdMeters: 15,
      alertCooldownSeconds: 30,
      vibrationEnabled: false,
      soundEnabled: true,
      autoPauseOnDeviation: true,
    });
    expect(updated.deviationThresholdMeters).toBe(15);
    expect(updated.alertCooldownSeconds).toBe(30);
    expect(updated.vibrationEnabled).toBe(false);
    expect(updated.soundEnabled).toBe(true);
    expect(updated.autoPauseOnDeviation).toBe(true);
  });

  it('returns unchanged settings when no updates provided', () => {
    getAlertSettings(testDb.adapter);
    const updated = updateAlertSettings(testDb.adapter, {});
    expect(updated.deviationThresholdMeters).toBe(30);
  });
});

// ── Deviation Events ──────────────────────────────────────────────────

describe('Deviation Events CRUD', () => {
  const trailInput = {
    name: 'Test Trail',
    difficulty: 'easy' as const,
    distanceMeters: 1000,
    elevationGainMeters: 50,
    lat: 37.77,
    lng: -122.42,
  };

  const recordingInput = {
    name: 'Test Recording',
    activityType: 'hike' as const,
    startedAt: new Date().toISOString(),
    distanceMeters: 1000,
    elevationGainMeters: 50,
    durationSeconds: 3600,
    trailId: 't1',
  };

  it('creates a deviation event', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'rec1', recordingInput);

    const event = createDeviationEvent(testDb.adapter, 'dev1', {
      recordingId: 'rec1',
      trailId: 't1',
      lat: 37.771,
      lng: -122.421,
      deviationMeters: 47.5,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    expect(event.id).toBe('dev1');
    expect(event.recordingId).toBe('rec1');
    expect(event.trailId).toBe('t1');
    expect(event.deviationMeters).toBe(47.5);
    expect(event.acknowledged).toBe(false);
  });

  it('creates deviation event without trail id', () => {
    createRecording(testDb.adapter, 'rec1', { ...recordingInput, trailId: undefined });

    const event = createDeviationEvent(testDb.adapter, 'dev1', {
      recordingId: 'rec1',
      lat: 37.771,
      lng: -122.421,
      deviationMeters: 30,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    expect(event.trailId).toBeNull();
  });

  it('lists deviation events by recording in order', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'rec1', recordingInput);

    createDeviationEvent(testDb.adapter, 'dev1', {
      recordingId: 'rec1',
      trailId: 't1',
      lat: 37.771,
      lng: -122.421,
      deviationMeters: 35,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    createDeviationEvent(testDb.adapter, 'dev2', {
      recordingId: 'rec1',
      trailId: 't1',
      lat: 37.772,
      lng: -122.422,
      deviationMeters: 85,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    const events = getDeviationsByRecording(testDb.adapter, 'rec1');
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe('dev1');
    expect(events[1].id).toBe('dev2');
  });

  it('lists recent deviations across recordings', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'rec1', recordingInput);

    createDeviationEvent(testDb.adapter, 'dev1', {
      recordingId: 'rec1',
      trailId: 't1',
      lat: 37.771,
      lng: -122.421,
      deviationMeters: 35,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    const events = getDeviationEvents(testDb.adapter);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('dev1');
  });

  it('returns empty array for recording with no deviations', () => {
    createRecording(testDb.adapter, 'rec1', { ...recordingInput, trailId: undefined });
    const events = getDeviationsByRecording(testDb.adapter, 'rec1');
    expect(events).toHaveLength(0);
  });

  it('acknowledges a deviation event', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'rec1', recordingInput);
    createDeviationEvent(testDb.adapter, 'dev1', {
      recordingId: 'rec1',
      trailId: 't1',
      lat: 37.771,
      lng: -122.421,
      deviationMeters: 40,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    acknowledgeDeviation(testDb.adapter, 'dev1');

    const events = getDeviationsByRecording(testDb.adapter, 'rec1');
    expect(events[0].acknowledged).toBe(true);
  });

  it('cascades delete when recording is deleted', () => {
    createTrail(testDb.adapter, 't1', trailInput);
    createRecording(testDb.adapter, 'rec1', recordingInput);
    createDeviationEvent(testDb.adapter, 'dev1', {
      recordingId: 'rec1',
      trailId: 't1',
      lat: 37.771,
      lng: -122.421,
      deviationMeters: 40,
      nearestTrailLat: 37.770,
      nearestTrailLng: -122.420,
    });

    // Delete the recording
    testDb.adapter.execute(`DELETE FROM tr_recordings WHERE id = 'rec1'`);

    const events = getDeviationsByRecording(testDb.adapter, 'rec1');
    expect(events).toHaveLength(0);
  });
});
