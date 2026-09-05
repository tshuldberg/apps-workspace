import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPomodoroInitialState,
  getPomodoroProgress,
  pausePomodoro,
  resetPomodoro,
  skipPomodoro,
  startPomodoro,
  tickPomodoro,
  type PomodoroPhase,
  type PomodoroProgress,
  type PomodoroSettings,
  type PomodoroState,
} from '@mylife/classes';

export interface PomodoroController {
  state: PomodoroState;
  progress: PomodoroProgress;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  skip: () => void;
  reset: () => void;
}

export interface WorkCompletePayload {
  durationMinutes: number;
  completedPomodoros: number;
}

/**
 * Drives the pure Pomodoro engine with a 1s interval. Calls `onWorkComplete`
 * whenever a work phase finishes (i.e. transitions away from `work`).
 */
export function usePomodoroController(
  settings: PomodoroSettings,
  onWorkComplete?: (payload: WorkCompletePayload) => void,
): PomodoroController {
  const [state, setState] = useState<PomodoroState>(() =>
    createPomodoroInitialState(settings),
  );
  const [isRunning, setIsRunning] = useState(false);
  const settingsRef = useRef(settings);
  const onWorkCompleteRef = useRef(onWorkComplete);
  const lastPhaseRef = useRef<PomodoroPhase>(state.phase);

  // Keep refs current without restarting the interval.
  useEffect(() => {
    onWorkCompleteRef.current = onWorkComplete;
  }, [onWorkComplete]);

  // Re-seed engine settings when user prefs change AND we're idle.
  useEffect(() => {
    settingsRef.current = settings;
    setState((prev) =>
      prev.phase === 'idle' ? createPomodoroInitialState(settings) : { ...prev, settings },
    );
  }, [settings]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setState((prev) => {
        const next = tickPomodoro(prev, 1);
        if (
          lastPhaseRef.current === 'work' &&
          next.phase !== 'work' &&
          next.phase !== 'idle'
        ) {
          // Work block just completed.
          onWorkCompleteRef.current?.({
            durationMinutes: prev.settings.workMinutes,
            completedPomodoros: next.totalPomodoros,
          });
        }
        lastPhaseRef.current = next.phase;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const start = useCallback(() => {
    setState((prev) => {
      const next = prev.phase === 'idle' ? startPomodoro(prev) : prev;
      lastPhaseRef.current = next.phase;
      return next;
    });
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setState((prev) => pausePomodoro(prev));
    setIsRunning(false);
  }, []);

  const skip = useCallback(() => {
    setState((prev) => {
      const next = skipPomodoro(prev);
      lastPhaseRef.current = next.phase;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => resetPomodoro(prev));
    lastPhaseRef.current = 'idle';
    setIsRunning(false);
  }, []);

  const progress = getPomodoroProgress(state);

  return { state, progress, isRunning, start, pause, skip, reset };
}

export function formatRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function phaseAccentLabel(phase: PomodoroPhase): string {
  switch (phase) {
    case 'work':
      return 'Focus';
    case 'short_break':
      return 'Short break';
    case 'long_break':
      return 'Long break';
    case 'idle':
      return 'Idle';
  }
}

export function relativeTimeFrom(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  if (Number.isNaN(diffMs)) return '';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function mondayOfWeekISO(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay(); // 0 Sun..6 Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
