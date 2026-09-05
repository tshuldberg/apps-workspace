import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  createChecklistItem,
  deleteChecklistItem,
  getChecklistItem,
  listChecklistItems,
  reorderChecklistItems,
  toggleDone,
  updateChecklistItem,
} from '../db/crud/checklists';
import type { ChecklistItemInput } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let tripId: string;

function makeInput(
  overrides: Partial<ChecklistItemInput> = {},
): ChecklistItemInput {
  return {
    trip_id: tripId,
    label: 'Pack passport',
    ...overrides,
  };
}

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

describe('createChecklistItem', () => {
  it('returns an item with cl_ prefixed id and timestamps', () => {
    const item = createChecklistItem(adapter, makeInput());
    expect(item.id).toMatch(/^cl_/);
    expect(item.trip_id).toBe(tripId);
    expect(item.label).toBe('Pack passport');
    expect(item.done).toBe(0);
    expect(item.done_at).toBeNull();
    expect(item.sort_order).toBe(0);
    expect(item.created_at).toBeTruthy();
    expect(item.updated_at).toBeTruthy();
  });

  it('auto-assigns sort_order to end of list', () => {
    const a = createChecklistItem(adapter, makeInput({ label: 'A' }));
    const b = createChecklistItem(adapter, makeInput({ label: 'B' }));
    const c = createChecklistItem(adapter, makeInput({ label: 'C' }));
    expect(a.sort_order).toBe(0);
    expect(b.sort_order).toBe(1);
    expect(c.sort_order).toBe(2);
  });

  it('respects explicit sort_order', () => {
    const item = createChecklistItem(adapter, makeInput({ sort_order: 42 }));
    expect(item.sort_order).toBe(42);
  });

  it('persists category', () => {
    const item = createChecklistItem(
      adapter,
      makeInput({ category: 'documents' }),
    );
    expect(item.category).toBe('documents');
  });

  it('marks done_at when done=true on create', () => {
    const item = createChecklistItem(adapter, makeInput({ done: true }));
    expect(item.done).toBe(1);
    expect(item.done_at).toBeTruthy();
  });

  it('rejects missing trip_id', () => {
    expect(() =>
      createChecklistItem(adapter, makeInput({ trip_id: '' })),
    ).toThrow();
  });

  it('rejects empty label', () => {
    expect(() =>
      createChecklistItem(adapter, makeInput({ label: '' })),
    ).toThrow();
  });
});

describe('getChecklistItem', () => {
  it('returns null when missing', () => {
    expect(getChecklistItem(adapter, 'nope')).toBeNull();
  });

  it('returns the row', () => {
    const item = createChecklistItem(adapter, makeInput({ label: 'Hi' }));
    expect(getChecklistItem(adapter, item.id)?.label).toBe('Hi');
  });
});

describe('listChecklistItems', () => {
  it('returns empty array for an empty trip', () => {
    expect(listChecklistItems(adapter, { tripId })).toEqual([]);
  });

  it('orders by sort_order ASC', () => {
    createChecklistItem(adapter, makeInput({ label: 'A', sort_order: 2 }));
    createChecklistItem(adapter, makeInput({ label: 'B', sort_order: 0 }));
    createChecklistItem(adapter, makeInput({ label: 'C', sort_order: 1 }));
    const items = listChecklistItems(adapter, { tripId });
    expect(items.map((x) => x.label)).toEqual(['B', 'C', 'A']);
  });

  it('filters by done=true', () => {
    const a = createChecklistItem(adapter, makeInput({ label: 'a' }));
    createChecklistItem(adapter, makeInput({ label: 'b' }));
    toggleDone(adapter, a.id);
    const items = listChecklistItems(adapter, { tripId, done: true });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('a');
  });

  it('filters by done=false', () => {
    const a = createChecklistItem(adapter, makeInput({ label: 'a' }));
    createChecklistItem(adapter, makeInput({ label: 'b' }));
    toggleDone(adapter, a.id);
    const items = listChecklistItems(adapter, { tripId, done: false });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('b');
  });

  it('scopes to the given trip', () => {
    const otherTrip = createTrip(adapter, { name: 'Other' });
    createChecklistItem(adapter, makeInput({ label: 'mine' }));
    createChecklistItem(
      adapter,
      makeInput({ trip_id: otherTrip.id, label: 'other' }),
    );
    const items = listChecklistItems(adapter, { tripId });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('mine');
  });
});

