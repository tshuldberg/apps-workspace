import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import {
  getMeditationTemplates,
  getMeditationTemplatesByCategory,
  getMeditationTemplateById,
  createMeditationSession,
  completeMeditationSession,
  getMeditationSession,
  getMeditationSessions,
  getMeditationSessionCount,
} from '../db/meditation';
import {
  createTimerState,
  tickTimer,
  getStepProgress,
  getTotalProgress,
  getCurrentStep,
  getRemainingTime,
  getCompletedStepCount,
} from '../engine/meditation';
import type { MeditationStep } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Meditation Engine', () => {
  const steps: MeditationStep[] = [
    { instruction: 'Breathe in', durationSeconds: 10 },
    { instruction: 'Hold', durationSeconds: 5 },
    { instruction: 'Breathe out', durationSeconds: 10 },
  ];

  describe('createTimerState', () => {
    it('starts at step 0 with 0 elapsed', () => {
      const state = createTimerState();
      expect(state.currentStepIndex).toBe(0);
      expect(state.elapsedInStep).toBe(0);
      expect(state.totalElapsed).toBe(0);
      expect(state.isComplete).toBe(false);
    });
  });

  describe('tickTimer', () => {
    it('advances elapsed within current step', () => {
      const state = createTimerState();
      const next = tickTimer(state, steps, 5);
      expect(next.currentStepIndex).toBe(0);
      expect(next.elapsedInStep).toBe(5);
      expect(next.totalElapsed).toBe(5);
    });

    it('transitions to next step when duration reached', () => {
      const state = createTimerState();
      const next = tickTimer(state, steps, 10);
      expect(next.currentStepIndex).toBe(1);
      expect(next.elapsedInStep).toBe(0);
    });

    it('handles overshoot across multiple steps', () => {
      const state = createTimerState();
      const next = tickTimer(state, steps, 20);
      expect(next.currentStepIndex).toBe(2);
      expect(next.elapsedInStep).toBe(5);
    });

    it('completes when all steps are done', () => {
      const state = createTimerState();
      const next = tickTimer(state, steps, 25);
      expect(next.isComplete).toBe(true);
    });

    it('does not advance past completion', () => {
      const state = createTimerState();
      const complete = tickTimer(state, steps, 30);
      const extra = tickTimer(complete, steps, 5);
      expect(extra.isComplete).toBe(true);
    });

    it('handles empty steps', () => {
      const state = createTimerState();
      const next = tickTimer(state, [], 5);
      expect(next).toEqual(state);
    });
  });

  describe('getStepProgress', () => {
    it('returns 0 at start', () => {
      expect(getStepProgress(createTimerState(), steps)).toBe(0);
    });

    it('returns fraction within step', () => {
      const state = { currentStepIndex: 0, elapsedInStep: 5, totalElapsed: 5, isComplete: false };
      expect(getStepProgress(state, steps)).toBe(0.5);
    });

    it('returns 1 when complete', () => {
      const state = { currentStepIndex: 2, elapsedInStep: 10, totalElapsed: 25, isComplete: true };
      expect(getStepProgress(state, steps)).toBe(1);
    });
  });

  describe('getTotalProgress', () => {
    it('returns 0 at start', () => {
      expect(getTotalProgress(createTimerState(), steps)).toBe(0);
    });

    it('returns correct fraction', () => {
      const state = { currentStepIndex: 1, elapsedInStep: 0, totalElapsed: 10, isComplete: false };
      expect(getTotalProgress(state, steps)).toBe(0.4);
    });

    it('returns 1 when complete', () => {
      const state = { currentStepIndex: 2, elapsedInStep: 10, totalElapsed: 25, isComplete: true };
      expect(getTotalProgress(state, steps)).toBe(1);
    });
  });

  describe('getCurrentStep', () => {
    it('returns first step at start', () => {
      const step = getCurrentStep(createTimerState(), steps);
      expect(step?.instruction).toBe('Breathe in');
    });

    it('returns null when complete', () => {
      const state = { currentStepIndex: 2, elapsedInStep: 10, totalElapsed: 25, isComplete: true };
      expect(getCurrentStep(state, steps)).toBeNull();
    });
  });

  describe('getRemainingTime', () => {
    it('returns total duration at start', () => {
      expect(getRemainingTime(createTimerState(), steps)).toBe(25);
    });

    it('returns 0 when complete', () => {
      const state = { currentStepIndex: 2, elapsedInStep: 10, totalElapsed: 25, isComplete: true };
      expect(getRemainingTime(state, steps)).toBe(0);
    });
  });

  describe('getCompletedStepCount', () => {
    it('returns 0 at start', () => {
      expect(getCompletedStepCount(createTimerState(), steps)).toBe(0);
    });

    it('returns step count when complete', () => {
      const state = { currentStepIndex: 2, elapsedInStep: 10, totalElapsed: 25, isComplete: true };
      expect(getCompletedStepCount(state, steps)).toBe(3);
    });

    it('returns current index mid-session', () => {
      const state = { currentStepIndex: 1, elapsedInStep: 2, totalElapsed: 12, isComplete: false };
      expect(getCompletedStepCount(state, steps)).toBe(1);
    });
  });
});

