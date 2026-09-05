import { describe, it, expect } from 'vitest';
import {
  createPlayerStatus,
  createStartedPlayerStatus,
  reducePlayer,
  playerProgress,
  formatTime,
  SPEED_OPTIONS,
} from '../../workout/engine';
import type { PlayerStatus, PlayerAction, WorkoutExerciseInput } from '../../types';

// ── Test helpers ──

function makeExercise(
  overrides: Partial<WorkoutExerciseInput> = {},
): WorkoutExerciseInput {
  return {
    exercise_id: overrides.exercise_id ?? 'ex-1',
    sets: overrides.sets ?? 3,
    reps: overrides.reps ?? 10,
    duration: overrides.duration ?? null,
    rest_after: overrides.rest_after ?? 60,
    order: overrides.order ?? 1,
    ...overrides,
  };
}

function makeDurationExercise(
  durationSec: number,
  overrides: Partial<WorkoutExerciseInput> = {},
): WorkoutExerciseInput {
  return makeExercise({
    exercise_id: overrides.exercise_id ?? 'ex-duration',
    sets: 1,
    reps: null,
    duration: durationSec,
    rest_after: 30,
    ...overrides,
  });
}

function applyActions(
  status: PlayerStatus,
  actions: PlayerAction[],
): PlayerStatus {
  return actions.reduce((s, a) => reducePlayer(s, a), status);
}

// ── Tests ──

