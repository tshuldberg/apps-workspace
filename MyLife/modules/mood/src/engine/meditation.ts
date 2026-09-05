import type { MeditationStep } from '../types';

export interface TimerState {
  currentStepIndex: number;
  elapsedInStep: number;
  totalElapsed: number;
  isComplete: boolean;
}

export function createTimerState(): TimerState {
  return {
    currentStepIndex: 0,
    elapsedInStep: 0,
    totalElapsed: 0,
    isComplete: false,
  };
}

export function tickTimer(state: TimerState, steps: MeditationStep[], deltaSec: number): TimerState {
  if (state.isComplete || steps.length === 0) return state;

  let newElapsedInStep = state.elapsedInStep + deltaSec;
  let newTotalElapsed = state.totalElapsed + deltaSec;
  let newStepIndex = state.currentStepIndex;

  while (newStepIndex < steps.length && newElapsedInStep >= steps[newStepIndex].durationSeconds) {
    newElapsedInStep -= steps[newStepIndex].durationSeconds;
    newStepIndex++;
  }

  const isComplete = newStepIndex >= steps.length;
  if (isComplete) {
    newStepIndex = steps.length - 1;
    newElapsedInStep = steps[newStepIndex].durationSeconds;
  }

  return {
    currentStepIndex: newStepIndex,
    elapsedInStep: newElapsedInStep,
    totalElapsed: newTotalElapsed,
    isComplete,
  };
}

export function getStepProgress(state: TimerState, steps: MeditationStep[]): number {
  if (steps.length === 0) return 0;
  if (state.isComplete) return 1;
  const step = steps[state.currentStepIndex];
  if (!step) return 0;
  return Math.min(state.elapsedInStep / step.durationSeconds, 1);
}

export function getTotalProgress(state: TimerState, steps: MeditationStep[]): number {
  const totalDuration = steps.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (totalDuration === 0) return 0;
  return Math.min(state.totalElapsed / totalDuration, 1);
}

export function getCurrentStep(state: TimerState, steps: MeditationStep[]): MeditationStep | null {
  if (state.isComplete || steps.length === 0) return null;
  return steps[state.currentStepIndex] ?? null;
}

export function getRemainingTime(state: TimerState, steps: MeditationStep[]): number {
  const totalDuration = steps.reduce((sum, s) => sum + s.durationSeconds, 0);
  return Math.max(0, totalDuration - state.totalElapsed);
}

export function getCompletedStepCount(state: TimerState, steps: MeditationStep[]): number {
  if (state.isComplete) return steps.length;
  return state.currentStepIndex;
}