describe('Meditation CRUD', () => {
  it('seeds 15 default templates', () => {
    const templates = getMeditationTemplates(testDb.adapter);
    expect(templates).toHaveLength(15);
  });

  it('has 3 templates per category', () => {
    for (const cat of ['beginner', 'body_scan', 'visualization', 'mindfulness', 'sleep']) {
      const templates = getMeditationTemplatesByCategory(testDb.adapter, cat);
      expect(templates).toHaveLength(3);
    }
  });

  it('retrieves template by id', () => {
    const tpl = getMeditationTemplateById(testDb.adapter, 'med-first-breath');
    expect(tpl).not.toBeNull();
    expect(tpl!.name).toBe('First Breath');
    expect(tpl!.steps.length).toBeGreaterThan(0);
  });

  it('templates have parsed steps array', () => {
    const tpl = getMeditationTemplateById(testDb.adapter, 'med-first-breath');
    expect(Array.isArray(tpl!.steps)).toBe(true);
    expect(tpl!.steps[0]).toHaveProperty('instruction');
    expect(tpl!.steps[0]).toHaveProperty('durationSeconds');
  });

  it('creates meditation session', () => {
    const session = createMeditationSession(testDb.adapter, 'ms-1', {
      templateId: 'med-first-breath',
      templateName: 'First Breath',
      durationSeconds: 180,
      totalSteps: 6,
      preMoodScore: 4,
    });
    expect(session.id).toBe('ms-1');
    expect(session.templateName).toBe('First Breath');
    expect(session.completed).toBe(false);
    expect(session.stepsCompleted).toBe(0);
  });

  it('completes meditation session', () => {
    createMeditationSession(testDb.adapter, 'ms-1', {
      templateName: 'First Breath', durationSeconds: 180, totalSteps: 6,
    });
    completeMeditationSession(testDb.adapter, 'ms-1', {
      stepsCompleted: 6,
      postMoodScore: 7,
    });
    const session = getMeditationSession(testDb.adapter, 'ms-1');
    expect(session).not.toBeNull();
    expect(session!.completed).toBe(true);
    expect(session!.stepsCompleted).toBe(6);
    expect(session!.postMoodScore).toBe(7);
  });

  it('returns null for missing session', () => {
    expect(getMeditationSession(testDb.adapter, 'missing')).toBeNull();
  });

  it('lists sessions in descending order', () => {
    createMeditationSession(testDb.adapter, 'ms-1', {
      templateName: 'A', durationSeconds: 100, totalSteps: 3,
    });
    createMeditationSession(testDb.adapter, 'ms-2', {
      templateName: 'B', durationSeconds: 200, totalSteps: 5,
    });
    const sessions = getMeditationSessions(testDb.adapter);
    expect(sessions).toHaveLength(2);
  });

  it('counts meditation sessions', () => {
    createMeditationSession(testDb.adapter, 'ms-1', {
      templateName: 'A', durationSeconds: 100, totalSteps: 3,
    });
    expect(getMeditationSessionCount(testDb.adapter)).toBe(1);
  });
});
