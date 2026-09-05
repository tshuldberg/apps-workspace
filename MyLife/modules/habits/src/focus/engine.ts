/**
 * Pomodoro focus timer state machine and analytics.
 * Pure functions: no side effects, no timers.
 */

import type { PomodoroState, PomodoroConfig, FocusStats, FocusSession } from '../types';

const DEFAULT_CONFIG: PomodoroConfig = {
  workDuration: 25 * 60 * 1000, // 25 minutes in ms
  breakDuration: 5 * 60 * 1000, // 5 minutes
  longBreakDuration: 15 * 60 * 1000, // 15 minutes
  rounds: 4,
};

/** Create a new Pomodoro state from config. */
export function createPomodoroState(config: Partial<PomodoroConfig> = {}, startTime: number): PomodoroState {
  const c = { ...DEFAULT_CONFIG, ...config };
  return {
    phase: 'work',
    round: 1,
    roundsTarget: c.rounds,
    phaseStartTime: startTime,
    phaseDuration: c.workDuration,
    isPaused: false,
    pausedAt: null,
    totalFocusMs: 0,
    totalBreakMs: 0,
  };
}

/** Get the remaining time in the current phase. */
export function getRemainingMs(state: PomodoroState, now: number): number {
  if (state.phase === 'completed') return 0;
  if (state.isPaused && state.pausedAt !== null) {
    const elapsed = state.pausedAt - state.phaseStartTime;
    return Math.max(0, state.phaseDuration - elapsed);
  }
  const elapsed = now - state.phaseStartTime;
  return Math.max(0, state.phaseDuration - elapsed);
}

/** Check if the current phase has completed. */
export function isPhaseComplete(state: PomodoroState, now: number): boolean {
  return getRemainingMs(state, now) <= 0 && state.phase !== 'completed';
}

/** Advance to the next phase. Returns the new state. */
export function advancePhase(state: PomodoroState, config: PomodoroConfig, now: number): PomodoroState {
  if (state.phase === 'completed') return state;

  const elapsed = state.isPaused && state.pausedAt !== null
    ? state.pausedAt - state.phaseStartTime
    : now - state.phaseStartTime;

  let newState = { ...state };

  // Accumulate time from current phase
  if (state.phase === 'work') {
    newState.totalFocusMs += Math.min(elapsed, state.phaseDuration);
  } else {
    newState.totalBreakMs += Math.min(elapsed, state.phaseDuration);
  }

  // Determine next phase
  if (state.phase === 'work') {
    if (state.round >= state.roundsTarget) {
      // All rounds done
      newState.phase = 'completed';
      newState.isPaused = false;
      newState.pausedAt = null;
    } else if (state.round % 4 === 0) {
      // Long break every 4 rounds
      newState.phase = 'long_break';
      newState.phaseDuration = config.longBreakDuration;
      newState.phaseStartTime = now;
      newState.isPaused = false;
      newState.pausedAt = null;
    } else {
      newState.phase = 'break';
      newState.phaseDuration = config.breakDuration;
      newState.phaseStartTime = now;
      newState.isPaused = false;
      newState.pausedAt = null;
    }
  } else {
    // break or long_break -> next work round
    newState.phase = 'work';
    newState.round = state.round + 1;
    newState.phaseDuration = config.workDuration;
    newState.phaseStartTime = now;
    newState.isPaused = false;
    newState.pausedAt = null;
  }

  return newState;
}

/** Pause the timer. */
export function pauseTimer(state: PomodoroState, now: number): PomodoroState {
  if (state.isPaused || state.phase === 'completed') return state;
  return { ...state, isPaused: true, pausedAt: now };
}

/** Resume the timer. */
export function resumeTimer(state: PomodoroState, now: number): PomodoroState {
  if (!state.isPaused || state.pausedAt === null) return state;
  const pauseDuration = now - state.pausedAt;
  return {
    ...state,
    isPaused: false,
    pausedAt: null,
    phaseStartTime: state.phaseStartTime + pauseDuration,
  };
}

/** Skip the current phase and advance. */
export function skipPhase(state: PomodoroState, config: PomodoroConfig, now: number): PomodoroState {
  return advancePhase(state, config, now);
}

/** Stop a session early, returning the final state. */
export function stopSession(state: PomodoroState, now: number): PomodoroState {
  const elapsed = state.isPaused && state.pausedAt !== null
    ? state.pausedAt - state.phaseStartTime
    : now - state.phaseStartTime;

  let finalState = { ...state };
  if (state.phase === 'work') {
    finalState.totalFocusMs += Math.min(elapsed, state.phaseDuration);
  } else if (state.phase !== 'completed') {
    finalState.totalBreakMs += Math.min(elapsed, state.phaseDuration);
  }
  finalState.phase = 'completed';
  finalState.isPaused = false;
  finalState.pausedAt = null;
  return finalState;
}

/** Format milliseconds to MM:SS string. */
export function formatTimerDisplay(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Calculate focus session statistics from session history. */
export function calculateFocusStats(sessions: FocusSession[], now: number): FocusStats {
  const today = new Date(now).toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

  let todayMinutes = 0;
  let weekMinutes = 0;
  let monthMinutes = 0;
  let completedSessions = 0;
  let bestSessionMinutes = 0;

  for (const s of sessions) {
    const sessionDate = s.startedAt.slice(0, 10);
    const focusMinutes = Math.round(s.totalFocusSeconds / 60);

    if (s.status === 'completed') completedSessions++;
    if (focusMinutes > bestSessionMinutes) bestSessionMinutes = focusMinutes;

    if (sessionDate >= today) todayMinutes += focusMinutes;
    if (sessionDate >= weekAgo) weekMinutes += focusMinutes;
    if (sessionDate >= monthAgo) monthMinutes += focusMinutes;
  }

  return { todayMinutes, weekMinutes, monthMinutes, completedSessions, bestSessionMinutes };
}
