import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  getBetLimits,
  setBetLimits,
  sumStakesSince,
  insertBet,
} from '../db/crud';

describe('sports bet-limit settings (sp_settings k/v)', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('getBetLimits returns sane defaults on an empty store', () => {
    const limits = getBetLimits(db.adapter);
    expect(limits).toEqual({
      daily_cents: null,
      weekly_cents: null,
      cooldown_until: null,
      unit_size_cents: 1000,
    });
  });

  it('setBetLimits upserts daily + weekly + cooldown independently', () => {
    setBetLimits(db.adapter, {
      daily_cents: 10_000,
      weekly_cents: 50_000,
      cooldown_until: 1_700_000_000_000,
    });
    const limits = getBetLimits(db.adapter);
    expect(limits.daily_cents).toBe(10_000);
    expect(limits.weekly_cents).toBe(50_000);
    expect(limits.cooldown_until).toBe(1_700_000_000_000);
    // Unit size untouched -- default still reported.
    expect(limits.unit_size_cents).toBe(1000);
  });

  it('setBetLimits with null clears the row (idempotent)', () => {
    setBetLimits(db.adapter, { daily_cents: 10_000, weekly_cents: 25_000 });
    expect(getBetLimits(db.adapter).daily_cents).toBe(10_000);

    setBetLimits(db.adapter, { daily_cents: null });
    const after = getBetLimits(db.adapter);
    expect(after.daily_cents).toBeNull();
    // Weekly untouched.
    expect(after.weekly_cents).toBe(25_000);

    // Clearing again is a no-op.
    setBetLimits(db.adapter, { daily_cents: null });
    expect(getBetLimits(db.adapter).daily_cents).toBeNull();
  });

  it('setBetLimits clamps unit_size_cents to [1, 1_000_000]', () => {
    setBetLimits(db.adapter, { unit_size_cents: 500 });
    expect(getBetLimits(db.adapter).unit_size_cents).toBe(500);

    // Over-cap: $20,000 in cents (2_000_000) should clamp to 1_000_000.
    setBetLimits(db.adapter, { unit_size_cents: 2_000_000 });
    expect(getBetLimits(db.adapter).unit_size_cents).toBe(1_000_000);

    // Zero / negative clamps up to 1.
    setBetLimits(db.adapter, { unit_size_cents: 0 });
    expect(getBetLimits(db.adapter).unit_size_cents).toBe(1);
    setBetLimits(db.adapter, { unit_size_cents: -50 });
    expect(getBetLimits(db.adapter).unit_size_cents).toBe(1);
  });

  it('setBetLimits treats undefined as no-op (patch semantics)', () => {
    setBetLimits(db.adapter, { daily_cents: 42 });
    // Pass a non-null-non-undefined for weekly, omit daily entirely.
    setBetLimits(db.adapter, { weekly_cents: 99 });
    const limits = getBetLimits(db.adapter);
    expect(limits.daily_cents).toBe(42);
    expect(limits.weekly_cents).toBe(99);
  });

  it('sumStakesSince returns 0 on empty sp_bets', () => {
    expect(sumStakesSince(db.adapter, 0)).toBe(0);
    expect(sumStakesSince(db.adapter, Date.now())).toBe(0);
  });

  it('sumStakesSince sums stakes on/after the boundary and excludes older bets', () => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;

    insertBet(db.adapter, {
      sport: 'football',
      league: 'nfl',
      bet_type: 'moneyline',
      description: 'Old bet',
      sportsbook: 'fanduel',
      odds_american: -110,
      stake_cents: 1_000,
      units: 1,
      placed_at: now - 10 * hour,
    });
    insertBet(db.adapter, {
      sport: 'football',
      league: 'nfl',
      bet_type: 'spread',
      description: 'Recent bet A',
      sportsbook: 'draftkings',
      odds_american: -110,
      stake_cents: 2_500,
      units: 2.5,
      placed_at: now - 2 * hour,
    });
    insertBet(db.adapter, {
      sport: 'basketball',
      league: 'nba',
      bet_type: 'total',
      description: 'Recent bet B (boundary)',
      sportsbook: 'betmgm',
      odds_american: +120,
      stake_cents: 3_000,
      units: 3,
      placed_at: now - 6 * hour,
    });

    // 8h window should include the 2h and 6h bets (5500) but exclude the 10h.
    const since = now - 8 * hour;
    expect(sumStakesSince(db.adapter, since)).toBe(5_500);

    // Tight 1h window: only future bets count.
    expect(sumStakesSince(db.adapter, now - hour)).toBe(0);

    // Inclusive boundary: placed_at === since must be counted.
    insertBet(db.adapter, {
      sport: 'football',
      league: 'nfl',
      bet_type: 'prop',
      description: 'Exact boundary bet',
      sportsbook: 'caesars',
      odds_american: -105,
      stake_cents: 500,
      units: 0.5,
      placed_at: since,
    });
    expect(sumStakesSince(db.adapter, since)).toBe(6_000);
  });
});
