import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  bulkAddPackingItems,
  createListFromTemplate,
  createPackingItem,
  createPackingList,
  deletePackingItem,
  deletePackingList,
  duplicatePackingList,
  getPackingItem,
  getPackingList,
  listPackingItems,
  listPackingListsByTrip,
  listPackingTemplates,
  reorderPackingItems,
  togglePackingItem,
  updatePackingItem,
  updatePackingList,
} from '../db/crud/packing';
import { PACKING_TEMPLATES } from '../engine/packing-templates';
import type { PackingTemplateKey } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let tripId: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  const trip = createTrip(adapter, { name: 'Test Trip' });
  tripId = trip.id;
});

afterEach(() => {
  closeDb();
});

// ── Lists ───────────────────────────────────────────────────────────

describe('createPackingList', () => {
  it('returns a trip-scoped list with pl_ prefixed id and timestamps', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'Main' });
    expect(list.id).toMatch(/^pl_/);
    expect(list.trip_id).toBe(tripId);
    expect(list.name).toBe('Main');
    expect(list.template).toBe(0);
    expect(list.created_at).toBeTruthy();
  });

  it('allows template lists without a trip', () => {
    const list = createPackingList(adapter, { name: 'Weekender', template: true });
    expect(list.trip_id).toBeNull();
    expect(list.template).toBe(1);
  });

  it('rejects empty name', () => {
    expect(() => createPackingList(adapter, { name: '' })).toThrow();
  });
});

describe('listPackingListsByTrip / listPackingTemplates', () => {
  it('lists only lists for the given trip', () => {
    const other = createTrip(adapter, { name: 'Other' });
    createPackingList(adapter, { trip_id: tripId, name: 'A' });
    createPackingList(adapter, { trip_id: tripId, name: 'B' });
    createPackingList(adapter, { trip_id: other.id, name: 'C' });
    const mine = listPackingListsByTrip(adapter, tripId);
    expect(mine.map((l) => l.name).sort()).toEqual(['A', 'B']);
  });

  it('lists only templates when template=1', () => {
    createPackingList(adapter, { trip_id: tripId, name: 'Trip list' });
    createPackingList(adapter, { name: 'Template A', template: true });
    createPackingList(adapter, { name: 'Template B', template: true });
    const templates = listPackingTemplates(adapter);
    expect(templates.map((l) => l.name).sort()).toEqual(['Template A', 'Template B']);
  });
});

describe('updatePackingList + deletePackingList', () => {
  it('updates name and template flag', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'old' });
    updatePackingList(adapter, list.id, { name: 'new', template: true });
    const after = getPackingList(adapter, list.id)!;
    expect(after.name).toBe('new');
    expect(after.template).toBe(1);
  });

  it('no-ops on empty patch', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'stable' });
    const before = getPackingList(adapter, list.id)!;
    updatePackingList(adapter, list.id, {});
    const after = getPackingList(adapter, list.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });

  it('deletes a list and cascades to items', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'x' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'Sock' });
    deletePackingList(adapter, list.id);
    expect(getPackingList(adapter, list.id)).toBeNull();
    expect(getPackingItem(adapter, item.id)).toBeNull();
  });
});

describe('duplicatePackingList', () => {
  it('copies items with new ids and resets packed state', () => {
    const source = createPackingList(adapter, { trip_id: tripId, name: 'Src' });
    const a = createPackingItem(adapter, { list_id: source.id, label: 'A', packed: true });
    const b = createPackingItem(adapter, { list_id: source.id, label: 'B' });
    const copy = duplicatePackingList(adapter, source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('Src (Copy)');
    expect(copy.template).toBe(0);

    const copied = listPackingItems(adapter, { listId: copy.id });
    expect(copied.map((i) => i.label)).toEqual(['A', 'B']);
    for (const item of copied) {
      expect([a.id, b.id]).not.toContain(item.id);
      expect(item.packed).toBe(0);
      expect(item.packed_at).toBeNull();
    }
  });

  it('reassigns trip_id when provided', () => {
    const other = createTrip(adapter, { name: 'Other' });
    const source = createPackingList(adapter, { name: 'Tpl', template: true });
    createPackingItem(adapter, { list_id: source.id, label: 'X' });
    const copy = duplicatePackingList(adapter, source.id, {
      tripId: other.id,
      name: 'From Template',
    });
    expect(copy.trip_id).toBe(other.id);
    expect(copy.name).toBe('From Template');
  });

  it('throws when source missing', () => {
    expect(() => duplicatePackingList(adapter, 'pl_missing')).toThrow(
      /Packing list not found/,
    );
  });
});

// ── Items ───────────────────────────────────────────────────────────

describe('createPackingItem', () => {
  it('returns an item with pi_ id and defaults', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'Shirt' });
    expect(item.id).toMatch(/^pi_/);
    expect(item.quantity).toBe(1);
    expect(item.packed).toBe(0);
    expect(item.packed_at).toBeNull();
    expect(item.sort_order).toBe(0);
  });

  it('auto-increments sort_order within a list', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const a = createPackingItem(adapter, { list_id: list.id, label: 'A' });
    const b = createPackingItem(adapter, { list_id: list.id, label: 'B' });
    const c = createPackingItem(adapter, { list_id: list.id, label: 'C' });
    expect([a.sort_order, b.sort_order, c.sort_order]).toEqual([0, 1, 2]);
  });

  it('sets packed_at when packed=true on create', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, {
      list_id: list.id,
      label: 'X',
      packed: true,
    });
    expect(item.packed).toBe(1);
    expect(item.packed_at).toBeTruthy();
  });

  it('rejects empty label', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    expect(() =>
      createPackingItem(adapter, { list_id: list.id, label: '' }),
    ).toThrow();
  });
});

