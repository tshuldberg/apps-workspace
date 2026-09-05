import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';

// Experiment imports
import {
  createExperiment,
  getExperiment,
  getActiveExperiment,
  getExperiments,
  abandonExperiment,
  getTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getScoresInDateRange,
} from '../db/experiments';
import {
  computeDateRanges,
  transitionExperiment,
  analyzeExperiment,
  isSignificantExperiment,
  generateConclusion,
  correlationStrength,
} from '../engine/experiment';

// Lock imports
import {
  getLockConfig,
  setLockConfig,
  incrementFailedAttempts,
  resetFailedAttempts,
  setLockedUntil,
  disableLock,
} from '../db/lock';
import {
  hashPin,
  verifyPin,
  generateSalt,
  checkLockout,
  computeLockedUntil,
  isTimeoutElapsed,
} from '../engine/lock';

// Insight imports
import {
  standardDeviation,
  detectDayOfWeekPattern,
  detectTimeOfDayPattern,
  detectActivityImpact,
  detectEmotionCluster,
  detectStreakImpact,
  detectTrendDirection,
  detectVolatilityAlert,
  detectBestWorstDay,
  generateInsights,
  type EntryData,
  type ActivityCorrelationData,
} from '../engine/insight';

import { createMoodEntry } from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ═══════════════════════════════════════════════════════════════════════
// FEATURE 1: CUSTOM EXPERIMENTS
// ═══════════════════════════════════════════════════════════════════════

