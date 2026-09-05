import { z } from 'zod';

export const CLASSES_TIME_TRACKER_KEY = 'classes:assignment-time-tracker';

export interface TimeTrackerStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<unknown> | unknown;
}

export const AssignmentTimerStateSchema = z.object({
  assignment_id: z.string(),
  started_at_ms: z.number().int().nonnegative().nullable(),
  accumulated_ms: z.number().int().nonnegative(),
  is_running: z.boolean(),
  updated_at_ms: z.number().int().nonnegative(),
});

export type AssignmentTimerState = z.infer<typeof AssignmentTimerStateSchema>;

export interface AssignmentTimerSnapshot extends AssignmentTimerState {
  elapsed_ms: number;
  elapsed_minutes: number;
}

export interface StartTimerResult {
  active: AssignmentTimerSnapshot;
  replaced: AssignmentTimerSnapshot | null;
}

export interface StopTimerResult extends AssignmentTimerSnapshot {}

export function createMemoryTimeTrackerStorage(
  seed?: Record<string, string>,
): TimeTrackerStorage {
  const values = new Map(Object.entries(seed ?? {}));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function roundElapsedMinutes(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.max(1, Math.round(elapsedMs / 60000));
}

export function getTimerElapsedMs(
  state: Pick<AssignmentTimerState, 'accumulated_ms' | 'is_running' | 'started_at_ms'>,
  now: number = Date.now(),
): number {
  if (!state.is_running || state.started_at_ms === null) {
    return state.accumulated_ms;
  }
  return state.accumulated_ms + Math.max(0, now - state.started_at_ms);
}

export function toTimerSnapshot(
  state: AssignmentTimerState,
  now: number = Date.now(),
): AssignmentTimerSnapshot {
  const elapsed_ms = getTimerElapsedMs(state, now);
  return {
    ...state,
    elapsed_ms,
    elapsed_minutes: roundElapsedMinutes(elapsed_ms),
  };
}

async function readTimerState(
  storage: TimeTrackerStorage,
  key: string,
): Promise<AssignmentTimerState | null> {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = AssignmentTimerStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeTimerState(
  storage: TimeTrackerStorage,
  key: string,
  state: AssignmentTimerState,
): Promise<void> {
  await storage.setItem(key, JSON.stringify(state));
}

export async function getActiveTimer(
  storage: TimeTrackerStorage,
  now: number = Date.now(),
  key: string = CLASSES_TIME_TRACKER_KEY,
): Promise<AssignmentTimerSnapshot | null> {
  const state = await readTimerState(storage, key);
  return state ? toTimerSnapshot(state, now) : null;
}

export async function startTimer(
  storage: TimeTrackerStorage,
  assignmentId: string,
  now: number = Date.now(),
  key: string = CLASSES_TIME_TRACKER_KEY,
): Promise<StartTimerResult> {
  const previous = await readTimerState(storage, key);
  const replaced =
    previous && previous.assignment_id !== assignmentId
      ? toTimerSnapshot(previous, now)
      : null;

  const next: AssignmentTimerState =
    previous && previous.assignment_id === assignmentId
      ? previous.is_running
        ? {
            ...previous,
            updated_at_ms: now,
          }
        : {
            ...previous,
            started_at_ms: now,
            is_running: true,
            updated_at_ms: now,
          }
      : {
          assignment_id: assignmentId,
          started_at_ms: now,
          accumulated_ms: 0,
          is_running: true,
          updated_at_ms: now,
        };

  await writeTimerState(storage, key, next);
  return {
    active: toTimerSnapshot(next, now),
    replaced,
  };
}

export async function pauseTimer(
  storage: TimeTrackerStorage,
  now: number = Date.now(),
  key: string = CLASSES_TIME_TRACKER_KEY,
): Promise<AssignmentTimerSnapshot | null> {
  const previous = await readTimerState(storage, key);
  if (!previous) return null;

  const next: AssignmentTimerState = previous.is_running
    ? {
        ...previous,
        accumulated_ms: getTimerElapsedMs(previous, now),
        started_at_ms: null,
        is_running: false,
        updated_at_ms: now,
      }
    : {
        ...previous,
        updated_at_ms: now,
      };

  await writeTimerState(storage, key, next);
  return toTimerSnapshot(next, now);
}

export async function stopTimer(
  storage: TimeTrackerStorage,
  now: number = Date.now(),
  key: string = CLASSES_TIME_TRACKER_KEY,
): Promise<StopTimerResult | null> {
  const previous = await readTimerState(storage, key);
  if (!previous) return null;
  const snapshot = toTimerSnapshot(previous, now);
  await storage.removeItem(key);
  return snapshot;
}