describe('listPackingItems', () => {
  it('orders by sort_order asc and filters by packed', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const a = createPackingItem(adapter, { list_id: list.id, label: 'A' });
    createPackingItem(adapter, { list_id: list.id, label: 'B' });
    togglePackingItem(adapter, a.id);
    const packed = listPackingItems(adapter, { listId: list.id, packed: true });
    const unpacked = listPackingItems(adapter, { listId: list.id, packed: false });
    expect(packed.map((i) => i.label)).toEqual(['A']);
    expect(unpacked.map((i) => i.label)).toEqual(['B']);
  });
});

describe('togglePackingItem + updatePackingItem + deletePackingItem', () => {
  it('toggle flips packed and sets/unsets packed_at', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'Y' });
    togglePackingItem(adapter, item.id);
    let after = getPackingItem(adapter, item.id)!;
    expect(after.packed).toBe(1);
    expect(after.packed_at).toBeTruthy();
    togglePackingItem(adapter, item.id);
    after = getPackingItem(adapter, item.id)!;
    expect(after.packed).toBe(0);
    expect(after.packed_at).toBeNull();
  });

  it('update ignores unknown columns and bumps updated_at', async () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'old' });
    const before = getPackingItem(adapter, item.id)!;
    await new Promise((r) => setTimeout(r, 10));
    updatePackingItem(adapter, item.id, {
      // @ts-expect-error injection safety
      malicious: "x'; DROP TABLE tv_packing_items; --",
      label: 'new',
      quantity: 3,
    });
    const after = getPackingItem(adapter, item.id)!;
    expect(after.label).toBe('new');
    expect(after.quantity).toBe(3);
    expect(after.updated_at).not.toBe(before.updated_at);
  });

  it('delete removes an item', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'Z' });
    deletePackingItem(adapter, item.id);
    expect(getPackingItem(adapter, item.id)).toBeNull();
  });
});

describe('reorderPackingItems', () => {
  it('reassigns sort_order in the given order', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const a = createPackingItem(adapter, { list_id: list.id, label: 'A' });
    const b = createPackingItem(adapter, { list_id: list.id, label: 'B' });
    const c = createPackingItem(adapter, { list_id: list.id, label: 'C' });
    reorderPackingItems(adapter, [c.id, a.id, b.id]);
    const items = listPackingItems(adapter, { listId: list.id });
    expect(items.map((i) => i.label)).toEqual(['C', 'A', 'B']);
    expect(items.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });
});

describe('bulkAddPackingItems', () => {
  it('transactionally appends items with incrementing sort_order', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    createPackingItem(adapter, { list_id: list.id, label: 'Existing' });
    const added = bulkAddPackingItems(adapter, list.id, ['One', 'Two', 'Three']);
    expect(added.map((i) => i.label)).toEqual(['One', 'Two', 'Three']);
    expect(added.map((i) => i.sort_order)).toEqual([1, 2, 3]);
    expect(listPackingItems(adapter, { listId: list.id })).toHaveLength(4);
  });

  it('returns empty array and is a no-op when labels are empty', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    expect(bulkAddPackingItems(adapter, list.id, [])).toEqual([]);
    expect(listPackingItems(adapter, { listId: list.id })).toEqual([]);
  });
});

// ── Cascade ─────────────────────────────────────────────────────────

describe('cascade deletes', () => {
  it('deleting a list cascades to its items', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'A' });
    deletePackingList(adapter, list.id);
    expect(getPackingItem(adapter, item.id)).toBeNull();
  });

  it('deleting a trip cascades to its lists and items', () => {
    const list = createPackingList(adapter, { trip_id: tripId, name: 'L' });
    const item = createPackingItem(adapter, { list_id: list.id, label: 'A' });
    adapter.execute(`DELETE FROM tv_trips WHERE id = ?`, [tripId]);
    expect(getPackingList(adapter, list.id)).toBeNull();
    expect(getPackingItem(adapter, item.id)).toBeNull();
  });
});

// ── Template seeding ────────────────────────────────────────────────

describe('createListFromTemplate', () => {
  const keys: PackingTemplateKey[] = [
    'weekend',
    'beach',
    'ski',
    'business',
    'backpacking',
  ];

  it.each(keys)('populates a list from the %s template', (key) => {
    const list = createListFromTemplate(adapter, tripId, key);
    expect(list.trip_id).toBe(tripId);
    expect(list.template).toBe(0);
    const expected = PACKING_TEMPLATES[key];
    const items = listPackingItems(adapter, { listId: list.id });
    expect(items).toHaveLength(expected.length);
    expect(items.map((i) => i.label)).toEqual(expected.map((e) => e.label));
    expect(items.map((i) => i.category)).toEqual(expected.map((e) => e.category));
    expect(items.every((i) => i.packed === 0)).toBe(true);
  });

  it('uses custom name when provided', () => {
    const list = createListFromTemplate(adapter, tripId, 'weekend', 'My bag');
    expect(list.name).toBe('My bag');
  });

  it('rejects an unknown template key', () => {
    expect(() =>
      // @ts-expect-error intentionally invalid key
      createListFromTemplate(adapter, tripId, 'nonexistent'),
    ).toThrow();
  });
});
