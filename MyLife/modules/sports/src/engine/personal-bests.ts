import type { ParticipationSession } from '../types';

/**
 * Personal-bests engine.
 *
 * Pure TypeScript -- zero DB access, zero React imports. The CRUD layer
 * composes this with a read helper that feeds in the user's prior
 * sessions for the same sport.
 *
 * Design decisions:
 *   1. "First session in a sport" returns `isPB: true` whenever the new
 *      session has any recorded metric. Rationale: from the user's POV
 *      the first logged session is by definition the best they've done
 *      (nothing to compare against), so celebrating it is the honest
 *      call. The alternative (return false until there's a prior) feels
 *      punishing to new users who just logged their first round of golf.
 *      Sessions with no recorded stats return `isPB: false` regardless
 *      of history -- there's nothing to be best at.
 *   2. Multi-metric sessions collapse to a single `isPB` boolean via
 *      logical OR: if the session improved on ANY tracked metric for
 *      that sport, `isPB: true`. The `breakdowns` array surfaces the
 *      full per-metric picture for UI (e.g. "new PB in points, matched
 *      rebounds, down on assists").
 *   3. Metrics not present in the session or not in `metricsForSport`
 *      are silently skipped. Unknown sports (no METRICS_BY_SPORT entry)
 *      graceful-degrade to `isPB: false`.
 */

/** Describes one stat metric tracked for a sport. */
export type StatMetric = {
  name: string;
  /** `true` if a higher value is better (points, distance). `false` if lower is better (golf score, pace). */
  higherIsBetter: boolean;
};

/**
 * Per-metric PB breakdown:
 *   * `previousBest` is null when this is the first session with the metric recorded.
 *   * `improved` is true iff the new value strictly beats the prior best
 *     (strict inequality -- a tie is not an improvement).
 *   * For first-time metrics with no prior data, `improved` is true.
 */
export type DetectPersonalBestResult = {
  isPB: boolean;
  breakdowns: {
    metric: string;
    previousBest: number | null;
    newBest: number;
    improved: boolean;
  }[];
};

/**
 * Preset metric catalog for the launch set of personal sports. Values
 * follow the convention of the stats_json column: lowercase snake_case
 * keys. Unknown sports return isPB: false gracefully.
 */
export const METRICS_BY_SPORT: Readonly<Record<string, readonly StatMetric[]>> =
  Object.freeze({
    basketball: Object.freeze([
      { name: 'points', higherIsBetter: true },
      { name: 'rebounds', higherIsBetter: true },
      { name: 'assists', higherIsBetter: true },
      { name: 'steals', higherIsBetter: true },
      { name: 'blocks', higherIsBetter: true },
    ]),
    soccer: Object.freeze([
      { name: 'goals', higherIsBetter: true },
      { name: 'assists', higherIsBetter: true },
      { name: 'saves', higherIsBetter: true },
    ]),
    tennis: Object.freeze([
      { name: 'aces', higherIsBetter: true },
      { name: 'double_faults', higherIsBetter: false },
    ]),
    golf: Object.freeze([
      { name: 'score', higherIsBetter: false },
      { name: 'putts', higherIsBetter: false },
      { name: 'fairways_hit', higherIsBetter: true },
      { name: 'gir', higherIsBetter: true },
    ]),
    running: Object.freeze([
      { name: 'distance_meters', higherIsBetter: true },
      { name: 'duration_seconds', higherIsBetter: false },
      { name: 'pace_seconds_per_km', higherIsBetter: false },
    ]),
    volleyball: Object.freeze([
      { name: 'kills', higherIsBetter: true },
      { name: 'digs', higherIsBetter: true },
      { name: 'aces', higherIsBetter: true },
      { name: 'blocks', higherIsBetter: true },
    ]),
  });

/**
 * Best value seen for a metric across a collection of sessions. Returns
 * null when no session recorded that metric (i.e. no prior data).
 */
function bestValue(
  sessions: readonly ParticipationSession[],
  metric: StatMetric,
): number | null {
  let best: number | null = null;
  for (const session of sessions) {
    const raw = session.stats[metric.name];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    if (best === null) {
      best = raw;
      continue;
    }
    if (metric.higherIsBetter) {
      if (raw > best) best = raw;
    } else {
      if (raw < best) best = raw;
    }
  }
  return best;
}

/**
 * Decide whether `session` is a personal best given `priorSessions` and
 * the sport's metric catalog. Pure -- same inputs always produce same
 * output.
 *
 * The caller is responsible for ensuring `priorSessions` only contains
 * sessions for the SAME sport (otherwise PBs would leak across sports).
 */
export function detectPersonalBest(
  session: ParticipationSession,
  priorSessions: readonly ParticipationSession[],
  metricsForSport: readonly StatMetric[],
): DetectPersonalBestResult {
  const breakdowns: DetectPersonalBestResult['breakdowns'] = [];

  for (const metric of metricsForSport) {
    const raw = session.stats[metric.name];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const previousBest = bestValue(priorSessions, metric);
    let improved: boolean;
    if (previousBest === null) {
      // First time recording this metric -- counts as a PB.
      improved = true;
    } else if (metric.higherIsBetter) {
      improved = raw > previousBest;
    } else {
      improved = raw < previousBest;
    }
    breakdowns.push({
      metric: metric.name,
      previousBest,
      newBest: raw,
      improved,
    });
  }

  const isPB = breakdowns.some((b) => b.improved);
  return { isPB, breakdowns };
}
