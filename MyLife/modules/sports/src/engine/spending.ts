/**
 * Pure sports spending aggregator (P8-A data layer).
 *
 * Takes already-loaded domain rows (bets, attendance, fantasy transactions,
 * memorabilia) and a half-open `[startMs, endMs)` window, and returns a
 * numeric spending summary. No DB access, no `Date.now()`, no persistence,
 * no Budget-module coupling. A follow-up card wires Budget consumption.
 *
 * Mirrors the pure-engine precedent set by
 * `generateYearInReview(input)` in year-in-review.ts and
 * `computeBetStats(bets)` in bet-analytics.ts.
 *
 * Live-type deviations (vs. the card spec):
 *   1. Bet settlement semantics -- the live `Bet` schema has no
 *      `payout_cents` column. We reconstruct "returned" per result using
 *      the same settlement rules as `computeBetStats`:
 *        won   -> potential_payout_cents   (stake + profit)
 *        push  -> stake_cents              (stake back)
 *        void  -> stake_cents              (stake back)
 *        lost  -> 0
 *        pending -> not counted in returned (still counted in wagered)
 *   2. `Attendance.cost_cents` is a non-nullable non-negative integer on
 *      the live Zod schema, so the "include if cost_cents is not null"
 *      filter from the spec is a no-op in practice. All in-window rows
 *      are included.
 *   3. `FantasyTransaction` on the live schema carries NO monetary fields
 *      (no amount, no amount_cents, no buy_in). Its `type` enum is
 *      `draft | trade | waiver_add | waiver_drop | fa_add`. There is no
 *      way to classify buy-ins vs prizes from a transaction alone -- that
 *      money lives on `FantasyLeague.{buy_in_cents, prize_cents}`. Since
 *      the card's input contract is `fantasyTransactions: FantasyTransaction[]`
 *      (no leagues), `fantasy.buyInsCents`, `fantasy.prizesCents`, and
 *      `fantasy.netCents` are always 0 from this engine. A follow-up card
 *      can extend the input to accept `FantasyLeague[]` for monetary totals.
 *   4. `Memorabilia.purchase_price_cents` is non-nullable non-negative on
 *      the live Zod schema, so the "include if purchase_price_cents is not
 *      null" filter reduces to "include if acquired_at is set and in
 *      window". `acquired_at` IS nullable so rows with no acquisition date
 *      are always excluded from a windowed aggregate.
 */

import type { Attendance, Bet, FantasyTransaction, Memorabilia } from '../types';

// ---------------------------------------------------------------------------
// Window + input/output shape
// ---------------------------------------------------------------------------

/**
 * Half-open time window `[startMs, endMs)`. A row at `startMs` is included;
 * a row at `endMs` is excluded.
 */
export interface SportsSpendingWindow {
  startMs: number;
  endMs: number;
}

/**
 * Already-fetched rows the aggregator operates on. All arrays are readonly
 * so the engine cannot mutate caller-owned data.
 */
export interface SportsSpendingInput {
  window: SportsSpendingWindow;
  bets: readonly Bet[];
  attendance: readonly Attendance[];
  fantasyTransactions: readonly FantasyTransaction[];
  memorabilia: readonly Memorabilia[];
}

/**
 * Aggregated spending summary. All money values are cents. Counts are
 * non-negative integers. `totalNetCents` is a convenience roll-up:
 *
 *   totalNetCents = betting.netCents + fantasy.netCents
 *                   - tickets.totalCents - memorabilia.purchasedCents
 *
 * Positive = money made (net), negative = money out.
 */