describe('toggleDone', () => {
  it('flips done 0 -> 1 and sets done_at', () => {
    const item = createChecklistItem(adapter, makeInput());
    toggleDone(adapter, item.id);
    const after = getChecklistItem(adapter, item.id)!;
    expect(after.done).toBe(1);
    expect(after.done_at).toBeTruthy();
  });

  it('flips done 1 -> 0 and clears done_at', () => {
    const item = createChecklistItem(adapter, makeInput({ done: true }));
    toggleDone(adapter, item.id);
    const after = getChecklistItem(adapter, item.id)!;
    expect(after.done).toBe(0);
    expect(after.done_at).toBeNull();
  });

  it('no-ops when id does not exist', () => {
    toggleDone(adapter, 'nope');
    expect(listChecklistItems(adapter, { tripId })).toEqual([]);
  });
});

describe('updateChecklistItem', () => {
  it('updates label and category and bumps updated_at', async () => {
    const item = createChecklistItem(adapter, makeInput({ label: 'old' }));
    const before = getChecklistItem(adapter, item.id)!;
    await new Promise((r) => setTimeout(r, 10));
    updateChecklistItem(adapter, item.id, {
      label: 'new',
      category: 'packing',
    });
    const after = getChecklistItem(adapter, item.id)!;
    expect(after.label).toBe('new');
    expect(after.category).toBe('packing');
    expect(after.updated_at).not.toBe(before.updated_at);
  });

  it('updating done=true sets done_at', () => {
    const item = createChecklistItem(adapter, makeInput());
    updateChecklistItem(adapter, item.id, { done: true });
    const after = getChecklistItem(adapter, item.id)!;
    expect(after.done).toBe(1);
    expect(after.done_at).toBeTruthy();
  });

  it('updating done=false clears done_at', () => {
    const item = createChecklistItem(adapter, makeInput({ done: true }));
    updateChecklistItem(adapter, item.id, { done: false });
    const after = getChecklistItem(adapter, item.id)!;
    expect(after.done).toBe(0);
    expect(after.done_at).toBeNull();
  });

  it('ignores unknown columns (injection safety)', () => {
    const item = createChecklistItem(adapter, makeInput({ label: 'safe' }));
    updateChecklistItem(adapter, item.id, {
      // @ts-expect-error testing injection safety
      malicious: "x'; DROP TABLE tv_checklist_items; --",
      label: 'still safe',
    });
    expect(getChecklistItem(adapter, item.id)!.label).toBe('still safe');
  });

  it('no-ops with empty patch', () => {
    const item = createChecklistItem(adapter, makeInput());
    const before = getChecklistItem(adapter, item.id)!;
    updateChecklistItem(adapter, item.id, {});
    const after = getChecklistItem(adapter, item.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });
});

describe('deleteChecklistItem', () => {
  it('removes an item', () => {
    const item = createChecklistItem(adapter, makeInput());
    deleteChecklistItem(adapter, item.id);
    expect(getChecklistItem(adapter, item.id)).toBeNull();
  });

  it('cascades from trip delete', () => {
    const item = createChecklistItem(adapter, makeInput());
    adapter.execute(`DELETE FROM tv_trips WHERE id = ?`, [tripId]);
    expect(getChecklistItem(adapter, item.id)).toBeNull();
  });
});

describe('reorderChecklistItems', () => {
  it('reassigns sort_order in the provided order', () => {
    const a = createChecklistItem(adapter, makeInput({ label: 'A' }));
    const b = createChecklistItem(adapter, makeInput({ label: 'B' }));
    const c = createChecklistItem(adapter, makeInput({ label: 'C' }));
    reorderChecklistItems(adapter, [c.id, a.id, b.id]);
    const items = listChecklistItems(adapter, { tripId });
    expect(items.map((x) => x.label)).toEqual(['C', 'A', 'B']);
    expect(items.map((x) => x.sort_order)).toEqual([0, 1, 2]);
  });

  it('leaves items not in the list untouched', () => {
    const a = createChecklistItem(adapter, makeInput({ label: 'A' }));
    const b = createChecklistItem(adapter, makeInput({ label: 'B' }));
    const originalBOrder = getChecklistItem(adapter, b.id)!.sort_order;
    reorderChecklistItems(adapter, [a.id]);
    expect(getChecklistItem(adapter, a.id)!.sort_order).toBe(0);
    expect(getChecklistItem(adapter, b.id)!.sort_order).toBe(originalBOrder);
  });

  it('no-ops on empty input', () => {
    const a = createChecklistItem(adapter, makeInput({ label: 'A' }));
    reorderChecklistItems(adapter, []);
    expect(getChecklistItem(adapter, a.id)!.sort_order).toBe(0);
  });
});
