import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POMODORO_SETTINGS,
  createInitialState as createPomodoroInitialState,
  getProgress as getPomodoroProgress,
  pause as pausePomodoro,
  pomodoroSettingsFromUserSettings,
  reset as resetPomodoro,
  skip as skipPomodoro,
  start as startPomodoro,
  tick as tickPomodoro,
  type PomodoroState,
} from '../engine/pomodoro-engine';
import { DEFAULT_CLASSES_SETTINGS } from '../types';

const FAST_SETTINGS = {
  workMinutes: 1,
  shortBreakMinutes: 1,
  longBreakMinutes: 2,
  longBreakInterval: 4,
};

function fresh(): PomodoroState {
  return createPomodoroInitialState(FAST_SETTINGS);
}

describe('pomodoro-engine', () => {
  it('starts in idle and advances to work on start', () => {
    const initial = fresh();
    expect(initial.phase).toBe('idle');
    const started = startPomodoro(initial);
    expect(started.phase).toBe('work');
    expect(started.elapsedSeconds).toBe(0);
    expect(started.totalPomodoros).toBe(0);
  });

  it('transitions work -> short_break and back to work', () => {
    let state = startPomodoro(fresh());
    state = tickPomodoro(state, 60); // complete work block
    expect(state.phase).toBe('short_break');
    expect(state.totalPomodoros).toBe(1);
    state = tickPomodoro(state, 60); // complete short break
    expect(state.phase).toBe('work');
  });

  it('triggers a long_break every longBreakInterval pomodoros', () => {
    let state = startPomodoro(fresh());
    // Run 4 work + 3 short breaks worth of seconds, then the 4th break is long.
    // Cycle: work(60) + short(60) repeated 3x + work(60) = 7 minutes
    state = tickPomodoro(state, 60 * 7);
    // After 4th work block we should be in long_break.
    expect(state.totalPomodoros).toBe(4);
    expect(state.phase).toBe('long_break');
  });

  it('skip jumps to next phase without consuming time', () => {
    let state = startPomodoro(fresh());
    state = tickPomodoro(state, 30); // mid-work
    state = skipPomodoro(state);
    expect(state.phase).toBe('short_break');
    expect(state.totalPomodoros).toBe(1);
    expect(state.elapsedSeconds).toBe(0);
  });

  it('reset returns to idle and zero counters but preserves settings', () => {
    let state = startPomodoro(fresh());
    state = tickPomodoro(state, 30);
    const r = resetPomodoro(state);
    expect(r.phase).toBe('idle');
    expect(r.elapsedSeconds).toBe(0);
    expect(r.totalPomodoros).toBe(0);
    expect(r.settings).toEqual(FAST_SETTINGS);
  });

  it('pause is a no-op on state shape', () => {
    let state = startPomodoro(fresh());
    state = tickPomodoro(state, 15);
    const paused = pausePomodoro(state);
    expect(paused).toEqual(state);
  });

  it('tick on idle is a no-op', () => {
    const state = fresh();
    const ticked = tickPomodoro(state, 1000);
    expect(ticked).toEqual(state);
  });

  it('tick with non-positive delta is a no-op', () => {
    const state = startPomodoro(fresh());
    expect(tickPomodoro(state, 0)).toEqual(state);
    expect(tickPomodoro(state, -5)).toEqual(state);
  });

  it('getProgress reports percent and remaining seconds during a phase', () => {
    let state = startPomodoro(fresh());
    state = tickPomodoro(state, 30); // halfway through a 60s work block
    const p = getPomodoroProgress(state);
    expect(p.percent).toBeCloseTo(50, 5);
    expect(p.remainingSeconds).toBe(30);
    expect(p.phaseLabel).toBe('Focus');
  });

  it('getProgress returns idle defaults when not started', () => {
    const p = getPomodoroProgress(fresh());
    expect(p).toEqual({ percent: 0, remainingSeconds: 0, phaseLabel: 'Idle' });
  });

  it('handles a tick that overflows multiple phases in one step', () => {
    let state = startPomodoro(fresh());
    // 60 work + 60 short break + 30 of next work = 150s
    state = tickPomodoro(state, 150);
    expect(state.phase).toBe('work');
    expect(state.totalPomodoros).toBe(1);
    expect(state.elapsedSeconds).toBe(30);
  });

  it('DEFAULT_POMODORO_SETTINGS matches the classic 25/5/15/4 layout', () => {
    expect(DEFAULT_POMODORO_SETTINGS).toEqual({
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
    });
  });

  it('pomodoroSettingsFromUserSettings maps user preferences to engine settings', () => {
    const mapped = pomodoroSettingsFromUserSettings(DEFAULT_CLASSES_SETTINGS);
    expect(mapped.workMinutes).toBe(DEFAULT_CLASSES_SETTINGS.defaultStudyMinutes);
    expect(mapped.shortBreakMinutes).toBe(DEFAULT_CLASSES_SETTINGS.focusBreakMinutes);
    expect(mapped.longBreakMinutes).toBe(DEFAULT_POMODORO_SETTINGS.longBreakMinutes);
    expect(mapped.longBreakInterval).toBe(DEFAULT_POMODORO_SETTINGS.longBreakInterval);
  });

  it('clamps mapped user settings into engine bounds', () => {
    const mapped = pomodoroSettingsFromUserSettings({
      defaultStudyMinutes: 999,
      focusBreakMinutes: 999,
    });
    expect(mapped.workMinutes).toBeLessThanOrEqual(180);
    expect(mapped.shortBreakMinutes).toBeLessThanOrEqual(60);
  });
});
