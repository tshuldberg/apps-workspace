import { describe, expect, it } from 'vitest';
import {
  aggregateSportsSpending,
  type SportsSpendingInput,
  type SportsSpendingWindow,
} from '../engine/spending';
import type {
  Attendance,
  Bet,
  FantasyTransaction,
  Memorabilia,
} from '../types';

// ─ Factories ──────────────────────────────────────────────────────────

function bet(overrides: Partial<Bet> & Pick<Bet, 'id' | 'placed_at'>): Bet {
  const base: Bet = {
    id: overrides.id,
    sport: 'football',
    league: 'nfl',
    game_id: null,
    team_id: null,
    bet_type: 'moneyline',
    description: 'test',
    sportsbook: 'draftkings',
    odds_american: -110,
    stake_cents: 10_000,
    potential_payout_cents: 19_090,
    units: 1,
    result: 'pending',
    profit_loss_cents: 0,
    placed_at: overrides.placed_at,
    settled_at: null,
    notes_md: null,
    created_at: overrides.placed_at,
    updated_at: overrides.placed_at,
  };
  return { ...base, ...overrides };
}

function attendance(
  overrides: Partial<Attendance> & Pick<Attendance, 'id' | 'attended_at'>,
): Attendance {
  const base: Attendance = {
    id: overrides.id,
    game_id: null,
    venue_id: null,
    venue_name: 'MetLife Stadium',
    section: null,
    row_label: null,
    seat: null,
    companions: [],
    cost_cents: 5_000,
    tailgate_notes_md: null,
    parking_notes_md: null,
    rating: null,
    notes_md: null,
    photo_ids: [],
    attended_at: overrides.attended_at,
    created_at: overrides.attended_at,
    updated_at: overrides.attended_at,
  };
  return { ...base, ...overrides };
}

function fantasyTx(
  overrides: Partial<FantasyTransaction> &
    Pick<FantasyTransaction, 'id' | 'happened_at' | 'league_id'>,
): FantasyTransaction {
  const base: FantasyTransaction = {
    id: overrides.id,
    league_id: overrides.league_id,
    type: 'waiver_add',
    players_in: [],
    players_out: [],
    description: 'waiver',
    reasoning_md: null,
    happened_at: overrides.happened_at,
    created_at: overrides.happened_at,
  };
  return { ...base, ...overrides };
}

function memorabilia(
  overrides: Partial<Memorabilia> & Pick<Memorabilia, 'id'>,
): Memorabilia {
  const base: Memorabilia = {
    id: overrides.id,
    item_type: 'card',
    description: 'rookie card',
    sport: null,
    team: null,
    player: null,
    acquired_at: null,
    purchase_price_cents: 0,
    estimated_value_cents: 0,
    photo_ids: [],
    notes_md: null,
    created_at: 0,
    updated_at: 0,
  };
  return { ...base, ...overrides };
}

// Standard fixture window: calendar year 2026 UTC.
const WINDOW_2026: SportsSpendingWindow = {
  startMs: Date.UTC(2026, 0, 1, 0, 0, 0, 0),
  endMs: Date.UTC(2027, 0, 1, 0, 0, 0, 0),
};

function emptyInput(
  window: SportsSpendingWindow = WINDOW_2026,
): SportsSpendingInput {
  return {
    window,
    bets: [],
    attendance: [],
    fantasyTransactions: [],
    memorabilia: [],
  };
}

