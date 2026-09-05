import { describe, it, expect, vi } from 'vitest';
import { createInitialState, applyAction, undo, redo, createTable } from '../app/(admin)/floor-plan/lib/floor-plan-state';
import { snapToGrid, snapPosition } from '../app/(admin)/floor-plan/lib/snap';

// Mock crypto.randomUUID for deterministic tests
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

describe('createInitialState', () => {
  it('has default area', () => {
    const state = createInitialState();
    expect(state.areas).toHaveLength(1);
    expect(state.areas[0].name).toBe('Main');
    expect(state.areas[0].id).toBe('main');
  });

  it('accepts custom areas', () => {
    const areas = [{ id: 'patio', name: 'Patio', displayOrder: 0, active: true }];
    const state = createInitialState(areas);
    expect(state.areas).toHaveLength(1);
    expect(state.areas[0].id).toBe('patio');
  });

  it('starts with empty tables', () => {
    const state = createInitialState();
    expect(state.tables).toHaveLength(0);
  });
});

describe('applyAction - ADD_TABLE', () => {
  it('adds to tables array', () => {
    const state = createInitialState();
    const table = createTable('round', 100, 200, 'main');
    const next = applyAction(state, { type: 'ADD_TABLE', table });
    expect(next.tables).toHaveLength(1);
    expect(next.tables[0].shape).toBe('round');
    expect(next.tables[0].x).toBe(100);
    expect(next.tables[0].y).toBe(200);
  });

  it('selects the new table', () => {
    const state = createInitialState();
    const table = createTable('square', 50, 50, 'main');
    const next = applyAction(state, { type: 'ADD_TABLE', table });
    expect(next.selectedTableId).toBe(table.id);
  });
});

describe('applyAction - MOVE_TABLE', () => {
  it('updates position', () => {
    const state = createInitialState();
    const table = createTable('round', 100, 100, 'main');
    const withTable = applyAction(state, { type: 'ADD_TABLE', table });
    const moved = applyAction(withTable, {
      type: 'MOVE_TABLE',
      tableId: table.id,
      x: 200,
      y: 300,
      prevX: 100,
      prevY: 100,
    });
    const movedTable = moved.tables.find((t) => t.id === table.id);
    expect(movedTable?.x).toBe(200);
    expect(movedTable?.y).toBe(300);
  });
});

describe('applyAction - DELETE_TABLE', () => {
  it('removes from array', () => {
    const state = createInitialState();
    const table = createTable('round', 100, 100, 'main');
    const withTable = applyAction(state, { type: 'ADD_TABLE', table });
    expect(withTable.tables).toHaveLength(1);
    const deleted = applyAction(withTable, { type: 'DELETE_TABLE', table });
    expect(deleted.tables).toHaveLength(0);
  });

  it('clears selection when deleted table was selected', () => {
    const state = createInitialState();
    const table = createTable('round', 100, 100, 'main');
    const withTable = applyAction(state, { type: 'ADD_TABLE', table });
    expect(withTable.selectedTableId).toBe(table.id);
    const deleted = applyAction(withTable, { type: 'DELETE_TABLE', table });
    expect(deleted.selectedTableId).toBeNull();
  });
});

describe('undo', () => {
  it('reverses last action', () => {
    const state = createInitialState();
    const table = createTable('round', 100, 100, 'main');
    const withTable = applyAction(state, { type: 'ADD_TABLE', table });
    expect(withTable.tables).toHaveLength(1);
    const undone = undo(withTable);
    expect(undone.tables).toHaveLength(0);
  });

  it('does nothing when no history', () => {
    const state = createInitialState();
    const undone = undo(state);
    expect(undone).toBe(state);
  });
});

describe('redo', () => {
  it('re-applies undone action', () => {
    const state = createInitialState();
    const table = createTable('round', 100, 100, 'main');
    const withTable = applyAction(state, { type: 'ADD_TABLE', table });
    const undone = undo(withTable);
    expect(undone.tables).toHaveLength(0);
    const redone = redo(undone);
    expect(redone.tables).toHaveLength(1);
  });

  it('does nothing when no redo history', () => {
    const state = createInitialState();
    const redone = redo(state);
    expect(redone).toBe(state);
  });
});

describe('service lock flag toggling', () => {
  it('starts unlocked', () => {
    const state = createInitialState();
    expect(state.serviceLocked).toBe(false);
  });

  it('can be toggled', () => {
    const state = createInitialState();
    const locked = { ...state, serviceLocked: true };
    expect(locked.serviceLocked).toBe(true);
  });
});

describe('snapToGrid', () => {
  it('snaps to 8px grid', () => {
    expect(snapToGrid(5, 8)).toBe(8);
    expect(snapToGrid(3, 8)).toBe(0);
    expect(snapToGrid(12, 8)).toBe(16);
    expect(snapToGrid(16, 8)).toBe(16);
  });

  it('snaps to 16px grid', () => {
    expect(snapToGrid(10, 16)).toBe(16);
    expect(snapToGrid(7, 16)).toBe(0);
    expect(snapToGrid(24, 16)).toBe(32);
    expect(snapToGrid(25, 16)).toBe(32);
  });
});

describe('snapPosition', () => {
  it('snaps both x and y', () => {
    const result = snapPosition(13, 27, 16);
    expect(result.x).toBe(16);
    expect(result.y).toBe(32);
  });
});
