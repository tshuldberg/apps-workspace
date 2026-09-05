import { describe, it, expect } from 'vitest';
import {
  getChallengeDefinition,
  checkDayCompletion,
  computeChallengeProgress,
  CHALLENGE_DEFINITIONS,
} from '../engine/challenges';

describe('CHALLENGE_DEFINITIONS', () => {
  it('has 6 challenge definitions', () => {
    expect(CHALLENGE_DEFINITIONS).toHaveLength(6);
  });

  it('each has required fields', () => {
    for (const def of CHALLENGE_DEFINITIONS) {
      expect(def.type).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.durationDays).toBeGreaterThan(0);
      expect(def.dailyRequirement).toBeTruthy();
    }
  });
});

describe('getChallengeDefinition', () => {
  it('returns definition for valid type', () => {
    const def = getChallengeDefinition('gratitude_30');
    expect(def).toBeDefined();
    expect(def!.name).toBe('30 Days of Gratitude');
    expect(def!.durationDays).toBe(30);
  });

  it('returns undefined for invalid type', () => {
    expect(getChallengeDefinition('invalid' as any)).toBeUndefined();
  });
});

describe('checkDayCompletion', () => {
  const baseDayData = {
    hasEntry: false,
    hasGratitudePrompt: false,
    hasThoughtRecord: false,
    hasStoicPrompt: false,
    hasPhoto: false,
    hasMood: false,
    hasReflectionPrompt: false,
    hasTherapyPrompt: false,
  };

  it('checks any_entry requirement', () => {
    expect(checkDayCompletion('any_entry', { ...baseDayData, hasEntry: true })).toBe(true);
    expect(checkDayCompletion('any_entry', baseDayData)).toBe(false);
  });

  it('checks gratitude_prompt requirement', () => {
    expect(checkDayCompletion('gratitude_prompt', { ...baseDayData, hasGratitudePrompt: true })).toBe(true);
    expect(checkDayCompletion('gratitude_prompt', baseDayData)).toBe(false);
  });

  it('checks cbt_thought_record requirement', () => {
    expect(checkDayCompletion('cbt_thought_record', { ...baseDayData, hasThoughtRecord: true })).toBe(true);
  });

  it('checks entry_with_photo requirement', () => {
    expect(checkDayCompletion('entry_with_photo', { ...baseDayData, hasPhoto: true })).toBe(true);
  });

  it('checks entry_with_mood requirement', () => {
    expect(checkDayCompletion('entry_with_mood', { ...baseDayData, hasMood: true })).toBe(true);
  });
});

describe('computeChallengeProgress', () => {
  it('returns zero progress for no completed days', () => {
    const result = computeChallengeProgress('gratitude_30', '2026-01-01', []);
    expect(result.daysCompleted).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.currentStreak).toBe(0);
    expect(result.completionRate).toBe(0);
  });

  it('computes progress correctly', () => {
    const days = [true, true, false, true, true, true];
    const result = computeChallengeProgress('stoic_week', '2026-01-01', days);
    expect(result.daysCompleted).toBe(5);
    expect(result.totalDays).toBe(7);
    expect(result.currentStreak).toBe(3);
    expect(result.isComplete).toBe(false);
  });

  it('marks complete when all days done', () => {
    const days = new Array(7).fill(true);
    const result = computeChallengeProgress('stoic_week', '2026-01-01', days);
    expect(result.isComplete).toBe(true);
    expect(result.completionRate).toBe(1);
  });

  it('uses special completion rule for cbt_starter (7 of 14)', () => {
    const days = [true, false, true, false, true, false, true, false, true, false, true, false, true, false];
    const result = computeChallengeProgress('cbt_starter', '2026-01-01', days);
    expect(result.daysCompleted).toBe(7);
    expect(result.isComplete).toBe(true);
  });

  it('cbt_starter incomplete with only 6 records', () => {
    const days = [true, false, true, false, true, false, true, false, true, false, true, false, false, false];
    const result = computeChallengeProgress('cbt_starter', '2026-01-01', days);
    expect(result.daysCompleted).toBe(6);
    expect(result.isComplete).toBe(false);
  });
});