describe('Experiment Engine', () => {
  describe('computeDateRanges', () => {
    it('computes correct baseline_end (start + period - 1)', () => {
      const ranges = computeDateRanges('2026-03-01', 14);
      expect(ranges.baselineEnd).toBe('2026-03-14');
    });

    it('computes intervention_start = baseline_end + 1', () => {
      const ranges = computeDateRanges('2026-03-01', 14);
      expect(ranges.interventionStart).toBe('2026-03-15');
    });

    it('computes intervention_end = intervention_start + period - 1', () => {
      const ranges = computeDateRanges('2026-03-01', 14);
      expect(ranges.interventionEnd).toBe('2026-03-28');
    });

    it('handles 7-day periods', () => {
      const ranges = computeDateRanges('2026-03-01', 7);
      expect(ranges.baselineEnd).toBe('2026-03-07');
      expect(ranges.interventionStart).toBe('2026-03-08');
      expect(ranges.interventionEnd).toBe('2026-03-14');
    });
  });

  describe('transitionExperiment', () => {
    const baseExp = {
      id: 'exp-1',
      hypothesis: 'Test',
      interventionDescription: 'Test',
      periodDays: 14,
      baselineStart: '2026-03-01',
      baselineEnd: '2026-03-14',
      interventionStart: '2026-03-15',
      interventionEnd: '2026-03-28',
      status: 'draft' as const,
      templateId: null,
      baselineAvg: null,
      interventionAvg: null,
      baselineEntryCount: null,
      interventionEntryCount: null,
      scoreDiff: null,
      percentChange: null,
      pearsonR: null,
      isSignificant: null,
      conclusion: null,
      createdAt: '2026-03-01T00:00:00Z',
      completedAt: null,
    };

    it('stays draft when today < baseline_start', () => {
      expect(transitionExperiment(baseExp, '2026-02-28')).toBe('draft');
    });

    it('transitions draft -> baseline when today = baseline_start', () => {
      expect(transitionExperiment(baseExp, '2026-03-01')).toBe('baseline');
    });

    it('transitions baseline -> intervention when today > baseline_end', () => {
      expect(transitionExperiment({ ...baseExp, status: 'baseline' }, '2026-03-15')).toBe('intervention');
    });

    it('transitions intervention -> analyzing when today > intervention_end', () => {
      expect(transitionExperiment({ ...baseExp, status: 'intervention' }, '2026-03-29')).toBe('analyzing');
    });

    it('no transition for completed status', () => {
      expect(transitionExperiment({ ...baseExp, status: 'completed' }, '2026-04-01')).toBe('completed');
    });

    it('no transition for abandoned status', () => {
      expect(transitionExperiment({ ...baseExp, status: 'abandoned' }, '2026-04-01')).toBe('abandoned');
    });

    it('catches up through multiple transitions', () => {
      // draft should jump to analyzing if both periods elapsed
      expect(transitionExperiment(baseExp, '2026-04-01')).toBe('analyzing');
    });
  });

  describe('analyzeExperiment', () => {
    const exp = {
      id: 'exp-1',
      hypothesis: 'Exercise improves mood',
      interventionDescription: 'Run daily',
      periodDays: 14,
      baselineStart: '2026-03-01',
      baselineEnd: '2026-03-14',
      interventionStart: '2026-03-15',
      interventionEnd: '2026-03-28',
      status: 'analyzing' as const,
      templateId: null,
      baselineAvg: null,
      interventionAvg: null,
      baselineEntryCount: null,
      interventionEntryCount: null,
      scoreDiff: null,
      percentChange: null,
      pearsonR: null,
      isSignificant: null,
      conclusion: null,
      createdAt: '2026-03-01T00:00:00Z',
      completedAt: null,
    };

    it('computes correct baseline_avg', () => {
      const result = analyzeExperiment(exp, [5, 6, 7, 5, 6], [7, 8, 9, 8, 7]);
      expect(result.baselineAvg).toBe(5.8);
    });

    it('computes correct intervention_avg', () => {
      const result = analyzeExperiment(exp, [5, 6, 7, 5, 6], [7, 8, 9, 8, 7]);
      expect(result.interventionAvg).toBe(7.8);
    });

    it('computes score_diff = intervention_avg - baseline_avg', () => {
      const result = analyzeExperiment(exp, [5, 6, 7, 5, 6], [7, 8, 9, 8, 7]);
      expect(result.scoreDiff).toBe(2);
    });

    it('handles zero baseline entries', () => {
      const result = analyzeExperiment(exp, [], [7, 8]);
      expect(result.baselineAvg).toBeNull();
      expect(result.conclusion).toContain('No baseline data');
    });

    it('handles zero intervention entries', () => {
      const result = analyzeExperiment(exp, [5, 6, 7], []);
      expect(result.interventionAvg).toBeNull();
      expect(result.conclusion).toContain('No intervention data');
    });
  });

  describe('isSignificantExperiment', () => {
    it('requires |r| >= 0.3 AND total entries >= 20', () => {
      expect(isSignificantExperiment(0.4, 25)).toBe(true);
    });

    it('returns false when r < 0.3', () => {
      expect(isSignificantExperiment(0.2, 25)).toBe(false);
    });

    it('returns false when total entries < 20', () => {
      expect(isSignificantExperiment(0.5, 15)).toBe(false);
    });

    it('returns false for null r', () => {
      expect(isSignificantExperiment(null, 25)).toBe(false);
    });
  });

  describe('generateConclusion', () => {
    it('positive conclusion when significant AND r > 0', () => {
      const result = generateConclusion('Exercise helps', 1.5, 25, 0.5, true, 30);
      expect(result).toContain('Positive result');
    });

    it('negative conclusion when significant AND r < 0', () => {
      const result = generateConclusion('Exercise helps', -1.0, -15, -0.5, true, 30);
      expect(result).toContain('Unexpected result');
    });

    it('neutral conclusion when not significant', () => {
      const result = generateConclusion('Exercise helps', 0.5, 8, 0.15, false, 30);
      expect(result).toContain('No significant correlation');
    });

    it('includes preliminary warning for limited data', () => {
      const result = generateConclusion('Test', 1.0, 20, 0.3, false, 8);
      expect(result).toContain('Preliminary');
    });
  });

  describe('correlationStrength', () => {
    it('returns strong for |r| >= 0.7', () => {
      expect(correlationStrength(0.8)).toBe('strong');
    });
    it('returns moderate for |r| >= 0.3', () => {
      expect(correlationStrength(0.45)).toBe('moderate');
    });
    it('returns weak for |r| >= 0.1', () => {
      expect(correlationStrength(0.15)).toBe('weak');
    });
    it('returns none for null', () => {
      expect(correlationStrength(null)).toBe('none');
    });
  });
});

