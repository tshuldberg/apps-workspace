import type { PomodoroSettings } from '../models/schemas';
import type { ClassesSettings } from '../types';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break' | 'idle';

export interface PomodoroState {
  phase: PomodoroPhase;
  elapsedSeconds: number;
  totalPomodoros: number;
  settings: PomodoroSettings;
}

export interface PomodoroProgress {
  percent: number;
  remainingSeconds: number;
  phaseLabel: string;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
};

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  idle: 'Idle',
  work: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
};

/**
 * Map the user's high-level study settings into Pomodoro engine settings.
 * `defaultStudyMinutes` becomes the work block; `focusBreakMinutes` becomes
 * the short break. Long break and interval fall back to engine defaults.
 */
export function pomodoroSettingsFromUserSettings(
  settings: Pick<ClassesSettings, 'defaultStudyMinutes' | 'focusBreakMinutes'>,
): PomodoroSettings {
  const work = Math.max(
    1,
    Math.min(180, settings.defaultStudyMinutes ?? DEFAULT_POMODORO_SETTINGS.workMinutes),
  );
  const shortBreak = Math.max(
    0,
    Math.min(60, settings.focusBreakMinutes ?? DEFAULT_POMODORO_SETTINGS.shortBreakMinutes),
  );
  return {
    workMinutes: work,
    shortBreakMinutes: shortBreak,
    longBreakMinutes: DEFAULT_POMODORO_SETTINGS.longBreakMinutes,
    longBreakInterval: DEFAULT_POMODORO_SETTINGS.longBreakInterval,
  };
}

export function createInitialState(
  settings: PomodoroSettings = DEFAULT_POMODORO_SETTINGS,
): PomodoroState {
  return {
    phase: 'idle',
    elapsedSeconds: 0,
    totalPomodoros: 0,
    settings,
  };
}

function phaseDurationSeconds(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  switch (phase) {
    case 'work':
      return settings.workMinutes * 60;
    case 'short_break':
      return settings.shortBreakMinutes * 60;
    case 'long_break':
      return settings.longBreakMinutes * 60;
    case 'idle':
      return 0;
  }
}

/**
 * Begin or resume the timer. Idle -> work; pause is represented by leaving
 * the phase intact and not calling tick.
 */
export function start(state: PomodoroState): PomodoroState {
  if (state.phase !== 'idle') return state;
  return { ...state, phase: 'work', elapsedSeconds: 0 };
}

export function pause(state: PomodoroState): PomodoroState {
  // Pause is a no-op on state shape; the host stops calling tick. We expose
  // it as a function so callers have a typed seam for future enhancements
  // (e.g., recording paused-at timestamps).
  return state;
}

/**
 * Compute the next phase after `current` finishes, given the running pomodoro
 * count. Increments the running pomodoro count when leaving a work phase.
 */
function nextAfter(
  current: PomodoroPhase,
  totalPomodoros: number,
  settings: PomodoroSettings,
): { phase: PomodoroPhase; totalPomodoros: number } {
  if (current === 'work') {
    const newTotal = totalPomodoros + 1;
    const isLongBreak = newTotal % settings.longBreakInterval === 0;
    return {
      phase: isLongBreak ? 'long_break' : 'short_break',
      totalPomodoros: newTotal,
    };
  }
  if (current === 'short_break' || current === 'long_break') {
    return { phase: 'work', totalPomodoros };
  }
  return { phase: 'idle', totalPomodoros };
}

/**
 * Advance the timer by `deltaSeconds`. Auto-transitions through completed
 * phases, carrying remainder time into the next phase. Idempotent for idle.
 */
export function tick(state: PomodoroState, deltaSeconds: number): PomodoroState {
  if (state.phase === 'idle' || deltaSeconds <= 0) return state;

  let phase: PomodoroPhase = state.phase;
  let elapsed = state.elapsedSeconds + deltaSeconds;
  let total = state.totalPomodoros;
  let duration = phaseDurationSeconds(phase, state.settings);

  // Roll over completed phases. Guard with a max iteration to avoid infinite
  // loops if a settings edge case yields zero-length phases.
  let safety = 0;
  while (elapsed >= duration && phase !== 'idle' && safety < 100) {
    const overflow = elapsed - duration;
    const next = nextAfter(phase, total, state.settings);
    phase = next.phase;
    total = next.totalPomodoros;
    elapsed = overflow;
    duration = phaseDurationSeconds(phase, state.settings);
    safety += 1;
    if (duration === 0) {
      // Skip zero-length break phases without consuming time.
      const skip = nextAfter(phase, total, state.settings);
      phase = skip.phase;
      total = skip.totalPomodoros;
      duration = phaseDurationSeconds(phase, state.settings);
    }
  }

  return {
    ...state,
    phase,
    elapsedSeconds: elapsed,
    totalPomodoros: total,
  };
}

/**
 * Force-advance to the next phase, discarding remaining time.
 */
export function skip(state: PomodoroState): PomodoroState {
  if (state.phase === 'idle') return state;
  const next = nextAfter(state.phase, state.totalPomodoros, state.settings);
  return {
    ...state,
    phase: next.phase,
    totalPomodoros: next.totalPomodoros,
    elapsedSeconds: 0,
  };
}

export function reset(state: PomodoroState): PomodoroState {
  return createInitialState(state.settings);
}

export function getProgress(state: PomodoroState): PomodoroProgress {
  if (state.phase === 'idle') {
    return { percent: 0, remainingSeconds: 0, phaseLabel: PHASE_LABELS.idle };
  }
  const duration = phaseDurationSeconds(state.phase, state.settings);
  if (duration <= 0) {
    return {
      percent: 100,
      remainingSeconds: 0,
      phaseLabel: PHASE_LABELS[state.phase],
    };
  }
  const clampedElapsed = Math.min(state.elapsedSeconds, duration);
  const remaining = duration - clampedElapsed;
  const percent = (clampedElapsed / duration) * 100;
  return {
    percent,
    remainingSeconds: remaining,
    phaseLabel: PHASE_LABELS[state.phase],
  };
}