export interface SportsSpendingSummary {
  window: SportsSpendingWindow;
  betting: {
    wageredCents: number;
    returnedCents: number;
    netCents: number;
    settledBets: number;
    pendingBets: number;
  };
  tickets: {
    totalCents: number;
    eventsAttended: number;
  };
  fantasy: {
    buyInsCents: number;
    prizesCents: number;
    netCents: number;
  };
  memorabilia: {
    purchasedCents: number;
    itemCount: number;
  };
  totalNetCents: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function inWindow(ts: number, window: SportsSpendingWindow): boolean {
  return ts >= window.startMs && ts < window.endMs;
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

/**
 * Compute a sports-spending summary for a window. Deterministic: same inputs
 * produce the same output. No network, no clock reads, no mutation of input
 * arrays.
 */
export function aggregateSportsSpending(
  input: SportsSpendingInput,
): SportsSpendingSummary {
  const { window } = input;

  // ─ Betting ───────────────────────────────────────────────────────────
  const betsInWindow = input.bets.filter((b) => inWindow(b.placed_at, window));
  let wageredCents = 0;
  let returnedCents = 0;
  let settledBets = 0;
  let pendingBets = 0;
  for (const bet of betsInWindow) {
    wageredCents += bet.stake_cents;
    switch (bet.result) {
      case 'won':
        returnedCents += bet.potential_payout_cents;
        settledBets += 1;
        break;
      case 'push':
        returnedCents += bet.stake_cents;
        settledBets += 1;
        break;
      case 'void':
        returnedCents += bet.stake_cents;
        settledBets += 1;
        break;
      case 'lost':
        // returned = 0
        settledBets += 1;
        break;
      case 'pending':
      default:
        pendingBets += 1;
        break;
    }
  }
  const bettingNetCents = returnedCents - wageredCents;

  // ─ Tickets (attendance) ──────────────────────────────────────────────
  // Live `Attendance.cost_cents` is non-nullable; include every row whose
  // `attended_at` falls inside the window. See header deviation note 2.
  const attendedInWindow = input.attendance.filter((a) =>
    inWindow(a.attended_at, window),
  );
  const ticketsTotalCents = attendedInWindow.reduce(
    (sum, a) => sum + a.cost_cents,
    0,
  );
  const eventsAttended = attendedInWindow.length;

  // ─ Fantasy ───────────────────────────────────────────────────────────
  // Live `FantasyTransaction` has no monetary fields; we echo the filtered
  // count via the engine's contract but cannot derive buy-ins vs prizes
  // without FantasyLeague rows. Reported as 0/0/0 for this card. See
  // header deviation note 3.
  // We still reference the filter so callers passing irrelevant rows don't
  // accidentally skew any future side calculation.
  void input.fantasyTransactions.filter((t) =>
    inWindow(t.happened_at, window),
  );
  const fantasyBuyInsCents = 0;
  const fantasyPrizesCents = 0;
  const fantasyNetCents = fantasyPrizesCents - fantasyBuyInsCents;

  // ─ Memorabilia ───────────────────────────────────────────────────────
  // Exclude rows without a known acquisition date; `purchase_price_cents`
  // is always present on the live schema. See header deviation note 4.
  const memorabiliaInWindow = input.memorabilia.filter(
    (m) => m.acquired_at !== null && inWindow(m.acquired_at, window),
  );
  const memorabiliaPurchasedCents = memorabiliaInWindow.reduce(
    (sum, m) => sum + m.purchase_price_cents,
    0,
  );
  const memorabiliaItemCount = memorabiliaInWindow.length;

  // ─ Totals ────────────────────────────────────────────────────────────
  const totalNetCents =
    bettingNetCents +
    fantasyNetCents -
    ticketsTotalCents -
    memorabiliaPurchasedCents;

  return {
    window,
    betting: {
      wageredCents,
      returnedCents,
      netCents: bettingNetCents,
      settledBets,
      pendingBets,
    },
    tickets: {
      totalCents: ticketsTotalCents,
      eventsAttended,
    },
    fantasy: {
      buyInsCents: fantasyBuyInsCents,
      prizesCents: fantasyPrizesCents,
      netCents: fantasyNetCents,
    },
    memorabilia: {
      purchasedCents: memorabiliaPurchasedCents,
      itemCount: memorabiliaItemCount,
    },
    totalNetCents,
  };
}
