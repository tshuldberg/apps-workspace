/**
 * Pure analytics engine for the MySports betting journal.
 *
 * No database access. Takes arrays of Bet / BetLeg objects and returns
 * computed statistics. CRUD reads rows, this engine computes, the UI
 * composes both. Keeping the engine pure means it is trivially testable
 * and identically correct on mobile + web.
 *
 * Odds conventions:
 *   * american > 0  -- underdog, payout ratio = odds/100
 *   * american < 0  -- favorite, payout ratio = 100/|odds|
 *   * decimal       -- total return per 1 unit staked (stake + profit),
 *                      so decimal = ratio + 1.
 */

import type { Bet } from '../types';

// ---------------------------------------------------------------------------
// Odds conversions
// ---------------------------------------------------------------------------

/**
 * Convert american odds to decimal.
 *   +150 -> 2.5      (profit ratio 1.5 + stake return 1.0)
 *   -110 -> 1.909... (profit ratio ~0.909 + stake return 1.0)
 *
 * Throws on 0 (not a valid american odds value).
 */
export function americanToDecimal(odds: number): number {
  if (odds === 0) {
    throw new Error('americanToDecimal: odds cannot be 0');
  }
  if (odds > 0) {
    return odds / 100 + 1;
  }
  return 100 / Math.abs(odds) + 1;
}

/**
 * Convert decimal odds back to american. Rounded to the nearest integer
 * since american is stored as an integer. 2.0 -> +100 is the break-even
 * pivot. Anything below 1.0 is invalid.
 */
export function decimalToAmerican(decimal: number): number {
  if (!(decimal > 1)) {
    throw new Error('decimalToAmerican: decimal must be > 1');
  }
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  }
  return Math.round(-100 / (decimal - 1));
}

/**
 * Convert american odds to a compact fractional string (reduced via GCD).
 *   +150 -> "3/2"
 *   -200 -> "1/2"
 *   +100 -> "1/1"
 */
