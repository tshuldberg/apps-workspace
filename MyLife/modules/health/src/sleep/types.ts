export type SleepSource = 'manual' | 'apple_health' | 'health_connect' | 'imported';

export interface SleepSession {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  quality_score: number | null;
  source: SleepSource;
  notes: string | null;
  created_at: string;
}

export interface LogSleepInput {
  start_time: string;
  end_time: string;
  deep_minutes?: number;
  rem_minutes?: number;
  light_minutes?: number;
  awake_minutes?: number;
  source?: SleepSource;
  notes?: string;
}

/** Default target sleep duration in hours */
export const DEFAULT_SLEEP_TARGET_HOURS = 8;
