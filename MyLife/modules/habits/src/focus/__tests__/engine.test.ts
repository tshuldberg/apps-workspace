import { describe, it, expect } from 'vitest';
import {
  createPomodoroState,
  getRemainingMs,
  isPhaseComplete,
  advancePhase,
  pauseTimer,
  resumeTimer,
  skipPhase,
  stopSession,
  formatTimerDisplay,
  calculateFocusStats,
} from '../engine';
import type { PomodoroConfig, FocusSession } from '../../types';

const config: PomodoroConfig = {
  workDuration: 25 * 60 * 1000, // 25 min
  breakDuration: 5 * 60 * 1000, // 5 min
  longBreakDuration: 15 * 60 * 1000, // 15 min
  rounds: 4,
};

const shortConfig: PomodoroConfig = {
  workDuration: 2000, // 2 sec
  breakDuration: 1000, // 1 sec
  longBreakDuration: 3000, // 3 sec
  rounds: 2,
};

describe('Focus Timer Engine', () => {
  describe('createPomodoroState', () => {
    it('initializes in work phase, round 1', () => {
      const state = createPomodoroState(config, 1000);
      expect(state.phase).toBe('work');
      expect(state.round).toBe(1);
      expect(state.roundsTarget).toBe(4);
      expect(state.isPaused).toBe(false);
    });
  });

  describe('phase transitions', () => {
    it('work -> break after work duration', () => {
      const start = 0;
      let state = createPomodoroState(shortConfig, start);
      const afterWork = start + shortConfig.workDuration;
      expect(isPhaseComplete(state, afterWork)).toBe(true);

      state = advancePhase(state, shortConfig, afterWork);
      expect(state.phase).toBe('break');
      expect(state.round).toBe(1); // still round 1, break happens before incrementing
    });

    it('break -> work (round 2) after break duration', () => {
      let state = createPomodoroState(shortConfig, 0);
      // advance through work
      state = advancePhase(state, shortConfig, shortConfig.workDuration);
      // advance through break
      state = advancePhase(state, shortConfig, shortConfig.workDuration + shortConfig.breakDuration);
      expect(state.phase).toBe('work');
      expect(state.round).toBe(2);
    });

    it('completes after all rounds', () => {
      let state = createPomodoroState(shortConfig, 0);
      let t = 0;
      // Round 1: work -> break
      t += shortConfig.workDuration;
      state = advancePhase(state, shortConfig, t);
      t += shortConfig.breakDuration;
      state = advancePhase(state, shortConfig, t);
      // Round 2: work -> completed (final round)
      t += shortConfig.workDuration;
      state = advancePhase(state, shortConfig, t);
      expect(state.phase).toBe('completed');
    });

    it('long break triggers after every 4th round', () => {
      let state = createPomodoroState(config, 0);
      let t = 0;
      // Complete 4 work phases with breaks
      for (let round = 0; round < 3; round++) {
        t += config.workDuration;
        state = advancePhase(state, config, t);
        t += config.breakDuration;
        state = advancePhase(state, config, t);
      }
      // 4th work phase
      t += config.workDuration;
      state = advancePhase(state, config, t);
      expect(state.phase).toBe('completed');
    });
  });

  describe('pause/resume', () => {
    it('preserves remaining time across pause/resume', () => {
      const state = createPomodoroState(config, 0);
      const pauseTime = 10 * 60 * 1000; // 10 min into 25 min work
      const paused = pauseTimer(state, pauseTime);
      expect(paused.isPaused).toBe(true);

      const remaining = getRemainingMs(paused, pauseTime + 5000); // 5s later
      expect(remaining).toBe(15 * 60 * 1000); // 15 min left (paused at 10)

      const resumed = resumeTimer(paused, pauseTime + 5000);
      expect(resumed.isPaused).toBe(false);
      const remainingAfter = getRemainingMs(resumed, pauseTime + 5000 + 60000); // 1 min after resume
      expect(remainingAfter).toBe(14 * 60 * 1000); // 14 min left
    });
  });

  describe('skip', () => {
    it('advances to next phase', () => {
      const state = createPomodoroState(shortConfig, 0);
      const skipped = skipPhase(state, shortConfig, 500);
      expect(skipped.phase).toBe('break');
    });
  });

  describe('stopSession', () => {
    it('marks session as completed with accumulated time', () => {
      let state = createPomodoroState(shortConfig, 0);
      // Work for 1 second
      const stopped = stopSession(state, 1000);
      expect(stopped.phase).toBe('completed');
      expect(stopped.totalFocusMs).toBe(1000);
    });
  });

  describe('formatTimerDisplay', () => {
    it('formats correctly', () => {
      expect(formatTimerDisplay(25 * 60 * 1000)).toBe('25:00');
      expect(formatTimerDisplay(5 * 1000)).toBe('00:05');
      expect(formatTimerDisplay(0)).toBe('00:00');
    });
  });

  describe('calculateFocusStats', () => {
    it('calculates stats from sessions', () => {
      const now = new Date('2026-03-22T18:00:00.000Z').getTime();
      const sessions: FocusSession[] = [
        {
          id: 's1', habitId: 'h1', workDuration: 1500000, breakDuration: 300000,
          roundsTarget: 4, roundsCompleted: 4, totalFocusSeconds: 4500,
          totalBreakSeconds: 900, status: 'completed',
          startedAt: '2026-03-22T10:00:00.000Z', completedAt: '2026-03-22T11:30:00.000Z',
          createdAt: '2026-03-22T10:00:00.000Z',
        },
      ];
      const stats = calculateFocusStats(sessions, now);
      expect(stats.todayMinutes).toBe(75);
      expect(stats.completedSessions).toBe(1);
      expect(stats.bestSessionMinutes).toBe(75);
    });

    it('returns zeros for no sessions', () => {
      const stats = calculateFocusStats([], Date.now());
      expect(stats.todayMinutes).toBe(0);
      expect(stats.completedSessions).toBe(0);
    });
  });
});
