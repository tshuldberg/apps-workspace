import type { MuscleGroup } from '../types';

/** Recovery score for a single muscle group (0 = fatigued, 100 = fresh). */
export interface RecoveryScore {
  muscleGroup: MuscleGroup;
  score: number;
  status: 'fresh' | 'recovering' | 'fatigued';
  hoursSinceLastTrained: number | null;
  hoursUntilRecovered: number;
  lastTrainedAt: string | null;
  volumeLastSession: number;
  frequencyLast7Days: number;
}

/** Map of all muscle groups to their recovery status. */
export type RecoveryMap = Map<MuscleGroup, RecoveryScore>;

/** Training suggestion based on recovery status. */
export interface TrainingSuggestion {
  type: 'push' | 'pull' | 'legs' | 'full_body' | 'rest';
  label: string;
  freshMuscles: MuscleGroup[];
  fatiguedMuscles: MuscleGroup[];
}

/** Input for recovery calculation: a session with its muscle group volume. */
export interface SessionMuscleData {
  sessionId: string;
  completedAt: string;
  muscleVolume: MuscleVolumeEntry[];
}

/** Volume for a single muscle group from a session. */
export interface MuscleVolumeEntry {
  muscleGroup: MuscleGroup;
  totalSets: number;
  totalReps: number;
  isPrimary: boolean;
  avgIntensityPct: number | null;
}

// ── Constants ──

export const BASE_RECOVERY_HOURS = 48;
export const HIGH_VOLUME_THRESHOLD = 15;
export const LOW_VOLUME_THRESHOLD = 6;
export const HIGH_VOLUME_RECOVERY_HOURS = 72;
export const LOW_VOLUME_RECOVERY_HOURS = 36;
export const MAX_RECOVERY_HOURS = 96;
export const HIGH_INTENSITY_THRESHOLD = 0.85;
export const LOW_INTENSITY_THRESHOLD = 0.65;
export const INTENSITY_MODIFIER_HOURS = 12;
export const SECONDARY_RECOVERY_FACTOR = 0.7;
export const FRESH_THRESHOLD = 67;
export const RECOVERING_THRESHOLD = 34;
