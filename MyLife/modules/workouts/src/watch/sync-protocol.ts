/**
 * Watch sync protocol types.
 *
 * These TypeScript types define the JSON message format used between
 * the phone (React Native) and Apple Watch (SwiftUI) via WatchConnectivity.
 * The Swift side must mirror these types for serialization compatibility.
 */

import type { WeightUnit, WorkoutDifficulty, WorkoutExerciseEntry } from '../types';

// ── Phone -> Watch Messages ──

export interface WatchWorkoutSync {
  type: 'workout_list';
  workouts: WatchWorkoutSummary[];
}

export interface WatchWorkoutSummary {
  id: string;
  title: string;
  difficulty: WorkoutDifficulty;
  exercises: WatchExerciseEntry[];
  estimatedDurationSeconds: number;
}

export interface WatchExerciseEntry {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number | null;
  duration: number | null;
  restAfter: number;
  /** Previous performance for this exercise (last session). */
  previousWeight: number | null;
  previousReps: number | null;
  previousUnit: WeightUnit | null;
}

export interface WatchSettingsSync {
  type: 'settings';
  weightUnit: WeightUnit;
  defaultRestSeconds: number;
  weightIncrement: number;
}

export type PhoneToWatchMessage = WatchWorkoutSync | WatchSettingsSync;

// ── Watch -> Phone Messages ──

export interface WatchSetCompleted {
  type: 'set_completed';
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
  timestamp: string;
}

export interface WatchSessionStarted {
  type: 'session_started';
  sessionId: string;
  workoutId: string;
  startedAt: string;
}

export interface WatchSessionCompleted {
  type: 'session_completed';
  sessionId: string;
  completedAt: string;
  totalDurationSeconds: number;
  setsCompleted: number;
}

export interface WatchGpsPoints {
  type: 'gps_points';
  routeId: string;
  points: WatchGpsPoint[];
}

export interface WatchGpsPoint {
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  speedMps: number | null;
  timestampMs: number;
  segment: number;
}

export type WatchToPhoneMessage =
  | WatchSetCompleted
  | WatchSessionStarted
  | WatchSessionCompleted
  | WatchGpsPoints;

// ── Helper Functions ──

/**
 * Build a WatchWorkoutSummary from a workout definition and optional previous performance data.
 */
export function buildWatchWorkoutSummary(
  id: string,
  title: string,
  difficulty: WorkoutDifficulty,
  exercises: WorkoutExerciseEntry[],
  estimatedDuration: number,
  previousPerformance?: Map<string, { weight: number; reps: number; unit: WeightUnit }>,
): WatchWorkoutSummary {
  return {
    id,
    title,
    difficulty,
    estimatedDurationSeconds: estimatedDuration,
    exercises: exercises.map((ex) => {
      const prev = previousPerformance?.get(ex.exerciseId);
      return {
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        duration: ex.duration,
        restAfter: ex.restAfter,
        previousWeight: prev?.weight ?? null,
        previousReps: prev?.reps ?? null,
        previousUnit: prev?.unit ?? null,
      };
    }),
  };
}

/**
 * Validate an incoming WatchToPhoneMessage has required fields.
 */
export function isValidWatchMessage(msg: unknown): msg is WatchToPhoneMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== 'string') return false;
  return ['set_completed', 'session_started', 'session_completed', 'gps_points'].includes(m.type);
}
