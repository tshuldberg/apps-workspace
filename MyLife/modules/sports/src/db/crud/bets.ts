import type { DatabaseAdapter } from '@mylife/db';
import type {
  Bet,
  BetLeg,
  BetLegType,
  BetResult,
  BetType,
} from '../../types';
import {
  americanToDecimal,
  combineDecimalOdds,
} from '../../engine/bet-analytics';

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface BetRow {
  id: string;
  sport: string;
  league: string;
  game_id: string | null;
  team_id: string | null;
  bet_type: BetType;
  description: string;
  sportsbook: string;
  odds_american: number;
  stake_cents: number;
  potential_payout_cents: number;
  units: number;
  result: BetResult;
  profit_loss_cents: number;
  placed_at: number;
  settled_at: number | null;
  notes_md: string | null;
  created_at: number;
  updated_at: number;
}

interface BetLegRow {
  id: string;
  bet_id: string;
  leg_index: number;
  game_id: string | null;
  team_id: string | null;
  description: string;
  odds_american: number;
  leg_type: BetLegType;
  result: BetResult;
  settled_at: number | null;
  created_at: number;
}

function rowToBet(row: BetRow): Bet {
  return {
    id: row.id,
    sport: row.sport,
    league: row.league,
    game_id: row.game_id ?? null,
    team_id: row.team_id ?? null,
    bet_type: row.bet_type,
    description: row.description,
    sportsbook: row.sportsbook,
    odds_american: row.odds_american,
    stake_cents: row.stake_cents,
    potential_payout_cents: row.potential_payout_cents,
    units: row.units,
    result: row.result,
    profit_loss_cents: row.profit_loss_cents,
    placed_at: row.placed_at,
    settled_at: row.settled_at ?? null,
    notes_md: row.notes_md ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToBetLeg(row: BetLegRow): BetLeg {
  return {
    id: row.id,
    bet_id: row.bet_id,
    leg_index: row.leg_index,
    game_id: row.game_id ?? null,
    team_id: row.team_id ?? null,
    description: row.description,
    odds_american: row.odds_american,
    leg_type: row.leg_type,
    result: row.result,
    settled_at: row.settled_at ?? null,
    created_at: row.created_at,
  };
}

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Insert inputs
// ---------------------------------------------------------------------------

export interface BetInsertInput {
  id?: string;
  sport: string;
  league: string;
  game_id?: string | null;
  team_id?: string | null;
  bet_type: BetType;
  description: string;
  sportsbook: string;
  odds_american: number;
  stake_cents: number;
  /** Optional override. When absent, computed from odds + stake (+ legs for parlays). */
  potential_payout_cents?: number;
  units: number;
  placed_at?: number;
  notes_md?: string | null;
}

export interface BetLegInsertInput {
  id?: string;
  game_id?: string | null;
  team_id?: string | null;
  description: string;
  odds_american: number;
  leg_type: BetLegType;
}

// ---------------------------------------------------------------------------
// Payout helpers
// ---------------------------------------------------------------------------

/**
 * Compute potential payout (in cents) from stake + american odds. Includes
 * return of stake (i.e. payout = stake * decimal odds).
 */
function computePayoutCents(
  stakeCents: number,
  oddsAmerican: number,
): number {
  const decimal = americanToDecimal(oddsAmerican);
  return Math.round(stakeCents * decimal);
}

/**
 * Compute potential payout for a parlay from stake + leg decimal odds.
 * Combined decimal = product of leg decimals.
 */
function computeParlayPayoutCents(
  stakeCents: number,
  legOdds: readonly number[],
): number {
  const decimals = legOdds.map(americanToDecimal);
  const combined = combineDecimalOdds(decimals);
  return Math.round(stakeCents * combined);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a single bet or parlay. Wrapped in a transaction so the parent
 * + legs either all land or none do. For `bet_type === 'parlay'`, at
 * least two legs are required and the potential payout is computed
 * from the product of leg decimal odds. For singles, legs are ignored
 * and payout is computed from the bet's own odds.
 *
 * Returns the freshly-inserted Bet row.
 */
export function insertBet(
  db: DatabaseAdapter,
  input: BetInsertInput,
  legs: readonly BetLegInsertInput[] = [],
): Bet {
  if (input.bet_type === 'parlay') {
    if (legs.length < 2) {
      throw new Error('insertBet: parlay requires at least 2 legs');
    }
  }

  const ts = now();
  const placed = input.placed_at ?? ts;
  const id = input.id ?? makeId('bet');

  const payoutCents =
    input.potential_payout_cents ??
    (input.bet_type === 'parlay'
      ? computeParlayPayoutCents(
          input.stake_cents,
          legs.map((l) => l.odds_american),
        )
      : computePayoutCents(input.stake_cents, input.odds_american));

  const betRow: Bet = {
    id,
    sport: input.sport,
    league: input.league,
    game_id: input.game_id ?? null,
    team_id: input.team_id ?? null,
    bet_type: input.bet_type,
    description: input.description,
    sportsbook: input.sportsbook,
    odds_american: input.odds_american,
    stake_cents: input.stake_cents,
    potential_payout_cents: payoutCents,
    units: input.units,
    result: 'pending',
    profit_loss_cents: 0,
    placed_at: placed,
    settled_at: null,
    notes_md: input.notes_md ?? null,
    created_at: ts,
    updated_at: ts,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO sp_bets (
        id, sport, league, game_id, team_id, bet_type, description,
        sportsbook, odds_american, stake_cents, potential_payout_cents,
        units, result, profit_loss_cents, placed_at, settled_at, notes_md,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        betRow.id,
        betRow.sport,
        betRow.league,
        betRow.game_id,
        betRow.team_id,
        betRow.bet_type,
        betRow.description,
        betRow.sportsbook,
        betRow.odds_american,
        betRow.stake_cents,
        betRow.potential_payout_cents,
        betRow.units,
        betRow.result,
        betRow.profit_loss_cents,
        betRow.placed_at,
        betRow.settled_at,
        betRow.notes_md,
        betRow.created_at,
        betRow.updated_at,
      ],
    );

    if (input.bet_type === 'parlay') {
      legs.forEach((leg, idx) => {
        db.execute(
          `INSERT INTO sp_bet_legs (
            id, bet_id, leg_index, game_id, team_id, description,
            odds_american, leg_type, result, settled_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            leg.id ?? makeId('leg'),
            id,
            idx,
            leg.game_id ?? null,
            leg.team_id ?? null,
            leg.description,
            leg.odds_american,
            leg.leg_type,
            'pending',
            null,
            ts,
          ],
        );
      });
    }
  });

  return betRow;
}

/** Narrow update: only overwrite the markdown notes field. */
export function updateBetNotes(
  db: DatabaseAdapter,
  id: string,
  notes_md: string | null,
): void {
  db.execute(
    'UPDATE sp_bets SET notes_md = ?, updated_at = ? WHERE id = ?',
    [notes_md, now(), id],
  );
}

/**
 * Settle a single (non-parlay) bet. For parlays, settle each leg
 * individually via `settleBetLeg`; the parent result is then recomputed
 * from the leg results.
 *
 * Profit/loss convention:
 *   * won  -> potential_payout - stake
 *   * lost -> -stake
 *   * push -> 0
 *   * void -> 0
 */
export function settleBet(
  db: DatabaseAdapter,
  id: string,
  result: BetResult,
  settled_at: number = now(),
): Bet {
  const existing = getBet(db, id);
  if (!existing) {
    throw new Error(`settleBet: bet '${id}' not found`);
  }
  if (existing.bet_type === 'parlay') {
    throw new Error(
      'settleBet: use settleBetLeg for parlays; the parent is recomputed from legs',
    );
  }
  const profit = computeProfitLossCents(existing, result);
  const ts = now();
  db.execute(
    `UPDATE sp_bets
       SET result = ?, settled_at = ?, profit_loss_cents = ?, updated_at = ?
     WHERE id = ?`,
    [result, settled_at, profit, ts, id],
  );
  return getBet(db, id) as Bet;
}

/**
 * Settle one leg of a parlay. After the update, if ALL legs are settled
 * (non-pending) the parent bet is also settled:
 *   * any leg lost -> parent lost
 *   * mix of won + push/void only -> parent won at push-adjusted odds
 *   * all push/void -> parent push
 *
 * Void legs drop from the combined-odds product (treated as 1.0).
 * Push legs are likewise treated as 1.0.
 */
export function settleBetLeg(
  db: DatabaseAdapter,
  leg_id: string,
  result: BetResult,
  settled_at: number = now(),
): BetLeg {
  const rows = db.query<BetLegRow>(
    'SELECT * FROM sp_bet_legs WHERE id = ?',
    [leg_id],
  );
  if (rows.length === 0) {
    throw new Error(`settleBetLeg: leg '${leg_id}' not found`);
  }
  const leg = rowToBetLeg(rows[0]);
  db.execute(
    'UPDATE sp_bet_legs SET result = ?, settled_at = ? WHERE id = ?',
    [result, settled_at, leg_id],
  );

  // Recompute parent bet state if all legs are no-longer-pending.
  const siblings = listBetLegs(db, leg.bet_id).map((l) =>
    l.id === leg_id ? { ...l, result, settled_at } : l,
  );
  const anyPending = siblings.some((l) => l.result === 'pending');
  if (!anyPending) {
    const parent = getBet(db, leg.bet_id);
    if (parent) {
      const parentResult = rollupParentResult(siblings);
      const recomputedStake = parent.stake_cents;
      const recomputedPayout = computeParlayAdjustedPayoutCents(
        recomputedStake,
        siblings,
      );
      const profit = computeProfitLossFromParts(
        recomputedStake,
        recomputedPayout,
        parentResult,
      );
      const ts = now();
      db.execute(
        `UPDATE sp_bets
           SET result = ?, settled_at = ?, profit_loss_cents = ?,
               potential_payout_cents = ?, updated_at = ?
         WHERE id = ?`,
        [parentResult, settled_at, profit, recomputedPayout, ts, leg.bet_id],
      );
    }
  }

  const refreshed = db.query<BetLegRow>(
    'SELECT * FROM sp_bet_legs WHERE id = ?',
    [leg_id],
  );
  return rowToBetLeg(refreshed[0]);
}

/**
 * Delete a bet. Legs are removed by the FK cascade on sp_bet_legs.bet_id.
 */
export function deleteBet(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sp_bets WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Result roll-up helpers
// ---------------------------------------------------------------------------

function rollupParentResult(legs: readonly BetLeg[]): BetResult {
  if (legs.some((l) => l.result === 'lost')) return 'lost';
  const liveLegs = legs.filter(
    (l) => l.result !== 'push' && l.result !== 'void',
  );
  if (liveLegs.length === 0) return 'push';
  if (liveLegs.every((l) => l.result === 'won')) return 'won';
  return 'lost';
}

function computeParlayAdjustedPayoutCents(
  stakeCents: number,
  legs: readonly BetLeg[],
): number {
  const liveDecimals = legs
    .filter((l) => l.result !== 'push' && l.result !== 'void')
    .map((l) => americanToDecimal(l.odds_american));
  if (liveDecimals.length === 0) {
    // All pushes/voids -- stake returned.
    return stakeCents;
  }
  const combined = combineDecimalOdds(liveDecimals);
  return Math.round(stakeCents * combined);
}

function computeProfitLossCents(bet: Bet, result: BetResult): number {
  switch (result) {
    case 'won':
      return bet.potential_payout_cents - bet.stake_cents;
    case 'lost':
      return -bet.stake_cents;
    case 'push':
    case 'void':
    case 'pending':
    default:
      return 0;
  }
}

function computeProfitLossFromParts(
  stakeCents: number,
  payoutCents: number,
  result: BetResult,
): number {
  switch (result) {
    case 'won':
      return payoutCents - stakeCents;
    case 'lost':
      return -stakeCents;
    case 'push':
    case 'void':
    case 'pending':
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getBet(db: DatabaseAdapter, id: string): Bet | null {
  const rows = db.query<BetRow>('SELECT * FROM sp_bets WHERE id = ?', [id]);
  return rows.length > 0 ? rowToBet(rows[0]) : null;
}

export function listBetLegs(db: DatabaseAdapter, bet_id: string): BetLeg[] {
  return db
    .query<BetLegRow>(
      'SELECT * FROM sp_bet_legs WHERE bet_id = ? ORDER BY leg_index ASC',
      [bet_id],
    )
    .map(rowToBetLeg);
}

export interface ListBetsFilters {
  sport?: string;
  league?: string;
  bet_type?: BetType;
  sportsbook?: string;
  result?: BetResult;
  placedSince?: number;
  placedUntil?: number;
  limit?: number;
  offset?: number;
}

/**
 * List bets with optional filters. Ordered by `placed_at` DESC so the
 * most recent activity surfaces first. Default limit is 100 rows.
 */
export function listBets(
  db: DatabaseAdapter,
  filters: ListBetsFilters = {},
): Bet[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.sport !== undefined) {
    where.push('sport = ?');
    params.push(filters.sport);
  }
  if (filters.league !== undefined) {
    where.push('league = ?');
    params.push(filters.league);
  }
  if (filters.bet_type !== undefined) {
    where.push('bet_type = ?');
    params.push(filters.bet_type);
  }
  if (filters.sportsbook !== undefined) {
    where.push('sportsbook = ?');
    params.push(filters.sportsbook);
  }
  if (filters.result !== undefined) {
    where.push('result = ?');
    params.push(filters.result);
  }
  if (filters.placedSince !== undefined) {
    where.push('placed_at >= ?');
    params.push(filters.placedSince);
  }
  if (filters.placedUntil !== undefined) {
    where.push('placed_at <= ?');
    params.push(filters.placedUntil);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  return db
    .query<BetRow>(
      `SELECT * FROM sp_bets
       ${whereClause}
       ORDER BY placed_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )
    .map(rowToBet);
}
