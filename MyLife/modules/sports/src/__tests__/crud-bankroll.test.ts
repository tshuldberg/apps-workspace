import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  ensureDefaultBankroll,
  getBankroll,
  updateBankroll,
} from '../db/crud';

describe('sports bankroll CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('ensureDefaultBankroll seeds one row and is idempotent', () => {
    const first = ensureDefaultBankroll(db.adapter, 50_000, 1_000);
    expect(first.name).toBe('default');
    expect(first.starting_cents).toBe(50_000);
    expect(first.current_cents).toBe(50_000);
    expect(first.unit_size_cents).toBe(1_000);

    const second = ensureDefaultBankroll(db.adapter, 99_999, 9_999);
    expect(second.id).toBe(first.id);
    // Seed values DO NOT overwrite the existing row.
    expect(second.starting_cents).toBe(50_000);
    expect(second.unit_size_cents).toBe(1_000);

    const rows = db.adapter.query<{ c: number }>(
      'SELECT COUNT(*) as c FROM sp_bankroll',
    );
    expect(rows[0]?.c).toBe(1);
  });

  it('updateBankroll applies partial patch and bumps updated_at', async () => {
    const initial = ensureDefaultBankroll(db.adapter, 50_000, 1_000);
    await new Promise((r) => setTimeout(r, 2));
    const patched = updateBankroll(db.adapter, 'default', {
      current_cents: 45_000,
      unit_size_cents: 500,
    });
    expect(patched.current_cents).toBe(45_000);
    expect(patched.unit_size_cents).toBe(500);
    expect(patched.starting_cents).toBe(50_000);
    expect(patched.updated_at).toBeGreaterThanOrEqual(initial.updated_at);
  });

  it('name is UNIQUE -- inserting a second profile with the same name fails', () => {
    ensureDefaultBankroll(db.adapter, 0, 1_000);
    expect(() =>
      db.adapter.execute(
        `INSERT INTO sp_bankroll (
          id, name, starting_cents, current_cents, unit_size_cents, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['bk_dup', 'default', 0, 0, 1_000, 1, 1],
      ),
    ).toThrow();
  });

  it('getBankroll(unknown) returns null and updateBankroll(unknown) throws', () => {
    expect(getBankroll(db.adapter, 'nope')).toBeNull();
    expect(() =>
      updateBankroll(db.adapter, 'nope', { current_cents: 1 }),
    ).toThrowError(/not found/);
  });
});
