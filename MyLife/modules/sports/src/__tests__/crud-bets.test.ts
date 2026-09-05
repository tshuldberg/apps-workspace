import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  deleteBet,
  getBet,
  insertBet,
  listBetLegs,
  listBets,
  settleBet,
  settleBetLeg,
  updateBetNotes,
  type BetInsertInput,
  type BetLegInsertInput,
} from '../db/crud';

function baseBet(overrides: Partial<BetInsertInput> = {}): BetInsertInput {
  return {
    sport: 'football',
    league: 'nfl',
    game_id: 'espn:nfl:g1',
    team_id: 'espn:nfl:6',
    bet_type: 'moneyline',
    description: 'Cowboys ML',
    sportsbook: 'FanDuel',
    odds_american: 150,
    stake_cents: 10_000,
    units: 1,
    placed_at: Date.parse('2026-04-20T00:00:00.000Z'),
    ...overrides,
  };
}

describe('sports bets CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('insertBet creates a single bet with computed payout', () => {
    const bet = insertBet(db.adapter, baseBet());
    expect(bet.id).toBeTruthy();
    expect(bet.bet_type).toBe('moneyline');
    expect(bet.result).toBe('pending');
    expect(bet.profit_loss_cents).toBe(0);
    // +150 on 10000c -> 10000 * 2.5 = 25000
    expect(bet.potential_payout_cents).toBe(25_000);

    const fetched = getBet(db.adapter, bet.id);
    expect(fetched?.id).toBe(bet.id);
  });

  it('insertBet parlay requires at least 2 legs', () => {
    expect(() =>
      insertBet(db.adapter, baseBet({ bet_type: 'parlay' }), []),
    ).toThrowError(/at least 2 legs/);
  });

  it('insertBet parlay computes combined payout from legs', () => {
    const legs: BetLegInsertInput[] = [
      {
        description: 'Cowboys ML',
        odds_american: 100,
        leg_type: 'moneyline',
      },
      {
        description: 'Chiefs ML',
        odds_american: 200,
        leg_type: 'moneyline',
      },
    ];
    const bet = insertBet(
      db.adapter,
      baseBet({ bet_type: 'parlay', odds_american: 500, stake_cents: 10_000 }),
      legs,
    );
    // leg decimals: 2.0 * 3.0 = 6.0 combined -> payout = 60000
    expect(bet.potential_payout_cents).toBe(60_000);
    const stored = listBetLegs(db.adapter, bet.id);
    expect(stored).toHaveLength(2);
    expect(stored.map((l) => l.leg_index)).toEqual([0, 1]);
    expect(stored[0].description).toBe('Cowboys ML');
  });

  it('deleteBet cascades legs via FK', () => {
    const bet = insertBet(
      db.adapter,
      baseBet({ bet_type: 'parlay' }),
      [
        { description: 'A', odds_american: 100, leg_type: 'moneyline' },
        { description: 'B', odds_american: 100, leg_type: 'spread' },
      ],
    );
    expect(listBetLegs(db.adapter, bet.id)).toHaveLength(2);
    deleteBet(db.adapter, bet.id);
    expect(getBet(db.adapter, bet.id)).toBeNull();
    expect(listBetLegs(db.adapter, bet.id)).toHaveLength(0);
  });

  it('settleBet (won) computes profit as payout - stake', () => {
    const bet = insertBet(db.adapter, baseBet());
    const settled = settleBet(db.adapter, bet.id, 'won');
    expect(settled.result).toBe('won');
    // +150 on $100 stake -> $150 profit
    expect(settled.profit_loss_cents).toBe(15_000);
    expect(settled.settled_at).not.toBeNull();
  });

  it('settleBet (lost) records -stake profit', () => {
    const bet = insertBet(db.adapter, baseBet());
    const settled = settleBet(db.adapter, bet.id, 'lost');
    expect(settled.profit_loss_cents).toBe(-10_000);
  });

  it('settleBet (push / void) records zero profit', () => {
    const bet = insertBet(db.adapter, baseBet());
    const pushed = settleBet(db.adapter, bet.id, 'push');
    expect(pushed.profit_loss_cents).toBe(0);

    const bet2 = insertBet(db.adapter, baseBet());
    const voided = settleBet(db.adapter, bet2.id, 'void');
    expect(voided.profit_loss_cents).toBe(0);
  });

  it('settleBet refuses parlays -- caller must use settleBetLeg', () => {
    const bet = insertBet(
      db.adapter,
      baseBet({ bet_type: 'parlay' }),
      [
        { description: 'A', odds_american: 100, leg_type: 'moneyline' },
        { description: 'B', odds_american: 100, leg_type: 'spread' },
      ],
    );
    expect(() => settleBet(db.adapter, bet.id, 'won')).toThrowError(
      /settleBetLeg/,
    );
  });

  it('settleBetLeg rolls up parent result when all legs settle (all won)', () => {
    const bet = insertBet(
      db.adapter,
      baseBet({ bet_type: 'parlay', stake_cents: 10_000 }),
      [
        { description: 'A', odds_american: 100, leg_type: 'moneyline' },
        { description: 'B', odds_american: 200, leg_type: 'moneyline' },
      ],
    );
    const legs = listBetLegs(db.adapter, bet.id);
    settleBetLeg(db.adapter, legs[0].id, 'won');
    let parent = getBet(db.adapter, bet.id);
    expect(parent?.result).toBe('pending'); // not all legs settled
    settleBetLeg(db.adapter, legs[1].id, 'won');
    parent = getBet(db.adapter, bet.id);
    expect(parent?.result).toBe('won');
    // 2.0 * 3.0 = 6.0 combined -> payout 60000, profit 50000
    expect(parent?.profit_loss_cents).toBe(50_000);
  });

  it('settleBetLeg -- any leg lost yields parent lost', () => {
    const bet = insertBet(
      db.adapter,
      baseBet({ bet_type: 'parlay' }),
      [
        { description: 'A', odds_american: 100, leg_type: 'moneyline' },
        { description: 'B', odds_american: 100, leg_type: 'moneyline' },
      ],
    );
    const legs = listBetLegs(db.adapter, bet.id);
    settleBetLeg(db.adapter, legs[0].id, 'won');
    settleBetLeg(db.adapter, legs[1].id, 'lost');
    const parent = getBet(db.adapter, bet.id);
    expect(parent?.result).toBe('lost');
    expect(parent?.profit_loss_cents).toBe(-parent!.stake_cents);
  });

  it('settleBetLeg -- push leg drops from combined odds', () => {
    const bet = insertBet(
      db.adapter,
      baseBet({ bet_type: 'parlay', stake_cents: 10_000 }),
      [
        { description: 'A', odds_american: 100, leg_type: 'moneyline' },
        { description: 'B', odds_american: 200, leg_type: 'moneyline' },
      ],
    );
    const legs = listBetLegs(db.adapter, bet.id);
    // B pushes -> payout reverts to just A (+100 -> decimal 2.0)
    settleBetLeg(db.adapter, legs[1].id, 'push');
    settleBetLeg(db.adapter, legs[0].id, 'won');
    const parent = getBet(db.adapter, bet.id);
    expect(parent?.result).toBe('won');
    // payout recomputed: 10000 * 2.0 = 20000, profit 10000
    expect(parent?.potential_payout_cents).toBe(20_000);
    expect(parent?.profit_loss_cents).toBe(10_000);
  });

  it('listBets filters by sport, league, bet_type, sportsbook, result, date range', () => {
    insertBet(
      db.adapter,
      baseBet({
        sport: 'football',
        league: 'nfl',
        bet_type: 'moneyline',
        sportsbook: 'FanDuel',
        placed_at: 1_700_000_000_000,
      }),
    );
    insertBet(
      db.adapter,
      baseBet({
        sport: 'basketball',
        league: 'nba',
        bet_type: 'spread',
        sportsbook: 'DraftKings',
        placed_at: 1_700_100_000_000,
      }),
    );
    insertBet(
      db.adapter,
      baseBet({
        sport: 'football',
        league: 'nfl',
        bet_type: 'total',
        sportsbook: 'FanDuel',
        placed_at: 1_700_200_000_000,
      }),
    );
    expect(listBets(db.adapter, { sport: 'football' })).toHaveLength(2);
    expect(listBets(db.adapter, { league: 'nba' })).toHaveLength(1);
    expect(listBets(db.adapter, { bet_type: 'total' })).toHaveLength(1);
    expect(listBets(db.adapter, { sportsbook: 'FanDuel' })).toHaveLength(2);
    expect(listBets(db.adapter, { result: 'pending' })).toHaveLength(3);
    const mid = listBets(db.adapter, {
      placedSince: 1_700_050_000_000,
      placedUntil: 1_700_150_000_000,
    });
    expect(mid).toHaveLength(1);
    expect(mid[0].sport).toBe('basketball');
  });

  it('listBets supports limit + offset pagination ordered DESC', () => {
    const base = 1_700_000_000_000;
    for (let i = 0; i < 5; i++) {
      insertBet(
        db.adapter,
        baseBet({ placed_at: base + i * 1000, description: `bet-${i}` }),
      );
    }
    const page1 = listBets(db.adapter, { limit: 2, offset: 0 });
    const page2 = listBets(db.adapter, { limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].description).toBe('bet-4');
    expect(page1[1].description).toBe('bet-3');
    expect(page2[0].description).toBe('bet-2');
    expect(page2[1].description).toBe('bet-1');
  });

  it('updateBetNotes overwrites notes_md only', () => {
    const bet = insertBet(db.adapter, baseBet());
    updateBetNotes(db.adapter, bet.id, '**locked in**');
    const refreshed = getBet(db.adapter, bet.id);
    expect(refreshed?.notes_md).toBe('**locked in**');
    updateBetNotes(db.adapter, bet.id, null);
    const cleared = getBet(db.adapter, bet.id);
    expect(cleared?.notes_md).toBeNull();
  });
});
