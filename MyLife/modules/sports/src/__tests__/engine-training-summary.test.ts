import { describe, expect, it } from 'vitest';
import {
  summarizeTraining,
  type TrainingSummaryInput,
  type TrainingWindow,
} from '../engine/training-summary';
import type { ParticipationSession } from '../types';

// ─ Factories ──────────────────────────────────────────────────────────

function session(
  overrides: Partial<ParticipationSession> &
    Pick<ParticipationSession, 'id' | 'sport' | 'started_at'>,
): ParticipationSession {
  const base: ParticipationSession = {
    id: overrides.id,
    sport: overrides.sport,
    activity: 'training',
    started_at: overrides.started_at,
    duration_minutes: 60,
    location: null,
    teammates: [],
    stats: {},
    personal_best: false,
    mood_before: null,
    mood_after: null,
    injury_notes: null,
    notes_md: null,
    photo_ids: [],
    created_at: overrides.started_at,
  };
  return { ...base, ...overrides };
}

// Known Monday 00:00:00 UTC epoch anchor. 2026-04-20 was a Monday.
const MONDAY_2026_04_20_UTC = Date.UTC(2026, 3, 20, 0, 0, 0, 0);
const DAY_MS = 86_400_000;

function ymdhmsUtc(
  year: number,
  month: number, // 1..12
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second, 0);
}

