import type { MuscleGroup } from '../types';
import { MUSCLE_GROUPS } from '../types';
import type {
  RecoveryMap,
  TrainingSuggestion,
  SessionMuscleData,
  MuscleVolumeEntry,
} from './types';
import {
  BASE_RECOVERY_HOURS,
  HIGH_VOLUME_THRESHOLD,
  LOW_VOLUME_THRESHOLD,
  HIGH_VOLUME_RECOVERY_HOURS,
  LOW_VOLUME_RECOVERY_HOURS,
  MAX_RECOVERY_HOURS,
  HIGH_INTENSITY_THRESHOLD,
  LOW_INTENSITY_THRESHOLD,
  INTENSITY_MODIFIER_HOURS,
  SECONDARY_RECOVERY_FACTOR,
  FRESH_THRESHOLD,
  RECOVERING_THRESHOLD,
} from './types';

// ── Pure Recovery Engine ──

function getRecoveryStatus(score: number): 'fresh' | 'recovering' | 'fatigued' {
  if (score >= FRESH_THRESHOLD) return 'fresh';
  if (score >= RECOVERING_THRESHOLD) return 'recovering';
  return 'fatigued';
}

function getBaseRecoveryHours(totalSets: number): number {
  if (totalSets > HIGH_VOLUME_THRESHOLD) return HIGH_VOLUME_RECOVERY_HOURS;
  if (totalSets < LOW_VOLUME_THRESHOLD) return LOW_VOLUME_RECOVERY_HOURS;
  return BASE_RECOVERY_HOURS;
}

function applyIntensityModifier(
  baseHours: number,
  avgIntensityPct: number | null,
): number {
  if (avgIntensityPct == null) return baseHours;
  if (avgIntensityPct > HIGH_INTENSITY_THRESHOLD) return baseHours + INTENSITY_MODIFIER_HOURS;
  if (avgIntensityPct < LOW_INTENSITY_THRESHOLD) return baseHours - INTENSITY_MODIFIER_HOURS;
  return baseHours;
}

function applyPrimarySecondaryFactor(hours: number, isPrimary: boolean): number {
  if (isPrimary) return hours;
  return hours * SECONDARY_RECOVERY_FACTOR;
}

/**
 * Calculate recovery score for a single muscle group.
 * Pure function: no side effects, no DB dependency.
 */
export function calculateMuscleRecovery(
  hoursSinceLastTrained: number,
  totalSets: number,
  isPrimary: boolean,
  avgIntensityPct: number | null,
): number {
  let recoveryHours = getBaseRecoveryHours(totalSets);
  recoveryHours = applyIntensityModifier(recoveryHours, avgIntensityPct);
  recoveryHours = applyPrimarySecondaryFactor(recoveryHours, isPrimary);
  recoveryHours = Math.min(recoveryHours, MAX_RECOVERY_HOURS);
  recoveryHours = Math.max(recoveryHours, 1);

  const score = Math.min(100, (hoursSinceLastTrained / recoveryHours) * 100);
  return Math.max(0, Math.round(score));
}

/**
 * Find the most recent session that trained each muscle group.
 * Returns the latest session data per muscle group (recovery resets on re-training).
 */
function getLatestMuscleData(
  sessions: SessionMuscleData[],
): Map<MuscleGroup, { volume: MuscleVolumeEntry; completedAt: string; allSessions: SessionMuscleData[] }> {
  const result = new Map<MuscleGroup, { volume: MuscleVolumeEntry; completedAt: string; allSessions: SessionMuscleData[] }>();

  // Sort sessions newest first
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sorted) {
    for (const vol of session.muscleVolume) {
      if (!result.has(vol.muscleGroup)) {
        // Count all sessions that trained this muscle
        const allForMuscle = sorted.filter((s) =>
          s.muscleVolume.some((v) => v.muscleGroup === vol.muscleGroup),
        );
        result.set(vol.muscleGroup, {
          volume: vol,
          completedAt: session.completedAt,
          allSessions: allForMuscle,
        });
      }
    }
  }

  return result;
}

/**
 * Build a recovery map for all 14 muscle groups.
 * Pure function: takes session data and current time, returns recovery status.
 */
