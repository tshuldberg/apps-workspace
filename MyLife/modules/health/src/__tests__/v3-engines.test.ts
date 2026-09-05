import { describe, it, expect } from 'vitest';

// Heart Rate During Sleep
import {
  getSleepHeartRateData, mapTimestampToStage, getStageAverages,
  calculateHrDip, calculateSleepHrAnalysis,
} from '../sleep/hr-analysis';
import type { HrReading, SleepWindow } from '../sleep/hr-analysis';

// Smart Alarm
import {
  calculateWakeWindow, parseTargetTime, shouldTriggerAlarm,
  calculateSuccessRate, getNextAlarmTime, formatDaysOfWeek,
} from '../smart-alarm/engine';

// Snore Detection
import {
  classifySnoreIntensity, getIntensityWeight, calculateSnorePercentage,
  calculateSnoreScore, getScoreCategory, getScoreColor,
  finalizeSession, sessionsOverlap, SNORE_DISCLAIMER,
} from '../snore/engine';

// ============================================================================
// 1. Heart Rate During Sleep
// ============================================================================

describe('Heart Rate During Sleep Engine', () => {
  const sleepWindow: SleepWindow = {
    start_time: '2026-03-15T23:00:00',
    end_time: '2026-03-16T06:30:00',
    deep_minutes: 90,
    rem_minutes: 100,
    light_minutes: 200,
    awake_minutes: 30,
    duration_minutes: 450,
  };

  const hrReadings: HrReading[] = [
    { value: 72, recorded_at: '2026-03-15T22:00:00' }, // before sleep
    { value: 58, recorded_at: '2026-03-15T23:30:00' }, // during deep
    { value: 52, recorded_at: '2026-03-16T00:30:00' }, // during deep
    { value: 48, recorded_at: '2026-03-16T01:00:00' }, // during deep/REM boundary
    { value: 56, recorded_at: '2026-03-16T02:00:00' }, // during REM
    { value: 54, recorded_at: '2026-03-16T03:00:00' }, // during light
    { value: 60, recorded_at: '2026-03-16T05:00:00' }, // during light
    { value: 65, recorded_at: '2026-03-16T06:00:00' }, // during awake
    { value: 75, recorded_at: '2026-03-16T08:00:00' }, // after sleep
  ];

  it('getSleepHeartRateData filters HR readings by sleep window', () => {
    const data = getSleepHeartRateData(hrReadings, sleepWindow);
    expect(data.length).toBe(7); // excludes before and after
    expect(data[0].bpm).toBe(58);
    expect(data[data.length - 1].bpm).toBe(65);
  });

  it('getSleepHeartRateData returns empty array when no HR data in window', () => {
    const emptyReadings: HrReading[] = [
      { value: 72, recorded_at: '2026-03-15T12:00:00' },
    ];
    const data = getSleepHeartRateData(emptyReadings, sleepWindow);
    expect(data).toHaveLength(0);
  });

  it('mapTimestampToStage returns null when no stage data', () => {
    const noStageWindow: SleepWindow = {
      ...sleepWindow,
      deep_minutes: null,
      rem_minutes: null,
      light_minutes: null,
      awake_minutes: null,
    };
    expect(mapTimestampToStage('2026-03-16T02:00:00', noStageWindow)).toBeNull();
  });

  it('mapTimestampToStage maps early timestamps to deep sleep', () => {
    // 23:00 to 06:30, deep is first 90/420 of the window
    const stage = mapTimestampToStage('2026-03-15T23:30:00', sleepWindow);
    expect(stage).toBe('deep');
  });

  it('calculateSleepHrAnalysis: average of [50, 60, 70] = 60', () => {
    const readings: HrReading[] = [
      { value: 50, recorded_at: '2026-03-16T01:00:00' },
      { value: 60, recorded_at: '2026-03-16T02:00:00' },
      { value: 70, recorded_at: '2026-03-16T03:00:00' },
    ];
    const result = calculateSleepHrAnalysis(readings, sleepWindow, null, null);
    expect(result).not.toBeNull();
    expect(result!.averageBpm).toBe(60);
  });

  it('calculateSleepHrAnalysis: lowest and highest identified correctly', () => {
    const result = calculateSleepHrAnalysis(hrReadings, sleepWindow, 72, 55);
    expect(result).not.toBeNull();
    expect(result!.lowestBpm).toBe(48);
    expect(result!.highestBpm).toBe(65);
    expect(result!.restingBpm).toBe(55);
  });

  it('calculateSleepHrAnalysis returns null when no data in window', () => {
    const result = calculateSleepHrAnalysis([], sleepWindow, 72, null);
    expect(result).toBeNull();
  });

  it('calculateHrDip: daytime avg 72, sleep avg 54 = 25% dip', () => {
    const dip = calculateHrDip(72, 54);
    expect(dip).toBe(25);
  });

  it('calculateHrDip: returns 0 when no daytime data', () => {
    expect(calculateHrDip(0, 54)).toBe(0);
  });

  it('getStageAverages: calculates per-stage averages correctly', () => {
    const data = getSleepHeartRateData(hrReadings, sleepWindow);
    const avgs = getStageAverages(data);
    expect(avgs.deep).not.toBeNull();
    expect(avgs.awake).not.toBeNull();
  });

  it('getStageAverages: handles missing stages (returns null)', () => {
    const avgs = getStageAverages([
      { timestamp: '2026-03-16T01:00:00', bpm: 50, stage: 'deep' },
    ]);
    expect(avgs.deep).toBe(50);
    expect(avgs.rem).toBeNull();
    expect(avgs.light).toBeNull();
    expect(avgs.awake).toBeNull();
  });

  it('cross-midnight: start 23:00, end 06:30, HR at 02:00 is included', () => {
    const data = getSleepHeartRateData(hrReadings, sleepWindow);
    const at2am = data.find((p) => p.timestamp === '2026-03-16T02:00:00');
    expect(at2am).toBeDefined();
    expect(at2am!.bpm).toBe(56);
  });
});