describe('aggregateSportsSpending', () => {
  it('returns a fully zeroed summary for empty input and echoes the window', () => {
    const result = aggregateSportsSpending(emptyInput());
    expect(result.window).toEqual(WINDOW_2026);
    expect(result.betting).toEqual({
      wageredCents: 0,
      returnedCents: 0,
      netCents: 0,
      settledBets: 0,
      pendingBets: 0,
    });
    expect(result.tickets).toEqual({ totalCents: 0, eventsAttended: 0 });
    expect(result.fantasy).toEqual({
      buyInsCents: 0,
      prizesCents: 0,
      netCents: 0,
    });
    expect(result.memorabilia).toEqual({ purchasedCents: 0, itemCount: 0 });
    expect(result.totalNetCents).toBe(0);
  });

  it('applies half-open [startMs, endMs) filtering to bets by placed_at', () => {
    // placed_at === startMs is INCLUDED; placed_at === endMs is EXCLUDED.
    const boundaryIn = bet({
      id: 'b-in',
      placed_at: WINDOW_2026.startMs,
      result: 'won',
      stake_cents: 1_000,
      potential_payout_cents: 2_000,
      profit_loss_cents: 1_000,
    });
    const boundaryOut = bet({
      id: 'b-out',
      placed_at: WINDOW_2026.endMs,
      result: 'won',
      stake_cents: 5_000,
      potential_payout_cents: 9_000,
      profit_loss_cents: 4_000,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      bets: [boundaryIn, boundaryOut],
    });
    expect(result.betting.wageredCents).toBe(1_000);
    expect(result.betting.returnedCents).toBe(2_000);
    expect(result.betting.netCents).toBe(1_000);
    expect(result.betting.settledBets).toBe(1);
    expect(result.betting.pendingBets).toBe(0);
  });

  it('counts pending bets in wagered + pendingBets but not in returned/net', () => {
    const pending = bet({
      id: 'p1',
      placed_at: WINDOW_2026.startMs + 10,
      result: 'pending',
      stake_cents: 2_500,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      bets: [pending],
    });
    expect(result.betting.wageredCents).toBe(2_500);
    expect(result.betting.returnedCents).toBe(0);
    expect(result.betting.netCents).toBe(-2_500);
    expect(result.betting.settledBets).toBe(0);
    expect(result.betting.pendingBets).toBe(1);
  });

  it('computes won/lost settlement semantics: won net = payout - stake, lost net = -stake', () => {
    const won = bet({
      id: 'w',
      placed_at: WINDOW_2026.startMs + 1,
      result: 'won',
      stake_cents: 10_000,
      potential_payout_cents: 19_090,
      profit_loss_cents: 9_090,
    });
    const lost = bet({
      id: 'l',
      placed_at: WINDOW_2026.startMs + 2,
      result: 'lost',
      stake_cents: 7_500,
      potential_payout_cents: 15_000,
      profit_loss_cents: -7_500,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      bets: [won, lost],
    });
    expect(result.betting.wageredCents).toBe(17_500);
    expect(result.betting.returnedCents).toBe(19_090);
    expect(result.betting.netCents).toBe(1_590);
    expect(result.betting.settledBets).toBe(2);
    expect(result.betting.pendingBets).toBe(0);
  });

  it('treats push and void as stake returned (contribution to net is 0)', () => {
    const push = bet({
      id: 'ph',
      placed_at: WINDOW_2026.startMs + 1,
      result: 'push',
      stake_cents: 4_000,
      potential_payout_cents: 7_600,
      profit_loss_cents: 0,
    });
    const voided = bet({
      id: 'vd',
      placed_at: WINDOW_2026.startMs + 2,
      result: 'void',
      stake_cents: 6_000,
      potential_payout_cents: 11_400,
      profit_loss_cents: 0,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      bets: [push, voided],
    });
    expect(result.betting.wageredCents).toBe(10_000);
    expect(result.betting.returnedCents).toBe(10_000);
    expect(result.betting.netCents).toBe(0);
    expect(result.betting.settledBets).toBe(2);
  });

  it('sums attendance cost_cents for in-window rows and counts events', () => {
    const a1 = attendance({
      id: 'a1',
      attended_at: WINDOW_2026.startMs + 1_000,
      cost_cents: 12_000,
    });
    const a2 = attendance({
      id: 'a2',
      attended_at: WINDOW_2026.startMs + 2_000,
      cost_cents: 8_500,
    });
    const outside = attendance({
      id: 'a3',
      attended_at: WINDOW_2026.endMs + 1,
      cost_cents: 99_999,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      attendance: [a1, a2, outside],
    });
    expect(result.tickets.totalCents).toBe(20_500);
    expect(result.tickets.eventsAttended).toBe(2);
  });

  it('honors the live Attendance.cost_cents non-nullable schema (cost_cents=0 still included)', () => {
    // Deviation note 2 from spending.ts header: the spec's "cost_cents is
    // not null" filter is a no-op because the Zod schema makes it a
    // required non-negative integer. A row with cost_cents=0 is still
    // included in the event count.
    const freebie = attendance({
      id: 'free',
      attended_at: WINDOW_2026.startMs + 5_000,
      cost_cents: 0,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      attendance: [freebie],
    });
    expect(result.tickets.eventsAttended).toBe(1);
    expect(result.tickets.totalCents).toBe(0);
  });

  it('reports zero fantasy money because live FantasyTransaction has no monetary fields', () => {
    // Deviation note 3 from spending.ts header.
    const tx1 = fantasyTx({
      id: 'tx1',
      league_id: 'L1',
      happened_at: WINDOW_2026.startMs + 100,
      type: 'draft',
    });
    const tx2 = fantasyTx({
      id: 'tx2',
      league_id: 'L1',
      happened_at: WINDOW_2026.startMs + 200,
      type: 'trade',
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      fantasyTransactions: [tx1, tx2],
    });
    expect(result.fantasy).toEqual({
      buyInsCents: 0,
      prizesCents: 0,
      netCents: 0,
    });
  });

  it('excludes memorabilia with null acquired_at; sums purchase_price_cents for in-window rows', () => {
    const noDate = memorabilia({
      id: 'm-null',
      acquired_at: null,
      purchase_price_cents: 99_999,
    });
    const inRange = memorabilia({
      id: 'm-in',
      acquired_at: WINDOW_2026.startMs + 1,
      purchase_price_cents: 25_000,
    });
    const outOfRange = memorabilia({
      id: 'm-out',
      acquired_at: WINDOW_2026.endMs,
      purchase_price_cents: 50_000,
    });
    const zeroPrice = memorabilia({
      id: 'm-zero',
      acquired_at: WINDOW_2026.startMs + 2,
      purchase_price_cents: 0,
    });
    const result = aggregateSportsSpending({
      ...emptyInput(),
      memorabilia: [noDate, inRange, outOfRange, zeroPrice],
    });
    expect(result.memorabilia.itemCount).toBe(2);
    expect(result.memorabilia.purchasedCents).toBe(25_000);
  });

  it('computes totalNetCents = betting.net + fantasy.net - tickets.total - memorabilia.purchased', () => {
    const won = bet({
      id: 'w',
      placed_at: WINDOW_2026.startMs + 1,
      result: 'won',
      stake_cents: 10_000,
      potential_payout_cents: 20_000,
      profit_loss_cents: 10_000,
    }); // betting.net = +10_000
    const ticket = attendance({
      id: 't1',
      attended_at: WINDOW_2026.startMs + 2,
      cost_cents: 3_000,
    });
    const collectible = memorabilia({
      id: 'mm',
      acquired_at: WINDOW_2026.startMs + 3,
      purchase_price_cents: 4_000,
    });
    const result = aggregateSportsSpending({
      window: WINDOW_2026,
      bets: [won],
      attendance: [ticket],
      fantasyTransactions: [],
      memorabilia: [collectible],
    });
    // fantasy.net is always 0 in this engine.
    expect(result.totalNetCents).toBe(10_000 + 0 - 3_000 - 4_000);
    expect(result.totalNetCents).toBe(3_000);
  });

  it('is deterministic and does not mutate input arrays', () => {
    const b = bet({
      id: 'b',
      placed_at: WINDOW_2026.startMs + 1,
      result: 'won',
      potential_payout_cents: 11_000,
    });
    const a = attendance({
      id: 'a',
      attended_at: WINDOW_2026.startMs + 2,
      cost_cents: 1_500,
    });
    const m = memorabilia({
      id: 'm',
      acquired_at: WINDOW_2026.startMs + 3,
      purchase_price_cents: 2_500,
    });
    const bets = [b];
    const att = [a];
    const mem = [m];
    const snapshotBets = JSON.stringify(bets);
    const snapshotAtt = JSON.stringify(att);
    const snapshotMem = JSON.stringify(mem);
    const first = aggregateSportsSpending({
      window: WINDOW_2026,
      bets,
      attendance: att,
      fantasyTransactions: [],
      memorabilia: mem,
    });
    const second = aggregateSportsSpending({
      window: WINDOW_2026,
      bets,
      attendance: att,
      fantasyTransactions: [],
      memorabilia: mem,
    });
    expect(second).toEqual(first);
    expect(JSON.stringify(bets)).toBe(snapshotBets);
    expect(JSON.stringify(att)).toBe(snapshotAtt);
    expect(JSON.stringify(mem)).toBe(snapshotMem);
  });
});
