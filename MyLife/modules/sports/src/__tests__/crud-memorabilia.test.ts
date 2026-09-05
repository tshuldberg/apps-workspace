import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  createMemorabilia,
  deleteMemorabilia,
  getCollectionValue,
  getMemorabilia,
  listMemorabilia,
  updateMemorabilia,
  type CreateMemorabiliaInput,
} from '../db/crud';

function baseItem(
  overrides: Partial<CreateMemorabiliaInput> = {},
): CreateMemorabiliaInput {
  return {
    item_type: 'card',
    description: 'Mahomes rookie base',
    sport: 'football',
    team: 'Chiefs',
    player: 'Patrick Mahomes',
    purchase_price_cents: 20_000,
    estimated_value_cents: 80_000,
    ...overrides,
  };
}

describe('sports memorabilia CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('createMemorabilia + getMemorabilia round-trip with photo_ids parse', () => {
    const created = createMemorabilia(
      db.adapter,
      baseItem({ photo_ids: ['p1', 'p2'], notes_md: 'PSA 9' }),
    );
    expect(created.id.startsWith('mm_')).toBe(true);

    const fetched = getMemorabilia(db.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.description).toBe('Mahomes rookie base');
    expect(fetched?.photo_ids).toEqual(['p1', 'p2']);
    expect(fetched?.notes_md).toBe('PSA 9');
    expect(fetched?.purchase_price_cents).toBe(20_000);
    expect(fetched?.estimated_value_cents).toBe(80_000);
  });

  it('item_type CHECK constraint rejects unknown values', () => {
    expect(() =>
      createMemorabilia(
        db.adapter,
        baseItem({ item_type: 'unicorn' as never }),
      ),
    ).toThrow();
  });

  it('JSON + default columns fall back safely', () => {
    const created = createMemorabilia(db.adapter, {
      item_type: 'ticket',
      description: 'Super Bowl LVIII stub',
    });
    const fetched = getMemorabilia(db.adapter, created.id);
    expect(fetched?.photo_ids).toEqual([]);
    expect(fetched?.purchase_price_cents).toBe(0);
    expect(fetched?.estimated_value_cents).toBe(0);
    expect(fetched?.sport).toBeNull();
    expect(fetched?.team).toBeNull();
    expect(fetched?.player).toBeNull();
    expect(fetched?.acquired_at).toBeNull();
  });

  it('listMemorabilia filters by itemType, sport, team', () => {
    createMemorabilia(
      db.adapter,
      baseItem({ item_type: 'card', sport: 'football', team: 'Chiefs' }),
    );
    createMemorabilia(
      db.adapter,
      baseItem({ item_type: 'jersey', sport: 'football', team: 'Chiefs' }),
    );
    createMemorabilia(
      db.adapter,
      baseItem({ item_type: 'card', sport: 'baseball', team: 'Yankees' }),
    );

    expect(listMemorabilia(db.adapter)).toHaveLength(3);
    expect(
      listMemorabilia(db.adapter, { itemType: 'card' }),
    ).toHaveLength(2);
    expect(
      listMemorabilia(db.adapter, { sport: 'football' }),
    ).toHaveLength(2);
    expect(
      listMemorabilia(db.adapter, { team: 'Chiefs' }),
    ).toHaveLength(2);
    expect(
      listMemorabilia(db.adapter, { itemType: 'card', team: 'Chiefs' }),
    ).toHaveLength(1);
  });

  it('listMemorabilia orders by acquired_at DESC, falling back to created_at', () => {
    createMemorabilia(
      db.adapter,
      baseItem({ description: 'A', acquired_at: 100 }),
    );
    createMemorabilia(
      db.adapter,
      baseItem({ description: 'B', acquired_at: 300 }),
    );
    createMemorabilia(
      db.adapter,
      baseItem({ description: 'C', acquired_at: 200 }),
    );
    const rows = listMemorabilia(db.adapter);
    expect(rows.map((r) => r.description)).toEqual(['B', 'C', 'A']);
  });

  it('updateMemorabilia partial bumps updated_at', async () => {
    const created = createMemorabilia(db.adapter, baseItem());
    await new Promise((r) => setTimeout(r, 2));
    const updated = updateMemorabilia(db.adapter, created.id, {
      estimated_value_cents: 120_000,
      notes_md: 'appraised 2026',
    });
    expect(updated?.estimated_value_cents).toBe(120_000);
    expect(updated?.notes_md).toBe('appraised 2026');
    expect(updated!.updated_at).toBeGreaterThan(created.updated_at);
  });

  it('deleteMemorabilia returns true, then false on missing', () => {
    const created = createMemorabilia(db.adapter, baseItem());
    expect(deleteMemorabilia(db.adapter, created.id)).toBe(true);
    expect(getMemorabilia(db.adapter, created.id)).toBeNull();
    expect(deleteMemorabilia(db.adapter, 'mm_missing')).toBe(false);
  });

  it('getCollectionValue sums purchase + estimated + appreciation', () => {
    createMemorabilia(
      db.adapter,
      baseItem({
        purchase_price_cents: 10_000,
        estimated_value_cents: 15_000,
      }),
    );
    createMemorabilia(
      db.adapter,
      baseItem({
        purchase_price_cents: 20_000,
        estimated_value_cents: 50_000,
      }),
    );
    // Depreciating item.
    createMemorabilia(
      db.adapter,
      baseItem({
        purchase_price_cents: 8_000,
        estimated_value_cents: 3_000,
      }),
    );

    const totals = getCollectionValue(db.adapter);
    expect(totals.itemCount).toBe(3);
    expect(totals.purchaseTotalCents).toBe(38_000);
    expect(totals.estimatedTotalCents).toBe(68_000);
    expect(totals.appreciationCents).toBe(30_000);
  });

  it('getCollectionValue on empty table returns zeros', () => {
    const totals = getCollectionValue(db.adapter);
    expect(totals.itemCount).toBe(0);
    expect(totals.purchaseTotalCents).toBe(0);
    expect(totals.estimatedTotalCents).toBe(0);
    expect(totals.appreciationCents).toBe(0);
  });
});
