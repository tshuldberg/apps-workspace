import type { Game } from '../types';

/**
 * Mood-sports correlation engine -- pure, input-is-output.
 *
 * Callers hand in an already-loaded array of games plus a daily mood series
 * keyed by UTC `YYYY-MM-DD`. The engine aligns same-day mood entries with
 * each game's outcome against a given `teamId` and returns numeric
 * aggregates suitable for a stats dashboard. No SQL, no `Date.now()`, no
 * I/O, no Mood module imports.
 *
 * Live-type deviation: the P8-B card spec references row-level Game fields
 * (`home_team_id`, `away_team_id`, `home_score`, `away_score`, `start_at`).
 * The canonical `Game` shape in `types.ts` nests teams under `home` / `away`
 * with `id` + `score`, and uses camelCase `startAt`. Per the agent's live-
 * type rule, this engine consumes the canonical shape.
 */

/** One user-supplied mood sample keyed by UTC date. */
export interface DailyMoodEntry {
  /** UTC calendar date as `YYYY-MM-DD`. */
  dateKey: string;
  /** Finite number; scale is caller-defined. */
  moodScore: number;
}

export interface MoodCorrelationInput {
  teamId: string;
  games: readonly Game[];
  moodByDate: readonly DailyMoodEntry[];
}

export type PerGameOutcome = 'W' | 'L' | 'T' | 'pending';

export interface PerGameMoodRow {
  gameId: string;
  dateKey: string;
  outcome: PerGameOutcome;
  moodScore: number | null;
}

export interface MoodCorrelationSummary {
  teamId: string;
  /** Games with a non-pending outcome AND a same-day mood entry. */
  sampleSize: number;
  winDayAvg: number | null;
  lossDayAvg: number | null;
  tieDayAvg: number | null;
  /**
   * Average mood on mood-entry dates that do NOT coincide with any of this
   * team's final games.
   */
  nonGameDayAvg: number | null;
  /** `winDayAvg - lossDayAvg`, null if either side is null. */
  deltaWinVsLoss: number | null;
  /**
   * One row per game matching this team (including pending), sorted ascending
   * by `startAt`. `moodScore` is null when no entry exists for the day.
   */
  perGame: ReadonlyArray<PerGameMoodRow>;
}

/** UTC `YYYY-MM-DD` derivation from epoch ms. */
function dateKeyFromEpoch(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 2-decimal rounding matching prediction-accuracy. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return round2(sum / values.length);
}

function deriveOutcome(game: Game, teamId: string): PerGameOutcome | null {
  const homeId = game.home.id ?? null;
  const awayId = game.away.id ?? null;
  const isHome = homeId === teamId;
  const isAway = awayId === teamId;
  if (!isHome && !isAway) return null;

  if (game.status !== 'final') return 'pending';

  const homeScore = game.home.score ?? null;
  const awayScore = game.away.score ?? null;
  if (homeScore === null || awayScore === null) return 'pending';

  if (homeScore === awayScore) return 'T';
  if (isHome) return homeScore > awayScore ? 'W' : 'L';
  // isAway
  return awayScore > homeScore ? 'W' : 'L';
}

export function computeMoodCorrelation(
  input: MoodCorrelationInput,
): MoodCorrelationSummary {
  const { teamId, games, moodByDate } = input;

  // Index moods by dateKey; last entry wins on duplicate dates.
  const moodMap = new Map<string, number>();
  for (const entry of moodByDate) {
    moodMap.set(entry.dateKey, entry.moodScore);
  }

  // Filter + build perGame rows; skip games not involving teamId.
  type Row = PerGameMoodRow & { startAt: number };
  const rows: Row[] = [];
  const finalGameDates = new Set<string>();

  for (const game of games) {
    const outcome = deriveOutcome(game, teamId);
    if (outcome === null) continue;

    const dateKey = dateKeyFromEpoch(game.startAt);
    const moodForDay = moodMap.has(dateKey)
      ? (moodMap.get(dateKey) as number)
      : null;

    rows.push({
      gameId: game.id,
      dateKey,
      outcome,
      moodScore: moodForDay,
      startAt: game.startAt,
    });

    if (outcome !== 'pending') finalGameDates.add(dateKey);
  }

  rows.sort((a, b) => a.startAt - b.startAt);

  // Aggregate wins/losses/ties using only rows with a same-day mood entry.
  const winMoods: number[] = [];
  const lossMoods: number[] = [];
  const tieMoods: number[] = [];
  for (const row of rows) {
    if (row.outcome === 'pending') continue;
    if (row.moodScore === null) continue;
    if (row.outcome === 'W') winMoods.push(row.moodScore);
    else if (row.outcome === 'L') lossMoods.push(row.moodScore);
    else tieMoods.push(row.moodScore);
  }

  const sampleSize = winMoods.length + lossMoods.length + tieMoods.length;

  const winDayAvg = average(winMoods);
  const lossDayAvg = average(lossMoods);
  const tieDayAvg = average(tieMoods);

  const nonGameDayMoods: number[] = [];
  for (const entry of moodByDate) {
    if (!finalGameDates.has(entry.dateKey)) {
      nonGameDayMoods.push(entry.moodScore);
    }
  }
  const nonGameDayAvg = average(nonGameDayMoods);

  const deltaWinVsLoss =
    winDayAvg === null || lossDayAvg === null
      ? null
      : round2(winDayAvg - lossDayAvg);

  const perGame: PerGameMoodRow[] = rows.map(
    ({ gameId, dateKey, outcome, moodScore }) => ({
      gameId,
      dateKey,
      outcome,
      moodScore,
    }),
  );

  return {
    teamId,
    sampleSize,
    winDayAvg,
    lossDayAvg,
    tieDayAvg,
    nonGameDayAvg,
    deltaWinVsLoss,
    perGame,
  };
}