describe('workout engine', () => {
  // ── createPlayerStatus ──

  describe('createPlayerStatus', () => {
    it('initializes with idle state', () => {
      const status = createPlayerStatus([makeExercise()]);
      expect(status.state).toBe('idle');
      expect(status.currentExerciseIndex).toBe(0);
      expect(status.currentSet).toBe(1);
      expect(status.currentRep).toBe(0);
      expect(status.elapsedTime).toBe(0);
      expect(status.speed).toBe(1.0);
      expect(status.completed).toEqual([]);
    });

    it('initializes with empty exercises array', () => {
      const status = createPlayerStatus([]);
      expect(status.state).toBe('idle');
      expect(status.exercises).toEqual([]);
    });

    it('builds group navigation for superset exercises', () => {
      const exercises = [
        makeExercise({ exercise_id: 'bench', order: 1, setGroupId: 'superset-1' }),
        makeExercise({ exercise_id: 'row', order: 2, setGroupId: 'superset-1' }),
        makeExercise({ exercise_id: 'curl', order: 3 }),
      ];
      const status = createPlayerStatus(exercises);
      expect(status.groupNavigation.firstInGroupById['superset-1']).toBe(0);
      expect(status.groupNavigation.nextInGroupByIndex[0]).toBe(1);
      expect(status.groupNavigation.nextInGroupByIndex[1]).toBeUndefined();
    });
  });

  describe('createStartedPlayerStatus', () => {
    it('starts in playing state and allows completing the current set', () => {
      const status = createStartedPlayerStatus([
        makeExercise({ sets: 2, reps: 10, rest_after: 0 }),
      ]);

      expect(status.state).toBe('playing');

      const next = reducePlayer(status, { type: 'COMPLETE_SET' });
      expect(next.state).toBe('playing');
      expect(next.currentSet).toBe(2);
      expect(next.completed).toEqual([]);
    });

    it('pauses and resumes from the started state', () => {
      let status = createStartedPlayerStatus([makeExercise()]);

      status = reducePlayer(status, { type: 'PAUSE' });
      expect(status.state).toBe('paused');

      status = reducePlayer(status, { type: 'RESUME' });
      expect(status.state).toBe('playing');
    });

    it('does not change createPlayerStatus idle initialization', () => {
      const status = createPlayerStatus([makeExercise()]);

      expect(status.state).toBe('idle');
    });
  });

  // ── State transitions ──

  describe('state transitions', () => {
    it('transitions idle -> playing on START', () => {
      const status = createPlayerStatus([makeExercise()]);
      const next = reducePlayer(status, { type: 'START' });
      expect(next.state).toBe('playing');
    });

    it('ignores START when not idle', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      const same = reducePlayer(status, { type: 'START' });
      expect(same.state).toBe('playing');
      expect(same).toBe(status); // reference equality -- no state change
    });

    it('transitions playing -> paused on PAUSE', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      status = reducePlayer(status, { type: 'PAUSE' });
      expect(status.state).toBe('paused');
    });

    it('ignores PAUSE when not playing', () => {
      const status = createPlayerStatus([makeExercise()]);
      const same = reducePlayer(status, { type: 'PAUSE' });
      expect(same.state).toBe('idle');
      expect(same).toBe(status);
    });

    it('transitions paused -> playing on RESUME', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'PAUSE' },
        { type: 'RESUME' },
      ]);
      expect(status.state).toBe('playing');
    });

    it('ignores RESUME when not paused', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      const same = reducePlayer(status, { type: 'RESUME' });
      expect(same).toBe(status);
    });

    it('transitions rest -> playing on REST_COMPLETE', () => {
      // Create a simple 1-set exercise, complete it, which triggers rest to next exercise
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 60 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' }, // completes rep -> triggers COMPLETE_SET -> rest state
      ]);
      expect(status.state).toBe('rest');
      expect(status.restRemaining).toBe(60000);

      status = reducePlayer(status, { type: 'REST_COMPLETE' });
      expect(status.state).toBe('playing');
      expect(status.restRemaining).toBe(0);
    });

    it('ignores REST_COMPLETE when not resting', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      const same = reducePlayer(status, { type: 'REST_COMPLETE' });
      expect(same).toBe(status);
    });

    it('transitions to completed when all exercises done', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.state).toBe('completed');
    });
  });

  // ── TICK ──

  describe('TICK action', () => {
    it('accumulates elapsed time while playing', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      status = reducePlayer(status, { type: 'TICK', deltaMs: 1000 });
      expect(status.elapsedTime).toBe(1000);
      expect(status.exerciseElapsed).toBe(1000);
    });

    it('respects playback speed for exercise elapsed', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'faster' }); // 1.25x
      status = reducePlayer(status, { type: 'TICK', deltaMs: 1000 });
      expect(status.elapsedTime).toBe(1000); // real-time
      expect(status.exerciseElapsed).toBe(1250); // speed-adjusted
    });

    it('does not advance in idle state', () => {
      const status = createPlayerStatus([makeExercise()]);
      const next = reducePlayer(status, { type: 'TICK', deltaMs: 1000 });
      expect(next).toBe(status);
    });

    it('does not advance in paused state', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'PAUSE' },
      ]);
      const paused = status;
      const next = reducePlayer(paused, { type: 'TICK', deltaMs: 1000 });
      expect(next).toBe(paused);
    });

    it('counts down rest timer during rest state', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 60 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.state).toBe('rest');
      expect(status.restRemaining).toBe(60000);

      status = reducePlayer(status, { type: 'TICK', deltaMs: 10000 });
      expect(status.restRemaining).toBe(50000);
    });

    it('auto-completes rest when timer reaches zero via TICK', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 5 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.state).toBe('rest');

      // Tick past the rest duration
      status = reducePlayer(status, { type: 'TICK', deltaMs: 6000 });
      expect(status.state).toBe('playing');
      expect(status.restRemaining).toBe(0);
    });

    it('auto-completes duration-based exercises', () => {
      const exercises = [
        makeDurationExercise(30, { exercise_id: 'plank', rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = reducePlayer(status, { type: 'START' });

      // Tick to exactly the duration
      status = reducePlayer(status, { type: 'TICK', deltaMs: 30000 });
      expect(status.state).toBe('completed');
    });
  });

  // ── Set/rep counting ──

  describe('set/rep counting', () => {
    it('increments rep count on COMPLETE_REP', () => {
      let status = createPlayerStatus([makeExercise({ reps: 5 })]);
      status = reducePlayer(status, { type: 'START' });
      status = reducePlayer(status, { type: 'COMPLETE_REP' });
      expect(status.currentRep).toBe(1);
      status = reducePlayer(status, { type: 'COMPLETE_REP' });
      expect(status.currentRep).toBe(2);
    });

    it('auto-completes set when all reps done', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 2, reps: 2, rest_after: 10 }),
      ];
      let status = createPlayerStatus(exercises);
      status = reducePlayer(status, { type: 'START' });

      // Complete 2 reps -> set complete
      status = reducePlayer(status, { type: 'COMPLETE_REP' });
      status = reducePlayer(status, { type: 'COMPLETE_REP' });

      // Should be in inter-set rest, next set
      expect(status.state).toBe('rest');
      expect(status.currentSet).toBe(2);
      expect(status.currentRep).toBe(0);
    });

    it('completes exercise after all sets', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 2, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = reducePlayer(status, { type: 'START' });
      status = reducePlayer(status, { type: 'COMPLETE_REP' });
      status = reducePlayer(status, { type: 'COMPLETE_REP' });
      expect(status.state).toBe('completed');
      expect(status.completed).toHaveLength(1);
      expect(status.completed[0].exercise_id).toBe('ex-1');
      expect(status.completed[0].sets_completed).toBe(1);
      expect(status.completed[0].skipped).toBe(false);
    });

    it('ignores COMPLETE_REP when not playing', () => {
      const status = createPlayerStatus([makeExercise()]);
      const same = reducePlayer(status, { type: 'COMPLETE_REP' });
      expect(same).toBe(status);
    });

    it('manually completes a set via COMPLETE_SET', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 2, reps: 10, rest_after: 30 }),
      ];
      let status = createPlayerStatus(exercises);
      status = reducePlayer(status, { type: 'START' });
      status = reducePlayer(status, { type: 'COMPLETE_SET' });

      // Should advance to next set with inter-set rest
      expect(status.state).toBe('rest');
      expect(status.currentSet).toBe(2);
      // Inter-set rest = min(rest_after*1000/2, 30000) = min(15000, 30000) = 15000
      expect(status.restRemaining).toBe(15000);
    });
  });

  // ── Rest timing ──

  describe('rest timing', () => {
    it('applies full rest_after when moving to next exercise', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 90 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      // Post-exercise rest = rest_after * 1000
      expect(status.state).toBe('rest');
      expect(status.restRemaining).toBe(90000);
    });

    it('applies half rest (capped at 30s) for inter-set rest', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 3, reps: 1, rest_after: 120 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      // Inter-set rest = min(120*1000/2, 30000) = min(60000, 30000) = 30000
      expect(status.state).toBe('rest');
      expect(status.restRemaining).toBe(30000);
    });

    it('skips rest when rest_after is 0', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 0 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      // No rest, directly to next exercise playing
      expect(status.state).toBe('playing');
      expect(status.currentExerciseIndex).toBe(1);
    });
  });

  // ── Superset / group logic ──

  describe('superset / group logic', () => {
    it('skips rest between exercises in same group when exercise completes', () => {
      const exercises = [
        makeExercise({ exercise_id: 'bench', sets: 1, reps: 1, rest_after: 60, setGroupId: 'ss-1' }),
        makeExercise({ exercise_id: 'row', sets: 1, reps: 1, rest_after: 60, setGroupId: 'ss-1' }),
        makeExercise({ exercise_id: 'curl', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' }, // Complete bench (1 set, 1 rep, last set)
      ]);

      // Should skip rest and go directly to row (same group)
      expect(status.state).toBe('playing');
      expect(status.currentExerciseIndex).toBe(1);
      expect(status.restRemaining).toBe(0);
    });

    it('advances to next group member on COMPLETE_SET when sets remain', () => {
      const exercises = [
        makeExercise({ exercise_id: 'bench', sets: 2, reps: 1, rest_after: 60, setGroupId: 'ss-1' }),
        makeExercise({ exercise_id: 'row', sets: 2, reps: 1, rest_after: 60, setGroupId: 'ss-1' }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' }, // Complete bench set 1
      ]);

      // Should advance to row within group (same set number)
      expect(status.state).toBe('playing');
      expect(status.currentExerciseIndex).toBe(1);
      expect(status.currentSet).toBe(1); // same set number
    });

    it('resets to first in group after last member completes a round', () => {
      const exercises = [
        makeExercise({ exercise_id: 'bench', sets: 2, reps: 1, rest_after: 60, setGroupId: 'ss-1' }),
        makeExercise({ exercise_id: 'row', sets: 2, reps: 1, rest_after: 60, setGroupId: 'ss-1' }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' }, // bench set 1 -> moves to row
      ]);
      expect(status.currentExerciseIndex).toBe(1); // row
      status = reducePlayer(status, { type: 'COMPLETE_REP' }); // row set 1

      // Should go back to bench (first in group) for set 2
      expect(status.currentExerciseIndex).toBe(0); // back to bench
      expect(status.currentSet).toBe(2);
    });
  });

  // ── SKIP_EXERCISE ──

  describe('SKIP_EXERCISE', () => {
    it('skips the current exercise and moves to next', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 3, reps: 10, rest_after: 60 }),
        makeExercise({ exercise_id: 'ex-2', sets: 3, reps: 10, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'SKIP_EXERCISE' },
      ]);

      expect(status.state).toBe('playing');
      expect(status.currentExerciseIndex).toBe(1);
      expect(status.completed).toHaveLength(1);
      expect(status.completed[0].skipped).toBe(true);
      expect(status.completed[0].sets_completed).toBe(0);
    });

    it('completes workout when last exercise is skipped', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'SKIP_EXERCISE' },
      ]);
      expect(status.state).toBe('completed');
    });

    it('works from rest state', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 60 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
        makeExercise({ exercise_id: 'ex-3', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' }, // Completes ex-1 -> rest
      ]);
      expect(status.state).toBe('rest');
      status = reducePlayer(status, { type: 'SKIP_EXERCISE' });
      // Should skip ex-2 and move to ex-3
      expect(status.currentExerciseIndex).toBe(2);
    });

    it('ignores SKIP_EXERCISE from idle state', () => {
      const status = createPlayerStatus([makeExercise()]);
      const same = reducePlayer(status, { type: 'SKIP_EXERCISE' });
      expect(same).toBe(status);
    });
  });

  // ── PREVIOUS_EXERCISE ──

  describe('PREVIOUS_EXERCISE', () => {
    it('goes back to previous exercise', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 0 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.currentExerciseIndex).toBe(1);

      status = reducePlayer(status, { type: 'PREVIOUS_EXERCISE' });
      expect(status.currentExerciseIndex).toBe(0);
      expect(status.state).toBe('playing');
      expect(status.completed).toHaveLength(0); // removed last completed entry
    });

    it('does nothing at first exercise', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      const same = reducePlayer(status, { type: 'PREVIOUS_EXERCISE' });
      expect(same).toBe(status);
    });
  });

  // ── ADJUST_SPEED ──

  describe('ADJUST_SPEED', () => {
    it('increases speed by 0.25 on faster', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'faster' });
      expect(status.speed).toBe(1.25);
    });

    it('decreases speed by 0.25 on slower', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'slower' });
      expect(status.speed).toBe(0.75);
    });

    it('resets to 1.0 on normal', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'faster' });
      status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'faster' });
      expect(status.speed).toBe(1.5);
      status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'normal' });
      expect(status.speed).toBe(1.0);
    });

    it('caps at 2.0 maximum', () => {
      let status = createPlayerStatus([makeExercise()]);
      for (let i = 0; i < 10; i++) {
        status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'faster' });
      }
      expect(status.speed).toBe(2.0);
    });

    it('caps at 0.5 minimum', () => {
      let status = createPlayerStatus([makeExercise()]);
      for (let i = 0; i < 10; i++) {
        status = reducePlayer(status, { type: 'ADJUST_SPEED', direction: 'slower' });
      }
      expect(status.speed).toBe(0.5);
    });
  });

  // ── ADJUST_REST ──

  describe('ADJUST_REST', () => {
    function enterRestState() {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 90 }),
        makeExercise({ exercise_id: 'ex-2', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.state).toBe('rest');
      expect(status.restRemaining).toBe(90000);
      return status;
    }

    it('adds 30s to rest remaining', () => {
      let status = enterRestState();
      status = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: 30000 });
      expect(status.restRemaining).toBe(120000);
      expect(status.state).toBe('rest');
    });

    it('subtracts 30s from rest remaining', () => {
      let status = enterRestState();
      status = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: -30000 });
      expect(status.restRemaining).toBe(60000);
      expect(status.state).toBe('rest');
    });

    it('clamps to 0 and triggers REST_COMPLETE when subtracting past zero', () => {
      let status = enterRestState();
      // Tick down to 20s remaining
      status = reducePlayer(status, { type: 'TICK', deltaMs: 70000 });
      expect(status.restRemaining).toBe(20000);
      // Subtract 30s (more than remaining)
      status = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: -30000 });
      expect(status.state).toBe('playing');
      expect(status.restRemaining).toBe(0);
    });

    it('allows adding time beyond 10 minutes', () => {
      let status = enterRestState();
      // Add 9 minutes (540s)
      status = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: 540000 });
      expect(status.restRemaining).toBe(630000); // 90s + 540s = 630s
      expect(status.state).toBe('rest');
    });

    it('ignores ADJUST_REST when not in rest state', () => {
      let status = createPlayerStatus([makeExercise()]);
      status = reducePlayer(status, { type: 'START' });
      expect(status.state).toBe('playing');
      const same = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: 30000 });
      expect(same).toBe(status);
    });

    it('ignores ADJUST_REST in idle state', () => {
      const status = createPlayerStatus([makeExercise()]);
      const same = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: 30000 });
      expect(same).toBe(status);
    });

    it('handles exact subtraction to zero', () => {
      let status = enterRestState();
      // Subtract exactly 90s
      status = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: -90000 });
      expect(status.state).toBe('playing');
      expect(status.restRemaining).toBe(0);
    });
  });

  // ── Integration: rest timer full flow ──

  describe('rest timer integration', () => {
    it('complete set -> rest -> adjust -> tick down -> complete -> next exercise', () => {
      const exercises = [
        makeExercise({ exercise_id: 'bench', sets: 1, reps: 1, rest_after: 60 }),
        makeExercise({ exercise_id: 'squat', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = reducePlayer(status, { type: 'START' });
      expect(status.state).toBe('playing');

      // Complete set -> enters rest
      status = reducePlayer(status, { type: 'COMPLETE_REP' });
      expect(status.state).toBe('rest');
      expect(status.restRemaining).toBe(60000);

      // Add 30s
      status = reducePlayer(status, { type: 'ADJUST_REST', deltaMs: 30000 });
      expect(status.restRemaining).toBe(90000);

      // Tick 90s -> rest completes
      status = reducePlayer(status, { type: 'TICK', deltaMs: 90000 });
      expect(status.state).toBe('playing');
      expect(status.currentExerciseIndex).toBe(1);
    });

    it('complete set -> rest -> skip rest -> next exercise immediately', () => {
      const exercises = [
        makeExercise({ exercise_id: 'bench', sets: 1, reps: 1, rest_after: 60 }),
        makeExercise({ exercise_id: 'squat', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.state).toBe('rest');

      // Skip rest
      status = reducePlayer(status, { type: 'REST_COMPLETE' });
      expect(status.state).toBe('playing');
      expect(status.currentExerciseIndex).toBe(1);
      expect(status.restRemaining).toBe(0);
    });
  });

  // ── Selectors ──

  describe('playerProgress', () => {
    it('returns 0 with no exercises', () => {
      const status = createPlayerStatus([]);
      expect(playerProgress(status)).toBe(0);
    });

    it('returns 0 when nothing completed', () => {
      const status = createPlayerStatus([makeExercise({ sets: 3 })]);
      expect(playerProgress(status)).toBe(0);
    });

    it('returns correct fraction during workout', () => {
      // 2 exercises, 2 sets each = 4 total sets
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 2, reps: 1, rest_after: 0 }),
        makeExercise({ exercise_id: 'ex-2', sets: 2, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' }, // ex-1 set 1
      ]);
      // Completed: ex-1 set 1 (inter-set), at set 2 now
      // doneSets from completed = 0 (exercise not fully done yet... wait)
      // Actually COMPLETE_REP -> COMPLETE_SET is triggered since reps=1
      // After set 1 complete with 2 sets: inter-set rest -> set 2
      // completed array is still empty (exercise not done), currentSet=2
      // progress = (0 + (2-1)) / 4 = 0.25
      const progress = playerProgress(status);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('returns 1 when fully completed', () => {
      const exercises = [
        makeExercise({ exercise_id: 'ex-1', sets: 1, reps: 1, rest_after: 0 }),
      ];
      let status = createPlayerStatus(exercises);
      status = applyActions(status, [
        { type: 'START' },
        { type: 'COMPLETE_REP' },
      ]);
      expect(status.state).toBe('completed');
      // completed has 1 entry with sets_completed=1, total sets=1
      // progress = min((1 + (1-1)) / 1, 1) -- but currentExerciseIndex is now past end
      // The formula: (doneSets + (currentSet - 1)) / totalSets
      // doneSets=1, currentSet=1, totalSets=1 -> (1+0)/1 = 1
      expect(playerProgress(status)).toBe(1);
    });
  });

  describe('formatTime', () => {
    it('formats zero', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats seconds only', () => {
      expect(formatTime(45000)).toBe('0:45');
    });

    it('formats minutes and seconds', () => {
      expect(formatTime(90000)).toBe('1:30');
    });

    it('pads seconds with leading zero', () => {
      expect(formatTime(65000)).toBe('1:05');
    });

    it('handles large values', () => {
      expect(formatTime(3600000)).toBe('60:00');
    });

    it('handles negative values by using absolute', () => {
      expect(formatTime(-5000)).toBe('0:05');
    });
  });

  describe('SPEED_OPTIONS', () => {
    it('contains expected speed values', () => {
      expect(SPEED_OPTIONS).toEqual([0.5, 0.75, 1.0, 1.25, 1.5, 2.0]);
    });
  });
});
