import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  createLoyaltyProgram,
  deleteLoyaltyProgram,
  getLoyaltyProgram,
  getTotalMiles,
  getTotalPoints,
  listLoyaltyByType,
  listLoyaltyPrograms,
  updateBalance,
  updateLoyaltyProgram,
} from '../db/crud/loyalty';
import type { LoyaltyProgramInput, LoyaltyType } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

const ALL_TYPES: LoyaltyType[] = ['airline', 'hotel', 'car'];

function makeInput(overrides: Partial<LoyaltyProgramInput> = {}): LoyaltyProgramInput {
  return {
    type: 'airline',
    provider: 'Delta',
    ...overrides,
  };
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('createLoyaltyProgram', () => {
  it('returns a program with a generated id and defaults', () => {
    const p = createLoyaltyProgram(adapter, makeInput());
    expect(p.id).toBeTruthy();
    expect(p.provider).toBe('Delta');
    expect(p.points_balance).toBe(0);
    expect(p.miles_balance).toBe(0);
  });

  it('persists optional fields', () => {
    const p = createLoyaltyProgram(
      adapter,
      makeInput({
        provider: 'Marriott',
        type: 'hotel',
        member_number: 'MB-123',
        status_tier: 'Platinum',
        points_balance: 12500,
        miles_balance: 0,
        expiry_date: '2027-06-30',
        notes: 'Elite night credits',
      }),
    );
    expect(p.provider).toBe('Marriott');
    expect(p.type).toBe('hotel');
    expect(p.member_number).toBe('MB-123');
    expect(p.status_tier).toBe('Platinum');
    expect(p.points_balance).toBe(12500);
    expect(p.expiry_date).toBe('2027-06-30');
    expect(p.notes).toBe('Elite night credits');
  });

  it('creates all three loyalty types', () => {
    for (const type of ALL_TYPES) {
      const p = createLoyaltyProgram(
        adapter,
        makeInput({ type, provider: `${type} provider` }),
      );
      expect(p.type).toBe(type);
      const reread = getLoyaltyProgram(adapter, p.id);
      expect(reread?.type).toBe(type);
    }
  });

  it('rejects empty provider', () => {
    expect(() => createLoyaltyProgram(adapter, makeInput({ provider: '' }))).toThrow();
  });
});

describe('getLoyaltyProgram', () => {
  it('returns null for missing id', () => {
    expect(getLoyaltyProgram(adapter, 'nope')).toBeNull();
  });
});

describe('updateLoyaltyProgram', () => {
  it('updates specified fields only', () => {
    const p = createLoyaltyProgram(adapter, makeInput({ provider: 'Delta' }));
    updateLoyaltyProgram(adapter, p.id, { status_tier: 'Diamond' });
    const got = getLoyaltyProgram(adapter, p.id);
    expect(got?.status_tier).toBe('Diamond');
    expect(got?.provider).toBe('Delta');
  });

  it('no-ops with empty patch', () => {
    const p = createLoyaltyProgram(adapter, makeInput());
    const before = getLoyaltyProgram(adapter, p.id)!;
    updateLoyaltyProgram(adapter, p.id, {});
    const after = getLoyaltyProgram(adapter, p.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });
});

describe('deleteLoyaltyProgram', () => {
  it('removes a program', () => {
    const p = createLoyaltyProgram(adapter, makeInput());
    deleteLoyaltyProgram(adapter, p.id);
    expect(getLoyaltyProgram(adapter, p.id)).toBeNull();
  });
});

describe('listLoyaltyPrograms / listLoyaltyByType', () => {
  beforeEach(() => {
    createLoyaltyProgram(adapter, makeInput({ type: 'airline', provider: 'United' }));
    createLoyaltyProgram(adapter, makeInput({ type: 'airline', provider: 'Delta' }));
    createLoyaltyProgram(adapter, makeInput({ type: 'hotel', provider: 'Hyatt' }));
    createLoyaltyProgram(adapter, makeInput({ type: 'car', provider: 'Hertz' }));
  });

  it('returns programs ordered by provider', () => {
    const items = listLoyaltyPrograms(adapter);
    expect(items.map((x) => x.provider)).toEqual(['Delta', 'Hertz', 'Hyatt', 'United']);
  });

  it('filters by type', () => {
    const airlines = listLoyaltyPrograms(adapter, { type: 'airline' });
    expect(airlines.map((x) => x.provider)).toEqual(['Delta', 'United']);
  });

  it('listLoyaltyByType returns same results', () => {
    expect(listLoyaltyByType(adapter, 'hotel').map((x) => x.provider)).toEqual(['Hyatt']);
    expect(listLoyaltyByType(adapter, 'car').map((x) => x.provider)).toEqual(['Hertz']);
  });
});

describe('getTotalPoints / getTotalMiles', () => {
  beforeEach(() => {
    createLoyaltyProgram(
      adapter,
      makeInput({ type: 'airline', provider: 'United', miles_balance: 50000 }),
    );
    createLoyaltyProgram(
      adapter,
      makeInput({ type: 'airline', provider: 'Delta', miles_balance: 30000 }),
    );
    createLoyaltyProgram(
      adapter,
      makeInput({ type: 'hotel', provider: 'Hyatt', points_balance: 75000 }),
    );
    createLoyaltyProgram(
      adapter,
      makeInput({ type: 'hotel', provider: 'Marriott', points_balance: 120000 }),
    );
    createLoyaltyProgram(
      adapter,
      makeInput({ type: 'car', provider: 'Hertz', points_balance: 2000 }),
    );
  });

  it('sums all points across all programs', () => {
    expect(getTotalPoints(adapter)).toBe(197000);
  });

  it('filters points by type', () => {
    expect(getTotalPoints(adapter, 'hotel')).toBe(195000);
    expect(getTotalPoints(adapter, 'car')).toBe(2000);
    expect(getTotalPoints(adapter, 'airline')).toBe(0);
  });

  it('sums all miles across programs', () => {
    expect(getTotalMiles(adapter)).toBe(80000);
  });

  it('filters miles by airline', () => {
    expect(getTotalMiles(adapter, 'airline')).toBe(80000);
  });

  it('returns 0 on empty database', () => {
    const empty = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    expect(getTotalPoints(empty.adapter)).toBe(0);
    expect(getTotalMiles(empty.adapter)).toBe(0);
    empty.close();
  });
});

describe('updateBalance', () => {
  it('updates points only', () => {
    const p = createLoyaltyProgram(adapter, makeInput({ type: 'hotel', provider: 'Hyatt' }));
    updateBalance(adapter, p.id, { points: 1000 });
    const got = getLoyaltyProgram(adapter, p.id);
    expect(got?.points_balance).toBe(1000);
    expect(got?.miles_balance).toBe(0);
  });

  it('updates miles only', () => {
    const p = createLoyaltyProgram(adapter, makeInput({ type: 'airline', provider: 'UA' }));
    updateBalance(adapter, p.id, { miles: 5000 });
    const got = getLoyaltyProgram(adapter, p.id);
    expect(got?.miles_balance).toBe(5000);
    expect(got?.points_balance).toBe(0);
  });

  it('updates both', () => {
    const p = createLoyaltyProgram(adapter, makeInput());
    updateBalance(adapter, p.id, { points: 100, miles: 200 });
    const got = getLoyaltyProgram(adapter, p.id);
    expect(got?.points_balance).toBe(100);
    expect(got?.miles_balance).toBe(200);
  });

  it('no-ops with empty update', () => {
    const p = createLoyaltyProgram(adapter, makeInput());
    const before = getLoyaltyProgram(adapter, p.id)!;
    updateBalance(adapter, p.id, {});
    const after = getLoyaltyProgram(adapter, p.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });
});