export function americanToFractional(odds: number): string {
  if (odds === 0) {
    throw new Error('americanToFractional: odds cannot be 0');
  }
  let numerator: number;
  let denominator: number;
  if (odds > 0) {
    numerator = odds;
    denominator = 100;
  } else {
    numerator = 100;
    denominator = Math.abs(odds);
  }
  const divisor = gcd(numerator, denominator);
  return `${numerator / divisor}/${denominator / divisor}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Combine decimal odds for a parlay (product). Neutral legs (pushed or
 * voided) should be filtered to 1.0 by the caller before invoking this.
 */
export function combineDecimalOdds(legs: readonly number[]): number {
  return legs.reduce((acc, leg) => acc * leg, 1);
}

// ---------------------------------------------------------------------------
// Bet-level statistics
// ---------------------------------------------------------------------------

export interface BetStats {
  totalBets: number;
  settledBets: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  pending: number;
  totalStakeCents: number;
  totalPayoutCents: number;
  profitLossCents: number;
  /** wins / (wins + losses). Null when the denominator is 0. */
  winRatePct: number | null;
  /** profit / totalStake. Null when totalStake is 0. */
  roiPct: number | null;
  /** Mean odds across all bets (including pending). Null when empty. */
  avgOddsAmerican: number | null;
}

/**
 * Compute summary stats across a set of bets. Stake is accumulated for
 * ALL bets (pending included) -- that is the "money on the table" view.
 * Payout + profit are accumulated only for settled bets.
 */
export function computeBetStats(bets: readonly Bet[]): BetStats {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let voids = 0;
  let pending = 0;
  let totalStakeCents = 0;
  let totalPayoutCents = 0;
  let profitLossCents = 0;
  let oddsSum = 0;

  for (const bet of bets) {
    totalStakeCents += bet.stake_cents;
    oddsSum += bet.odds_american;
    switch (bet.result) {
      case 'won':
        wins += 1;
        totalPayoutCents += bet.potential_payout_cents;
        profitLossCents += bet.profit_loss_cents;
        break;
      case 'lost':
        losses += 1;
        profitLossCents += bet.profit_loss_cents;
        break;
      case 'push':
        pushes += 1;
        // Push returns stake; payout accounting treats this as stake back.
        totalPayoutCents += bet.stake_cents;
        profitLossCents += bet.profit_loss_cents;
        break;
      case 'void':
        voids += 1;
        totalPayoutCents += bet.stake_cents;
        profitLossCents += bet.profit_loss_cents;
        break;
      case 'pending':
      default:
        pending += 1;
        break;
    }
  }

  const settledBets = wins + losses + pushes + voids;
  const totalBets = bets.length;
  const winLossDenom = wins + losses;
  const winRatePct = winLossDenom > 0 ? (wins / winLossDenom) * 100 : null;
  const roiPct =
    totalStakeCents > 0 ? (profitLossCents / totalStakeCents) * 100 : null;
  const avgOddsAmerican = totalBets > 0 ? oddsSum / totalBets : null;

  return {
    totalBets,
    settledBets,
    wins,
    losses,
    pushes,
    voids,
    pending,
    totalStakeCents,
    totalPayoutCents,
    profitLossCents,
    winRatePct,
    roiPct,
    avgOddsAmerican,
  };
}

/**
 * Group bets by an arbitrary key and compute BetStats per group. Used by
 * the analytics dashboard to break out performance by sport, league,
 * bet_type, or sportsbook.
 */
export function groupStatsBy<K>(
  bets: readonly Bet[],
  key: (bet: Bet) => K,
): Map<K, BetStats> {
  const buckets = new Map<K, Bet[]>();
  for (const bet of bets) {
    const k = key(bet);
    const list = buckets.get(k);
    if (list) {
      list.push(bet);
    } else {
      buckets.set(k, [bet]);
    }
  }
  const out = new Map<K, BetStats>();
  for (const [k, list] of buckets) {
    out.set(k, computeBetStats(list));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Streak tracking (chronological over settled bets only)
// ---------------------------------------------------------------------------

export interface StreakSummary {
  current: { type: 'W' | 'L' | null; length: number };
  longestWin: number;
  longestLoss: number;
}

/**
 * Compute win/loss streak information. Orders bets by `settled_at`
 * ascending, ignores pending, push, and void (they break the current
 * streak without counting toward either side).
 */
export function computeStreak(bets: readonly Bet[]): StreakSummary {
  const settled = bets
    .filter((b) => b.settled_at !== null)
    .slice()
    .sort((a, b) => (a.settled_at ?? 0) - (b.settled_at ?? 0));

  let longestWin = 0;
  let longestLoss = 0;
  let runType: 'W' | 'L' | null = null;
  let runLen = 0;

  for (const bet of settled) {
    if (bet.result === 'won') {
      if (runType === 'W') {
        runLen += 1;
      } else {
        runType = 'W';
        runLen = 1;
      }
      if (runLen > longestWin) longestWin = runLen;
    } else if (bet.result === 'lost') {
      if (runType === 'L') {
        runLen += 1;
      } else {
        runType = 'L';
        runLen = 1;
      }
      if (runLen > longestLoss) longestLoss = runLen;
    } else {
      // push/void/pending -- break the run but do not count.
      runType = null;
      runLen = 0;
    }
  }

  return {
    current: { type: runType, length: runLen },
    longestWin,
    longestLoss,
  };
}

// ---------------------------------------------------------------------------
// Units-based P/L
// ---------------------------------------------------------------------------

export interface UnitsPnL {
  wonUnits: number;
  lostUnits: number;
  netUnits: number;
}

/**
 * Scale settled bet profit/loss into bankroll units. `unitSizeCents` of
 * 0 yields zeros (defensive -- caller should have ensured a sensible
 * bankroll unit size). Pending bets are ignored.
 */
export function computeUnitsPnL(
  bets: readonly Bet[],
  unitSizeCents: number,
): UnitsPnL {
  if (unitSizeCents <= 0) {
    return { wonUnits: 0, lostUnits: 0, netUnits: 0 };
  }
  let wonCents = 0;
  let lostCents = 0;
  for (const bet of bets) {
    if (bet.result === 'won') {
      wonCents += bet.profit_loss_cents;
    } else if (bet.result === 'lost') {
      lostCents += Math.abs(bet.profit_loss_cents);
    }
  }
  const wonUnits = wonCents / unitSizeCents;
  const lostUnits = lostCents / unitSizeCents;
  return {
    wonUnits,
    lostUnits,
    netUnits: wonUnits - lostUnits,
  };
}