describe('summarizeTraining', () => {
  const window: TrainingWindow = {
    startMs: ymdhmsUtc(2026, 4, 1),
    endMs: ymdhmsUtc(2026, 5, 1),
  };

  it('returns zeros + empty arrays for empty input', () => {
    const input: TrainingSummaryInput = { window, sessions: [] };
    const summary = summarizeTraining(input);

    expect(summary.window).toEqual(window);
    expect(summary.totalSessions).toBe(0);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.sportsPracticed).toBe(0);
    expect(summary.bySport).toEqual([]);
    expect(summary.byWeek).toEqual([]);
    expect(summary.lastSessionAt).toBeNull();
  });

  it('filters sessions by started_at with half-open window', () => {
    const sessions: ParticipationSession[] = [
      // Before window -- excluded
      session({ id: 's0', sport: 'running', started_at: window.startMs - 1 }),
      // Exactly at startMs -- included
      session({ id: 's1', sport: 'running', started_at: window.startMs }),
      // Mid-window -- included
      session({
        id: 's2',
        sport: 'running',
        started_at: window.startMs + 1000,
      }),
      // Exactly at endMs -- excluded (half-open)
      session({ id: 's3', sport: 'running', started_at: window.endMs }),
      // After window -- excluded
      session({ id: 's4', sport: 'running', started_at: window.endMs + 1 }),
    ];

    const summary = summarizeTraining({ window, sessions });
    expect(summary.totalSessions).toBe(2);
    const ids = summary.bySport.map((b) => b.sport);
    expect(ids).toEqual(['running']);
    expect(summary.bySport[0].sessionCount).toBe(2);
  });

  it('sorts bySport by sessionCount desc, then sport asc', () => {
    const sessions: ParticipationSession[] = [
      // 2 basketball
      session({
        id: 'b1',
        sport: 'basketball',
        started_at: window.startMs + 1,
      }),
      session({
        id: 'b2',
        sport: 'basketball',
        started_at: window.startMs + 2,
      }),
      // 2 archery (ties with basketball; archery should come first alphabetically)
      session({ id: 'a1', sport: 'archery', started_at: window.startMs + 3 }),
      session({ id: 'a2', sport: 'archery', started_at: window.startMs + 4 }),
      // 3 running (wins count)
      session({ id: 'r1', sport: 'running', started_at: window.startMs + 5 }),
      session({ id: 'r2', sport: 'running', started_at: window.startMs + 6 }),
      session({ id: 'r3', sport: 'running', started_at: window.startMs + 7 }),
      // 1 zumba (loses)
      session({ id: 'z1', sport: 'zumba', started_at: window.startMs + 8 }),
    ];

    const summary = summarizeTraining({ window, sessions });
    expect(summary.bySport.map((b) => b.sport)).toEqual([
      'running', // 3
      'archery', // 2 (alpha before basketball)
      'basketball', // 2
      'zumba', // 1
    ]);
  });

  it('buckets byWeek by preceding Monday 00:00:00 UTC', () => {
    // A session at exactly Monday 00:00:00 UTC belongs to that Monday's bucket.
    const mondayAt00 = MONDAY_2026_04_20_UTC;
    // A session at Sunday 23:59:59 UTC (the day before the next Monday)
    // belongs to the PRIOR Monday (same week as mondayAt00).
    const sundayLate = MONDAY_2026_04_20_UTC + 6 * DAY_MS + 23 * 3600_000
      + 59 * 60_000 + 59_000;
    // A session 1 ms into the next week belongs to the next Monday.
    const nextMonday = MONDAY_2026_04_20_UTC + 7 * DAY_MS;

    const sessions: ParticipationSession[] = [
      session({ id: 'm1', sport: 'running', started_at: mondayAt00 }),
      session({ id: 'm2', sport: 'running', started_at: sundayLate }),
      session({ id: 'm3', sport: 'running', started_at: nextMonday }),
    ];

    const bigWindow: TrainingWindow = {
      startMs: mondayAt00 - DAY_MS,
      endMs: nextMonday + DAY_MS,
    };

    const summary = summarizeTraining({ window: bigWindow, sessions });
    expect(summary.byWeek).toHaveLength(2);
    expect(summary.byWeek[0].weekStartMs).toBe(MONDAY_2026_04_20_UTC);
    expect(summary.byWeek[0].sessionCount).toBe(2);
    expect(summary.byWeek[1].weekStartMs).toBe(nextMonday);
    expect(summary.byWeek[1].sessionCount).toBe(1);
    // Ascending order preserved.
    expect(summary.byWeek[0].weekStartMs).toBeLessThan(
      summary.byWeek[1].weekStartMs,
    );
  });

  it('treats duration_minutes null as 0', () => {
    const sessions: ParticipationSession[] = [
      session({
        id: 's1',
        sport: 'running',
        started_at: window.startMs + 1,
        duration_minutes: null,
      }),
      session({
        id: 's2',
        sport: 'running',
        started_at: window.startMs + 2,
        duration_minutes: 45,
      }),
    ];

    const summary = summarizeTraining({ window, sessions });
    expect(summary.totalMinutes).toBe(45);
    expect(summary.bySport[0].totalMinutes).toBe(45);
    expect(summary.byWeek[0].totalMinutes).toBe(45);
  });

  it('counts personal_best truthy rows per sport and sport distinct count', () => {
    const sessions: ParticipationSession[] = [
      session({
        id: 'r1',
        sport: 'running',
        started_at: window.startMs + 1,
        personal_best: true,
      }),
      session({
        id: 'r2',
        sport: 'running',
        started_at: window.startMs + 2,
        personal_best: false,
      }),
      session({
        id: 'r3',
        sport: 'running',
        started_at: window.startMs + 3,
        personal_best: true,
      }),
      session({
        id: 'c1',
        sport: 'cycling',
        started_at: window.startMs + 4,
        personal_best: true,
      }),
    ];

    const summary = summarizeTraining({ window, sessions });
    expect(summary.sportsPracticed).toBe(2);
    const running = summary.bySport.find((b) => b.sport === 'running');
    const cycling = summary.bySport.find((b) => b.sport === 'cycling');
    expect(running?.personalBestCount).toBe(2);
    expect(cycling?.personalBestCount).toBe(1);
  });

  it('sets lastSessionAt to max started_at in window; null when none', () => {
    const emptySummary = summarizeTraining({ window, sessions: [] });
    expect(emptySummary.lastSessionAt).toBeNull();

    const sessions: ParticipationSession[] = [
      session({ id: 'a', sport: 'running', started_at: window.startMs + 100 }),
      session({ id: 'b', sport: 'running', started_at: window.startMs + 500 }),
      session({ id: 'c', sport: 'cycling', started_at: window.startMs + 300 }),
    ];

    const summary = summarizeTraining({ window, sessions });
    expect(summary.lastSessionAt).toBe(window.startMs + 500);
    const running = summary.bySport.find((b) => b.sport === 'running');
    const cycling = summary.bySport.find((b) => b.sport === 'cycling');
    expect(running?.lastSessionAt).toBe(window.startMs + 500);
    expect(cycling?.lastSessionAt).toBe(window.startMs + 300);
  });

  it('lastSessionAt is null when all sessions fall outside window', () => {
    const sessions: ParticipationSession[] = [
      session({ id: 'a', sport: 'running', started_at: window.startMs - 1 }),
      session({ id: 'b', sport: 'running', started_at: window.endMs }),
    ];
    const summary = summarizeTraining({ window, sessions });
    expect(summary.totalSessions).toBe(0);
    expect(summary.lastSessionAt).toBeNull();
  });

  it('is deterministic across calls with the same input', () => {
    const sessions: ParticipationSession[] = [
      session({ id: 'a', sport: 'running', started_at: window.startMs + 1 }),
      session({ id: 'b', sport: 'cycling', started_at: window.startMs + 2 }),
      session({ id: 'c', sport: 'running', started_at: window.startMs + 3 }),
    ];
    const a = summarizeTraining({ window, sessions });
    const b = summarizeTraining({ window, sessions });
    expect(a).toEqual(b);
  });
});
