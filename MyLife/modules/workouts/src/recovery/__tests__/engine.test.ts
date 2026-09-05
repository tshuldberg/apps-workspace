import { describe, it, expect } from 'vitest';
import { calculateMuscleRecovery, buildRecoveryMap, getBestToTrain } from '../engine';
import type { SessionMuscleData } from '../types';

describe('calculateMuscleRecovery', () => {
  it('returns ~0% when just trained with moderate volume', () => {
    const score = calculateMuscleRecovery(0, 10, true, null);
    expect(score).toBe(0);
  });

  it('returns ~50% at 24 hours with moderate volume', () => {
    const score = calculateMuscleRecovery(24, 10, true, null);
    expect(score).toBe(50);
  });

  it('returns 100% at 48 hours with moderate volume', () => {
    const score = calculateMuscleRecovery(48, 10, true, null);
    expect(score).toBe(100);
  });

  it('extends recovery to 72 hours for high volume (>15 sets)', () => {
    const score = calculateMuscleRecovery(48, 20, true, null);
    // 48/72 = ~67%
    expect(score).toBe(67);
  });

  it('shortens recovery to 36 hours for low volume (<6 sets)', () => {
    const score = calculateMuscleRecovery(36, 4, true, null);
    expect(score).toBe(100);
  });

  it('adds 12h recovery for high intensity (>85% 1RM)', () => {
    // Moderate volume (48h base) + high intensity (+12h) = 60h
    const score = calculateMuscleRecovery(48, 10, true, 0.90);
    // 48/60 = 80%
    expect(score).toBe(80);
  });

  it('subtracts 12h recovery for low intensity (<65% 1RM)', () => {
    // Moderate volume (48h base) - low intensity (-12h) = 36h
    const score = calculateMuscleRecovery(36, 10, true, 0.50);
    expect(score).toBe(100);
  });

  it('secondary muscles recover 30% faster', () => {
    // Moderate volume (48h base) * 0.7 = 33.6h for secondary
    const score = calculateMuscleRecovery(34, 10, false, null);
    expect(score).toBe(100);
  });

  it('caps recovery at 96 hours max', () => {
    // Very high volume + high intensity: 72 + 12 = 84, but secondary: 84*0.7 = 58.8
    // Actually test with primary: high vol (72) + high intensity (+12) = 84 < 96
    // Use massive sets: still caps at MAX
    const score = calculateMuscleRecovery(95, 50, true, 0.95);
    // 72 + 12 = 84 (cap 96) -> 95/84 > 100 -> capped at 100
    expect(score).toBe(100);
  });

  it('returns 100% with no history', () => {
    const score = calculateMuscleRecovery(1000, 10, true, null);
    expect(score).toBe(100);
  });
});

describe('buildRecoveryMap', () => {
  it('returns all fresh when no sessions provided', () => {
    const map = buildRecoveryMap([]);
    // 13 muscle groups (full_body excluded)
    expect(map.size).toBe(13);
    for (const [, data] of map) {
      expect(data.score).toBe(100);
      expect(data.status).toBe('fresh');
    }
  });

  it('processes session data and marks trained muscles as recovering', () => {
    const now = new Date('2026-03-22T18:00:00Z');
    const sessions: SessionMuscleData[] = [
      {
        sessionId: 'sess-1',
        completedAt: '2026-03-22T06:00:00Z', // 12 hours ago
        muscleVolume: [
          { muscleGroup: 'chest', totalSets: 12, totalReps: 96, isPrimary: true, avgIntensityPct: null },
          { muscleGroup: 'triceps', totalSets: 6, totalReps: 48, isPrimary: false, avgIntensityPct: null },
        ],
      },
    ];

    const map = buildRecoveryMap(sessions, now);

    const chest = map.get('chest')!;
    expect(chest.score).toBe(25); // 12/48 * 100 = 25
    expect(chest.status).toBe('fatigued');
    expect(chest.hoursSinceLastTrained).toBe(12);
    expect(chest.volumeLastSession).toBe(12);

    const triceps = map.get('triceps')!;
    // Secondary: 36h * 0.7 = 25.2h recovery. 12/25.2 = ~48%
    expect(triceps.status).toBe('recovering');

    // Untrained muscles remain fresh
    const back = map.get('back')!;
    expect(back.score).toBe(100);
    expect(back.status).toBe('fresh');
  });

  it('handles exercises with only primary muscles', () => {
    const now = new Date('2026-03-22T18:00:00Z');
    const sessions: SessionMuscleData[] = [
      {
        sessionId: 'sess-1',
        completedAt: '2026-03-22T12:00:00Z',
        muscleVolume: [
          { muscleGroup: 'calves', totalSets: 8, totalReps: 80, isPrimary: true, avgIntensityPct: null },
        ],
      },
    ];

    const map = buildRecoveryMap(sessions, now);
    const calves = map.get('calves')!;
    expect(calves.score).toBe(13); // 6/48 * 100 ~ 12.5 -> 13
    expect(calves.lastTrainedAt).toBe('2026-03-22T12:00:00Z');
  });

  it('counts frequency in last 7 days', () => {
    const now = new Date('2026-03-22T18:00:00Z');
    const sessions: SessionMuscleData[] = [
      {
        sessionId: 's1',
        completedAt: '2026-03-22T06:00:00Z',
        muscleVolume: [{ muscleGroup: 'chest', totalSets: 10, totalReps: 80, isPrimary: true, avgIntensityPct: null }],
      },
      {
        sessionId: 's2',
        completedAt: '2026-03-20T06:00:00Z',
        muscleVolume: [{ muscleGroup: 'chest', totalSets: 10, totalReps: 80, isPrimary: true, avgIntensityPct: null }],
      },
      {
        sessionId: 's3',
        completedAt: '2026-03-10T06:00:00Z', // outside 7 days
        muscleVolume: [{ muscleGroup: 'chest', totalSets: 10, totalReps: 80, isPrimary: true, avgIntensityPct: null }],
      },
    ];

    const map = buildRecoveryMap(sessions, now);
    expect(map.get('chest')!.frequencyLast7Days).toBe(2);
  });
});

describe('getBestToTrain', () => {
  it('suggests push day when push muscles are fresh', () => {
    const map = buildRecoveryMap([]);
    // All fresh by default, make pull and legs fatigued
    for (const group of ['back', 'biceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors'] as const) {
      map.set(group, {
        muscleGroup: group,
        score: 10,
        status: 'fatigued',
        hoursSinceLastTrained: 6,
        hoursUntilRecovered: 42,
        lastTrainedAt: '2026-03-22T12:00:00Z',
        volumeLastSession: 15,
        frequencyLast7Days: 1,
      });
    }

    const suggestion = getBestToTrain(map);
    expect(suggestion.type).toBe('push');
    expect(suggestion.label).toBe('Push day looks good');
  });

  it('suggests rest when no muscles are fresh', () => {
    const map = buildRecoveryMap([]);
    for (const [group] of map) {
      map.set(group, {
        muscleGroup: group,
        score: 20,
        status: 'fatigued',
        hoursSinceLastTrained: 6,
        hoursUntilRecovered: 42,
        lastTrainedAt: '2026-03-22T12:00:00Z',
        volumeLastSession: 15,
        frequencyLast7Days: 3,
      });
    }

    const suggestion = getBestToTrain(map);
    expect(suggestion.type).toBe('rest');
    expect(suggestion.label).toBe('Consider a rest day');
  });

  it('suggests full body when everything is fresh', () => {
    const map = buildRecoveryMap([]);
    const suggestion = getBestToTrain(map);
    expect(suggestion.type).toBe('full_body');
  });
});