// ============================================================================
// 2. Smart Alarm
// ============================================================================

describe('Smart Alarm Engine', () => {
  it('calculateWakeWindow: target 07:00, window 20 = [06:40, 07:00]', () => {
    const target = new Date('2026-03-16T07:00:00');
    const window = calculateWakeWindow(target, 20);
    expect(window.start.getHours()).toBe(6);
    expect(window.start.getMinutes()).toBe(40);
    expect(window.end.getHours()).toBe(7);
    expect(window.end.getMinutes()).toBe(0);
  });

  it('calculateWakeWindow: target 00:15, window 30 = [23:45, 00:15]', () => {
    const target = new Date('2026-03-16T00:15:00');
    const window = calculateWakeWindow(target, 30);
    expect(window.start.getHours()).toBe(23);
    expect(window.start.getMinutes()).toBe(45);
    expect(window.end.getMinutes()).toBe(15);
  });

  it('shouldTriggerAlarm: light sleep during window = true', () => {
    const target = new Date('2026-03-16T07:00:00');
    const window = calculateWakeWindow(target, 20);
    const now = new Date('2026-03-16T06:50:00');
    const result = shouldTriggerAlarm(now, window, 'light');
    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('light_sleep');
  });

  it('shouldTriggerAlarm: deep sleep during window = false', () => {
    const target = new Date('2026-03-16T07:00:00');
    const window = calculateWakeWindow(target, 20);
    const now = new Date('2026-03-16T06:50:00');
    const result = shouldTriggerAlarm(now, window, 'deep');
    expect(result.shouldTrigger).toBe(false);
  });

  it('shouldTriggerAlarm: at window_end regardless of stage = true', () => {
    const target = new Date('2026-03-16T07:00:00');
    const window = calculateWakeWindow(target, 20);
    const now = new Date('2026-03-16T07:00:00');
    const result = shouldTriggerAlarm(now, window, 'deep');
    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('window_end');
  });

  it('shouldTriggerAlarm: before window = false', () => {
    const target = new Date('2026-03-16T07:00:00');
    const window = calculateWakeWindow(target, 20);
    const now = new Date('2026-03-16T06:30:00');
    const result = shouldTriggerAlarm(now, window, 'light');
    expect(result.shouldTrigger).toBe(false);
  });

  it('calculateSuccessRate: 7 light_sleep out of 10 total = 70%', () => {
    const history = [
      ...Array(7).fill({ trigger_reason: 'light_sleep' }),
      ...Array(3).fill({ trigger_reason: 'window_end' }),
    ];
    const result = calculateSuccessRate(history);
    expect(result.total).toBe(10);
    expect(result.lightSleepWakes).toBe(7);
    expect(result.rate).toBe(70);
  });

  it('calculateSuccessRate: handles 0 alarms gracefully', () => {
    const result = calculateSuccessRate([]);
    expect(result.total).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('getNextAlarmTime: Monday alarm on Sunday returns next Monday', () => {
    // 2026-03-15 is a Sunday
    const ref = new Date('2026-03-15T08:00:00');
    const next = getNextAlarmTime('07:00', '1', ref);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(1); // Monday
    expect(next!.getDate()).toBe(16);
  });

  it('getNextAlarmTime: daily alarm returns today if before target time', () => {
    const ref = new Date('2026-03-16T06:00:00'); // Monday 6 AM
    const next = getNextAlarmTime('07:00', '1,2,3,4,5,6,7', ref);
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(16); // same day
    expect(next!.getHours()).toBe(7);
  });

  it('getNextAlarmTime: no matching days returns null', () => {
    const next = getNextAlarmTime('07:00', '');
    expect(next).toBeNull();
  });

  it('parseTargetTime: past time returns tomorrow', () => {
    const ref = new Date('2026-03-16T10:00:00');
    const target = parseTargetTime('07:00', ref);
    expect(target.getDate()).toBe(17);
    expect(target.getHours()).toBe(7);
  });

  it('parseTargetTime: future time returns today', () => {
    const ref = new Date('2026-03-16T06:00:00');
    const target = parseTargetTime('07:00', ref);
    expect(target.getDate()).toBe(16);
  });

  it('formatDaysOfWeek: weekdays', () => {
    expect(formatDaysOfWeek('1,2,3,4,5')).toBe('Weekdays');
  });

  it('formatDaysOfWeek: weekends', () => {
    expect(formatDaysOfWeek('6,7')).toBe('Weekends');
  });

  it('formatDaysOfWeek: every day', () => {
    expect(formatDaysOfWeek('1,2,3,4,5,6,7')).toBe('Every day');
  });

  it('formatDaysOfWeek: specific days', () => {
    expect(formatDaysOfWeek('1,3,5')).toBe('Mon, Wed, Fri');
  });
});

// ============================================================================
// 3. Snore Detection
// ============================================================================

describe('Snore Detection Engine', () => {
  it('classifySnoreIntensity: 45 dB = light', () => {
    expect(classifySnoreIntensity(45)).toBe('light');
  });

  it('classifySnoreIntensity: 55 dB = moderate', () => {
    expect(classifySnoreIntensity(55)).toBe('moderate');
  });

  it('classifySnoreIntensity: 65 dB = loud', () => {
    expect(classifySnoreIntensity(65)).toBe('loud');
  });

  it('classifySnoreIntensity: 75 dB = epic', () => {
    expect(classifySnoreIntensity(75)).toBe('epic');
  });

  it('getIntensityWeight returns correct multipliers', () => {
    expect(getIntensityWeight('light')).toBe(0.5);
    expect(getIntensityWeight('moderate')).toBe(1.0);
    expect(getIntensityWeight('loud')).toBe(1.5);
    expect(getIntensityWeight('epic')).toBe(2.0);
  });

  it('calculateSnoreScore: 0% snoring = 0', () => {
    expect(calculateSnoreScore(0, [])).toBe(0);
  });

  it('calculateSnoreScore: 50% light snoring ~= 25', () => {
    const events = Array(10).fill({ intensity: 'light' as const });
    const score = calculateSnoreScore(50, events);
    expect(score).toBe(25); // 50 * 0.5 = 25
  });

  it('calculateSnoreScore: 50% loud snoring ~= 75', () => {
    const events = Array(10).fill({ intensity: 'loud' as const });
    const score = calculateSnoreScore(50, events);
    expect(score).toBe(75); // 50 * 1.5 = 75
  });

  it('calculateSnoreScore: clamps to 100 max', () => {
    const events = Array(10).fill({ intensity: 'epic' as const });
    const score = calculateSnoreScore(80, events);
    expect(score).toBe(100); // 80 * 2.0 = 160, clamped to 100
  });

  it('getScoreCategory: 5 = quiet', () => {
    expect(getScoreCategory(5)).toBe('quiet');
  });

  it('getScoreCategory: 25 = light', () => {
    expect(getScoreCategory(25)).toBe('light');
  });

  it('getScoreCategory: 45 = moderate', () => {
    expect(getScoreCategory(45)).toBe('moderate');
  });

  it('getScoreCategory: 70 = heavy', () => {
    expect(getScoreCategory(70)).toBe('heavy');
  });

  it('getScoreCategory: 90 = severe', () => {
    expect(getScoreCategory(90)).toBe('severe');
  });

  it('getScoreColor returns correct colors', () => {
    expect(getScoreColor(20)).toBe('#30D158');  // green
    expect(getScoreColor(45)).toBe('#FFD60A');  // yellow
    expect(getScoreColor(75)).toBe('#FF9F0A');  // orange
    expect(getScoreColor(90)).toBe('#FF453A');  // red
  });

  it('calculateSnorePercentage: 120 snore minutes / 480 total = 25%', () => {
    expect(calculateSnorePercentage(120, 480)).toBe(25);
  });

  it('calculateSnorePercentage: 0 total = 0', () => {
    expect(calculateSnorePercentage(10, 0)).toBe(0);
  });

  it('finalizeSession: computes all aggregate stats correctly', () => {
    const events = [
      { duration_seconds: 60, intensity: 'light', decibels: 45 },
      { duration_seconds: 120, intensity: 'moderate', decibels: 55 },
      { duration_seconds: 90, intensity: 'loud', decibels: 65 },
    ];
    const result = finalizeSession(events, 480);
    expect(result.eventCount).toBe(3);
    expect(result.snoreMinutes).toBe(5); // (60+120+90)/60 = 4.5 rounds to 5
    expect(result.loudestDb).toBe(65);
    expect(result.averageDb).toBe(55);
    expect(result.snoreScore).toBeGreaterThan(0);
    expect(result.snorePercentage).toBeGreaterThan(0);
  });

  it('finalizeSession: no events = score 0', () => {
    const result = finalizeSession([], 480);
    expect(result.snoreScore).toBe(0);
    expect(result.eventCount).toBe(0);
    expect(result.snoreMinutes).toBe(0);
  });

  it('sessionsOverlap: overlapping windows', () => {
    expect(sessionsOverlap(
      '2026-03-15T23:00:00', '2026-03-16T07:00:00',
      '2026-03-15T22:30:00', '2026-03-16T06:30:00',
    )).toBe(true);
  });

  it('sessionsOverlap: non-overlapping windows', () => {
    expect(sessionsOverlap(
      '2026-03-15T23:00:00', '2026-03-16T07:00:00',
      '2026-03-16T08:00:00', '2026-03-16T10:00:00',
    )).toBe(false);
  });

  it('SNORE_DISCLAIMER is defined and mentions informational purposes', () => {
    expect(SNORE_DISCLAIMER).toContain('informational purposes');
    expect(SNORE_DISCLAIMER).toContain('healthcare provider');
  });
});