describe('Experiment CRUD', () => {
  it('creates experiment and returns it', () => {
    const exp = createExperiment(testDb.adapter, 'exp-1', {
      hypothesis: 'Exercise improves mood',
      interventionDescription: 'Run 30 min daily',
      periodDays: 14,
      baselineStart: '2026-03-01',
    });
    expect(exp.id).toBe('exp-1');
    expect(exp.hypothesis).toBe('Exercise improves mood');
    expect(exp.periodDays).toBe(14);
    expect(exp.baselineEnd).toBe('2026-03-14');
    expect(exp.interventionStart).toBe('2026-03-15');
  });

  it('retrieves experiment by id', () => {
    createExperiment(testDb.adapter, 'exp-1', {
      hypothesis: 'Test',
      interventionDescription: 'Test',
      periodDays: 7,
      baselineStart: '2026-04-01',
    });
    const found = getExperiment(testDb.adapter, 'exp-1');
    expect(found).not.toBeNull();
    expect(found!.hypothesis).toBe('Test');
  });

  it('gets active experiment', () => {
    createExperiment(testDb.adapter, 'exp-1', {
      hypothesis: 'Test',
      interventionDescription: 'Test',
      periodDays: 7,
      baselineStart: '2026-04-01',
    });
    const active = getActiveExperiment(testDb.adapter);
    expect(active).not.toBeNull();
  });

  it('abandons experiment', () => {
    createExperiment(testDb.adapter, 'exp-1', {
      hypothesis: 'Test',
      interventionDescription: 'Test',
      periodDays: 7,
      baselineStart: '2026-04-01',
    });
    abandonExperiment(testDb.adapter, 'exp-1');
    const exp = getExperiment(testDb.adapter, 'exp-1');
    expect(exp!.status).toBe('abandoned');
  });

  it('lists all experiments', () => {
    createExperiment(testDb.adapter, 'exp-1', {
      hypothesis: 'Test 1',
      interventionDescription: 'Test',
      periodDays: 7,
      baselineStart: '2026-04-01',
    });
    createExperiment(testDb.adapter, 'exp-2', {
      hypothesis: 'Test 2',
      interventionDescription: 'Test',
      periodDays: 14,
      baselineStart: '2026-05-01',
    });
    expect(getExperiments(testDb.adapter).length).toBe(2);
  });

  it('seeds 10 experiment templates', () => {
    const templates = getTemplates(testDb.adapter);
    expect(templates.length).toBe(10);
  });

  it('retrieves templates by category', () => {
    const exercise = getTemplatesByCategory(testDb.adapter, 'exercise');
    expect(exercise.length).toBeGreaterThanOrEqual(2);
    expect(exercise.every((t) => t.category === 'exercise')).toBe(true);
  });

  it('retrieves template by id', () => {
    const tpl = getTemplateById(testDb.adapter, 'tpl-morning-exercise');
    expect(tpl).not.toBeNull();
    expect(tpl!.name).toBe('Morning Exercise');
  });

  it('gets scores in date range', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7, loggedAt: '2026-03-01T10:00:00Z' });
    createMoodEntry(testDb.adapter, 'e2', { score: 5, loggedAt: '2026-03-02T10:00:00Z' });
    createMoodEntry(testDb.adapter, 'e3', { score: 8, loggedAt: '2026-03-05T10:00:00Z' });
    const scores = getScoresInDateRange(testDb.adapter, '2026-03-01', '2026-03-03');
    expect(scores).toEqual([7, 5]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FEATURE 2: PIN/BIOMETRIC LOCK
// ═══════════════════════════════════════════════════════════════════════

describe('Lock Engine', () => {
  describe('hashPin', () => {
    it('produces same hash for same PIN and salt', async () => {
      const h1 = await hashPin('1234', 'salt123');
      const h2 = await hashPin('1234', 'salt123');
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different PINs', async () => {
      const h1 = await hashPin('1234', 'salt123');
      const h2 = await hashPin('5678', 'salt123');
      expect(h1).not.toBe(h2);
    });

    it('produces different hashes for different salts', async () => {
      const h1 = await hashPin('1234', 'salt1');
      const h2 = await hashPin('1234', 'salt2');
      expect(h1).not.toBe(h2);
    });
  });

  describe('verifyPin', () => {
    it('returns true for correct PIN', async () => {
      const salt = generateSalt();
      const hash = await hashPin('1234', salt);
      expect(await verifyPin('1234', salt, hash)).toBe(true);
    });

    it('returns false for incorrect PIN', async () => {
      const salt = generateSalt();
      const hash = await hashPin('1234', salt);
      expect(await verifyPin('5678', salt, hash)).toBe(false);
    });
  });

  describe('checkLockout', () => {
    it('returns locked = false when failedAttempts < 5', () => {
      expect(checkLockout(3, null).isLocked).toBe(false);
    });

    it('returns locked = true when locked_until is in the future', () => {
      const future = new Date(Date.now() + 300000).toISOString();
      const result = checkLockout(5, future);
      expect(result.isLocked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    it('returns locked = false when locked_until has expired', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(checkLockout(5, past).isLocked).toBe(false);
    });
  });

  describe('isTimeoutElapsed', () => {
    it('returns true when timeout = 0 (lock immediately)', () => {
      expect(isTimeoutElapsed(Date.now(), 0)).toBe(true);
    });

    it('returns true when lastAuth is null', () => {
      expect(isTimeoutElapsed(null, 300)).toBe(true);
    });

    it('returns false when within timeout', () => {
      expect(isTimeoutElapsed(Date.now() - 10000, 300, Date.now())).toBe(false);
    });

    it('returns true when timeout has elapsed', () => {
      expect(isTimeoutElapsed(Date.now() - 400000, 300, Date.now())).toBe(true);
    });
  });
});

describe('Lock CRUD', () => {
  it('returns null when no lock configured', () => {
    expect(getLockConfig(testDb.adapter)).toBeNull();
  });

  it('sets and gets lock config', () => {
    setLockConfig(testDb.adapter, { isEnabled: true, method: 'pin', lockTimeoutSeconds: 0 });
    const config = getLockConfig(testDb.adapter);
    expect(config).not.toBeNull();
    expect(config!.isEnabled).toBe(true);
    expect(config!.method).toBe('pin');
    expect(config!.lockTimeoutSeconds).toBe(0);
  });

  it('increments failed attempts', () => {
    setLockConfig(testDb.adapter, { isEnabled: true, method: 'pin', lockTimeoutSeconds: 0 });
    const count = incrementFailedAttempts(testDb.adapter);
    expect(count).toBe(1);
    const count2 = incrementFailedAttempts(testDb.adapter);
    expect(count2).toBe(2);
  });

  it('resets failed attempts', () => {
    setLockConfig(testDb.adapter, { isEnabled: true, method: 'pin', lockTimeoutSeconds: 0 });
    incrementFailedAttempts(testDb.adapter);
    incrementFailedAttempts(testDb.adapter);
    resetFailedAttempts(testDb.adapter);
    const config = getLockConfig(testDb.adapter);
    expect(config!.failedAttempts).toBe(0);
  });

  it('sets locked_until', () => {
    setLockConfig(testDb.adapter, { isEnabled: true, method: 'pin', lockTimeoutSeconds: 0 });
    const lockUntil = computeLockedUntil();
    setLockedUntil(testDb.adapter, lockUntil);
    const config = getLockConfig(testDb.adapter);
    expect(config!.lockedUntil).toBe(lockUntil);
  });

  it('disables lock', () => {
    setLockConfig(testDb.adapter, { isEnabled: true, method: 'pin', lockTimeoutSeconds: 300 });
    disableLock(testDb.adapter);
    const config = getLockConfig(testDb.adapter);
    expect(config!.isEnabled).toBe(false);
    expect(config!.failedAttempts).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FEATURE 3: AI MOOD INSIGHTS
// ═══════════════════════════════════════════════════════════════════════

describe('Insight Engine', () => {
  describe('standardDeviation', () => {
    it('computes correctly for [1,2,3,4,5]', () => {
      const result = standardDeviation([1, 2, 3, 4, 5]);
      expect(Math.abs(result - 1.414)).toBeLessThan(0.01);
    });

    it('returns 0 for constant array', () => {
      expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    });

    it('returns 0 for empty array', () => {
      expect(standardDeviation([])).toBe(0);
    });
  });

  describe('detectDayOfWeekPattern', () => {
    it('returns insight when Wednesday avg is 2.0 higher than overall', () => {
      const entries: EntryData[] = [];
      // Build 4 weeks of data: Wednesdays score 9, all other days score 5
      for (let week = 0; week < 4; week++) {
        for (let dow = 0; dow < 7; dow++) {
          const d = new Date(Date.UTC(2026, 2, 2 + week * 7 + dow)); // Mar 2 is Monday
          const dateStr = d.toISOString().slice(0, 10);
          entries.push({
            score: dow === 2 ? 9 : 5, // Wednesday = index 2 from Monday start
            date: dateStr,
            loggedAt: d.toISOString(),
            activityNames: [],
            emotions: [],
          });
        }
      }

      const insights = detectDayOfWeekPattern(entries);
      expect(insights.length).toBeGreaterThanOrEqual(1);
      expect(insights.some((i) => i.title === 'Your Best Day')).toBe(true);
    });

    it('returns no insight when all averages are within 1.0', () => {
      const entries: EntryData[] = [];
      for (let i = 0; i < 20; i++) {
        const d = new Date(2026, 2, 1 + i);
        entries.push({
          score: 6,
          date: d.toISOString().slice(0, 10),
          loggedAt: d.toISOString(),
          activityNames: [],
          emotions: [],
        });
      }
      expect(detectDayOfWeekPattern(entries)).toEqual([]);
    });

    it('returns no insight with < 14 entries', () => {
      const entries: EntryData[] = Array.from({ length: 10 }, (_, i) => ({
        score: 5 + (i % 3),
        date: `2026-03-0${i + 1}`,
        loggedAt: `2026-03-0${i + 1}T10:00:00Z`,
        activityNames: [],
        emotions: [],
      }));
      expect(detectDayOfWeekPattern(entries)).toEqual([]);
    });
  });

  describe('detectTimeOfDayPattern', () => {
    it('returns insight when morning avg differs by > 0.8', () => {
      const entries: EntryData[] = [];
      for (let i = 0; i < 10; i++) {
        entries.push({
          score: 9, date: `2026-03-${String(i + 1).padStart(2, '0')}`,
          loggedAt: `2026-03-${String(i + 1).padStart(2, '0')}T08:00:00Z`, // morning
          activityNames: [], emotions: [],
        });
      }
      for (let i = 0; i < 10; i++) {
        entries.push({
          score: 5, date: `2026-03-${String(i + 11).padStart(2, '0')}`,
          loggedAt: `2026-03-${String(i + 11).padStart(2, '0')}T20:00:00Z`, // evening
          activityNames: [], emotions: [],
        });
      }
      const insights = detectTimeOfDayPattern(entries);
      expect(insights.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('detectActivityImpact', () => {
    it('returns insight for activity with |r| >= 0.2', () => {
      const correlations: ActivityCorrelationData[] = [
        { activityName: 'Exercise', averageScore: 8.0, entryCount: 10, pearsonR: 0.45 },
        { activityName: 'Work', averageScore: 4.5, entryCount: 10, pearsonR: -0.3 },
      ];
      const insights = detectActivityImpact(correlations, 6.0);
      expect(insights.length).toBe(2);
      expect(insights[0].title).toContain('Exercise');
    });

    it('returns no insight when no sufficient correlation', () => {
      const correlations: ActivityCorrelationData[] = [
        { activityName: 'Walking', averageScore: 6.1, entryCount: 5, pearsonR: 0.05 },
      ];
      expect(detectActivityImpact(correlations, 6.0)).toEqual([]);
    });
  });

  describe('detectEmotionCluster', () => {
    it('returns insight for pair co-occurring in > 30%', () => {
      const entries: EntryData[] = [];
      for (let i = 0; i < 15; i++) {
        entries.push({
          score: 7,
          date: `2026-03-${String(i + 1).padStart(2, '0')}`,
          loggedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          activityNames: [],
          emotions: i < 10 ? ['joy', 'anticipation'] : ['sadness', 'anger'],
        });
      }
      const insights = detectEmotionCluster(entries);
      expect(insights.length).toBeGreaterThanOrEqual(1);
      expect(insights[0].body).toContain('Joy');
    });

    it('returns no insight when no pairs exceed threshold', () => {
      const entries: EntryData[] = Array.from({ length: 15 }, (_, i) => ({
        score: 6, date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        loggedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        activityNames: [],
        emotions: [`emotion${i}`, `emotion${i + 100}`], // all unique pairs
      }));
      expect(detectEmotionCluster(entries)).toEqual([]);
    });
  });

  describe('detectStreakImpact', () => {
    it('returns insight when diff > 0.5', () => {
      const insights = detectStreakImpact(
        [7, 8, 7, 8, 7],       // streak days
        [4, 5, 4],             // non-streak days
      );
      expect(insights.length).toBe(1);
      expect(insights[0].title).toBe('Streaks Help');
    });
  });

  describe('detectTrendDirection', () => {
    it('returns trending up when thisWeek > fourWeek + 1.0', () => {
      const insights = detectTrendDirection(8.0, 6.0, 5);
      expect(insights.length).toBe(1);
      expect(insights[0].title).toBe('Great Week!');
    });

    it('returns trending down when thisWeek < fourWeek - 1.0', () => {
      const insights = detectTrendDirection(4.0, 6.0, 5);
      expect(insights.length).toBe(1);
      expect(insights[0].title).toBe('Tough Week');
    });

    it('returns no insight when within 1.0', () => {
      expect(detectTrendDirection(6.5, 6.0, 5)).toEqual([]);
    });
  });

  describe('detectVolatilityAlert', () => {
    it('returns insight when 7-day stddev > 2.0', () => {
      const insights = detectVolatilityAlert([2, 9, 3, 8, 2, 9, 3]);
      expect(insights.length).toBe(1);
      expect(insights[0].title).toBe('Volatile Week');
    });

    it('returns no insight when stddev <= 2.0', () => {
      expect(detectVolatilityAlert([5, 6, 5, 6, 5, 6, 5])).toEqual([]);
    });
  });

  describe('detectBestWorstDay', () => {
    it('returns insights for best and worst days', () => {
      const entries: EntryData[] = [];
      for (let i = 0; i < 14; i++) {
        entries.push({
          score: i === 5 ? 10 : i === 10 ? 1 : 6,
          date: `2026-03-${String(i + 1).padStart(2, '0')}`,
          loggedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          activityNames: i === 5 ? ['Exercise'] : [],
          emotions: [],
        });
      }
      const insights = detectBestWorstDay(entries);
      expect(insights.length).toBe(2);
      expect(insights[0].title).toBe('Your Best Day');
      expect(insights[1].title).toBe('Your Hardest Day');
    });
  });

  describe('generateInsights', () => {
    it('runs all detectors and aggregates results', () => {
      const entries: EntryData[] = [];
      for (let i = 0; i < 20; i++) {
        entries.push({
          score: 5 + (i % 4),
          date: `2026-03-${String(i + 1).padStart(2, '0')}`,
          loggedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          activityNames: [],
          emotions: [],
        });
      }

      const result = generateInsights({
        entries,
        activityCorrelations: [],
        overallAvg: 6.5,
        thisWeekAvg: 6.5,
        fourWeekAvg: 6.5,
        thisWeekCount: 5,
        dailyAverages: [6, 6, 7, 6, 7, 6, 6],
        streakDayScores: [],
        nonStreakDayScores: [],
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('deduplicates insights with same id', () => {
      const entries: EntryData[] = Array.from({ length: 20 }, (_, i) => ({
        score: 6,
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        loggedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        activityNames: [],
        emotions: [],
      }));

      const result = generateInsights({
        entries,
        activityCorrelations: [],
        overallAvg: 6,
        thisWeekAvg: 6,
        fourWeekAvg: 6,
        thisWeekCount: 5,
        dailyAverages: [6, 6, 6, 6, 6, 6, 6],
        streakDayScores: [],
        nonStreakDayScores: [],
      });

      const ids = result.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length); // no dupes
    });

    it('returns empty array when all detectors return no insights', () => {
      const result = generateInsights({
        entries: [],
        activityCorrelations: [],
        overallAvg: 0,
        thisWeekAvg: 0,
        fourWeekAvg: 0,
        thisWeekCount: 0,
        dailyAverages: [],
        streakDayScores: [],
        nonStreakDayScores: [],
      });
      expect(result).toEqual([]);
    });
  });
});