export function buildRecoveryMap(
  sessions: SessionMuscleData[],
  now: Date = new Date(),
): RecoveryMap {
  const map: RecoveryMap = new Map();
  const latestData = getLatestMuscleData(sessions);
  const nowMs = now.getTime();
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;

  for (const group of MUSCLE_GROUPS) {
    // Skip full_body as it's a composite
    if (group === 'full_body') continue;

    const data = latestData.get(group);

    if (!data) {
      // Never trained: fully fresh
      map.set(group, {
        muscleGroup: group,
        score: 100,
        status: 'fresh',
        hoursSinceLastTrained: null,
        hoursUntilRecovered: 0,
        lastTrainedAt: null,
        volumeLastSession: 0,
        frequencyLast7Days: 0,
      });
      continue;
    }

    const lastTrainedMs = new Date(data.completedAt).getTime();
    const hoursSince = Math.max(0, (nowMs - lastTrainedMs) / (1000 * 60 * 60));

    const score = calculateMuscleRecovery(
      hoursSince,
      data.volume.totalSets,
      data.volume.isPrimary,
      data.volume.avgIntensityPct,
    );

    // Calculate hours until recovered
    let recoveryHours = getBaseRecoveryHours(data.volume.totalSets);
    recoveryHours = applyIntensityModifier(recoveryHours, data.volume.avgIntensityPct);
    recoveryHours = applyPrimarySecondaryFactor(recoveryHours, data.volume.isPrimary);
    recoveryHours = Math.min(recoveryHours, MAX_RECOVERY_HOURS);
    const hoursUntil = Math.max(0, recoveryHours - hoursSince);

    // Count sessions in last 7 days
    const freq = data.allSessions.filter(
      (s) => new Date(s.completedAt).getTime() >= sevenDaysAgo,
    ).length;

    map.set(group, {
      muscleGroup: group,
      score,
      status: getRecoveryStatus(score),
      hoursSinceLastTrained: Math.round(hoursSince),
      hoursUntilRecovered: Math.round(hoursUntil),
      lastTrainedAt: data.completedAt,
      volumeLastSession: data.volume.totalSets,
      frequencyLast7Days: freq,
    });
  }

  return map;
}

/** Push muscles: chest, shoulders, triceps */
const PUSH_MUSCLES: MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
/** Pull muscles: back, biceps, forearms */
const PULL_MUSCLES: MuscleGroup[] = ['back', 'biceps', 'forearms'];
/** Leg muscles: quads, hamstrings, glutes, calves, hip_flexors */
const LEG_MUSCLES: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors'];

function groupIsFresh(map: RecoveryMap, muscles: MuscleGroup[]): boolean {
  return muscles.every((m) => {
    const score = map.get(m);
    return !score || score.score >= 80;
  });
}

/**
 * Suggest what to train today based on recovery status.
 * Pure function.
 */
export function getBestToTrain(map: RecoveryMap): TrainingSuggestion {
  const freshMuscles: MuscleGroup[] = [];
  const fatiguedMuscles: MuscleGroup[] = [];

  for (const [group, data] of map) {
    if (data.score >= 80) freshMuscles.push(group);
    if (data.status === 'fatigued') fatiguedMuscles.push(group);
  }

  const pushFresh = groupIsFresh(map, PUSH_MUSCLES);
  const pullFresh = groupIsFresh(map, PULL_MUSCLES);
  const legsFresh = groupIsFresh(map, LEG_MUSCLES);

  if (pushFresh && pullFresh && legsFresh) {
    return { type: 'full_body', label: 'Full body is an option', freshMuscles, fatiguedMuscles };
  }
  if (legsFresh) {
    return { type: 'legs', label: 'Leg day looks good', freshMuscles, fatiguedMuscles };
  }
  if (pullFresh) {
    return { type: 'pull', label: 'Pull day looks good', freshMuscles, fatiguedMuscles };
  }
  if (pushFresh) {
    return { type: 'push', label: 'Push day looks good', freshMuscles, fatiguedMuscles };
  }

  return { type: 'rest', label: 'Consider a rest day', freshMuscles, fatiguedMuscles };
}
