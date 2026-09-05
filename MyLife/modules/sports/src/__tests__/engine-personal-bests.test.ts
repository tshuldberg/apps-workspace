import { describe, expect, it } from 'vitest';
import {
  METRICS_BY_SPORT,
  detectPersonalBest,
  type StatMetric,
} from '../engine/personal-bests';
import type { ParticipationSession } from '../types';

function makeSession(
  sport: string,
  stats: Record<string, number>,
  id = 'ps_x',
  started_at = 0,
): ParticipationSession {
  return {
    id,
    sport,
    activity: 'pickup',
    started_at,
    duration_minutes: null,
    location: null,
    teammates: [],
    stats,
    personal_best: false,
    mood_before: null,
    mood_after: null,
    injury_notes: null,
    notes_md: null,
    photo_ids: [],
    created_at: started_at,
  };
}

describe('detectPersonalBest', () => {
  it('first session with any recorded metric counts as PB (previousBest null, improved true)', () => {
    const session = makeSession('basketball', { points: 12 });
    const result = detectPersonalBest(
      session,
      [],
      METRICS_BY_SPORT.basketball ?? [],
    );
    expect(result.isPB).toBe(true);
    const points = result.breakdowns.find((b) => b.metric === 'points');
    expect(points?.previousBest).toBeNull();
    expect(points?.newBest).toBe(12);
    expect(points?.improved).toBe(true);
  });

  it('first session with no recorded metrics returns isPB=false', () => {
    const session = makeSession('basketball', {});
    const result = detectPersonalBest(
      session,
      [],
      METRICS_BY_SPORT.basketball ?? [],
    );
    expect(result.isPB).toBe(false);
    expect(result.breakdowns).toEqual([]);
  });

  it('higherIsBetter metric -- strict improvement flips isPB to true', () => {
    const prior = [makeSession('basketball', { points: 20 }, 'p1', 1)];
    const newSession = makeSession('basketball', { points: 22 }, 'p2', 2);
    const result = detectPersonalBest(
      newSession,
      prior,
      METRICS_BY_SPORT.basketball ?? [],
    );
    expect(result.isPB).toBe(true);
    expect(
      result.breakdowns.find((b) => b.metric === 'points')?.previousBest,
    ).toBe(20);
  });

  it('tie does NOT count as a PB (strict inequality)', () => {
    const prior = [makeSession('basketball', { points: 20 }, 'p1', 1)];
    const newSession = makeSession('basketball', { points: 20 }, 'p2', 2);
    const result = detectPersonalBest(
      newSession,
      prior,
      METRICS_BY_SPORT.basketball ?? [],
    );
    expect(result.isPB).toBe(false);
  });

  it('lowerIsBetter metric -- golf score improvement flips isPB', () => {
    const prior = [makeSession('golf', { score: 92 }, 'p1', 1)];
    const improved = makeSession('golf', { score: 88 }, 'p2', 2);
    const regressed = makeSession('golf', { score: 95 }, 'p3', 3);
    expect(
      detectPersonalBest(improved, prior, METRICS_BY_SPORT.golf ?? []).isPB,
    ).toBe(true);
    expect(
      detectPersonalBest(regressed, prior, METRICS_BY_SPORT.golf ?? []).isPB,
    ).toBe(false);
  });

  it('multi-metric sessions collapse to single isPB via OR semantics', () => {
    const prior = [
      makeSession(
        'basketball',
        { points: 20, rebounds: 8, assists: 5 },
        'p1',
        1,
      ),
    ];
    // Beats rebounds, matches points, down on assists -> still PB.
    const newSession = makeSession(
      'basketball',
      { points: 20, rebounds: 10, assists: 4 },
      'p2',
      2,
    );
    const result = detectPersonalBest(
      newSession,
      prior,
      METRICS_BY_SPORT.basketball ?? [],
    );
    expect(result.isPB).toBe(true);
    const rebounds = result.breakdowns.find((b) => b.metric === 'rebounds');
    expect(rebounds?.improved).toBe(true);
    const points = result.breakdowns.find((b) => b.metric === 'points');
    expect(points?.improved).toBe(false);
    const assists = result.breakdowns.find((b) => b.metric === 'assists');
    expect(assists?.improved).toBe(false);
  });

  it('unknown sport with empty metric list returns isPB=false', () => {
    const session = makeSession('underwater-chess', { moves: 42 });
    const result = detectPersonalBest(session, [], []);
    expect(result.isPB).toBe(false);
    expect(result.breakdowns).toEqual([]);
  });

  it('missing metric in session is silently skipped', () => {
    const prior = [makeSession('basketball', { points: 20 }, 'p1', 1)];
    // Only records rebounds.
    const newSession = makeSession('basketball', { rebounds: 5 }, 'p2', 2);
    const result = detectPersonalBest(
      newSession,
      prior,
      METRICS_BY_SPORT.basketball ?? [],
    );
    expect(result.breakdowns.map((b) => b.metric)).toEqual(['rebounds']);
    expect(result.isPB).toBe(true);
  });

  it('computes best across multiple prior sessions, not just latest', () => {
    const prior = [
      makeSession('basketball', { points: 30 }, 'p1', 1),
      makeSession('basketball', { points: 18 }, 'p2', 2),
      makeSession('basketball', { points: 25 }, 'p3', 3),
    ];
    const newSession = makeSession('basketball', { points: 28 }, 'p4', 4);
    const result = detectPersonalBest(
      newSession,
      prior,
      METRICS_BY_SPORT.basketball ?? [],
    );
    const points = result.breakdowns.find((b) => b.metric === 'points');
    expect(points?.previousBest).toBe(30);
    expect(result.isPB).toBe(false); // 28 < 30
  });

  it('tennis mixes higher/lower -- double_faults down is a PB', () => {
    const prior = [
      makeSession('tennis', { aces: 5, double_faults: 6 }, 'p1', 1),
    ];
    // Fewer DFs -> PB even though aces stayed same.
    const newSession = makeSession(
      'tennis',
      { aces: 5, double_faults: 2 },
      'p2',
      2,
    );
    const result = detectPersonalBest(
      newSession,
      prior,
      METRICS_BY_SPORT.tennis ?? [],
    );
    const df = result.breakdowns.find((b) => b.metric === 'double_faults');
    expect(df?.improved).toBe(true);
    expect(result.isPB).toBe(true);
  });

  it('METRICS_BY_SPORT catalog includes expected sports with minimum metric counts', () => {
    expect(METRICS_BY_SPORT.basketball?.length).toBeGreaterThanOrEqual(5);
    expect(METRICS_BY_SPORT.soccer?.length).toBeGreaterThanOrEqual(3);
    expect(METRICS_BY_SPORT.tennis?.length).toBeGreaterThanOrEqual(2);
    expect(METRICS_BY_SPORT.golf?.length).toBeGreaterThanOrEqual(4);
    expect(METRICS_BY_SPORT.running?.length).toBeGreaterThanOrEqual(3);
    expect(METRICS_BY_SPORT.volleyball?.length).toBeGreaterThanOrEqual(4);

    // Spot-check direction flags.
    const golfScore = METRICS_BY_SPORT.golf?.find((m) => m.name === 'score');
    expect(golfScore?.higherIsBetter).toBe(false);
    const hoopsPoints = METRICS_BY_SPORT.basketball?.find(
      (m) => m.name === 'points',
    );
    expect(hoopsPoints?.higherIsBetter).toBe(true);
  });

  it('ignores non-finite / non-number values in stats gracefully', () => {
    const prior: ParticipationSession[] = [];
    const metrics: StatMetric[] = [{ name: 'points', higherIsBetter: true }];
    const session = makeSession('any', { points: Number.NaN });
    const result = detectPersonalBest(session, prior, metrics);
    expect(result.breakdowns).toEqual([]);
    expect(result.isPB).toBe(false);
  });
});
