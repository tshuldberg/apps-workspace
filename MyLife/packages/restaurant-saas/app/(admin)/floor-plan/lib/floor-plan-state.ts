import type { FloorPlanState, FloorPlanAction, FloorTable, FloorArea, TableShape } from './types';

export function createInitialState(areas?: FloorArea[]): FloorPlanState {
  const defaultArea: FloorArea = { id: 'main', name: 'Main', displayOrder: 0, active: true };
  return {
    areas: areas ?? [defaultArea],
    tables: [],
    selectedTableId: null,
    selectedAreaId: defaultArea.id,
    zoom: 1,
    panX: 0,
    panY: 0,
    snapEnabled: true,
    snapSize: 16,
    serviceLocked: false,
    undoStack: [],
    redoStack: [],
  };
}

export function applyAction(state: FloorPlanState, action: FloorPlanAction): FloorPlanState {
  const next = { ...state, undoStack: [...state.undoStack, action], redoStack: [] };

  switch (action.type) {
    case 'ADD_TABLE':
      return { ...next, tables: [...next.tables, action.table], selectedTableId: action.table.id };
    case 'MOVE_TABLE':
      return {
        ...next,
        tables: next.tables.map((t) =>
          t.id === action.tableId ? { ...t, x: action.x, y: action.y } : t,
        ),
      };
    case 'RESIZE_TABLE':
      return {
        ...next,
        tables: next.tables.map((t) =>
          t.id === action.tableId ? { ...t, width: action.width, height: action.height } : t,
        ),
      };
    case 'ROTATE_TABLE':
      return {
        ...next,
        tables: next.tables.map((t) =>
          t.id === action.tableId ? { ...t, rotation: action.rotation } : t,
        ),
      };
    case 'DELETE_TABLE':
      return {
        ...next,
        tables: next.tables.filter((t) => t.id !== action.table.id),
        selectedTableId: next.selectedTableId === action.table.id ? null : next.selectedTableId,
      };
    case 'UPDATE_TABLE':
      return {
        ...next,
        tables: next.tables.map((t) =>
          t.id === action.tableId ? { ...t, ...action.updates } : t,
        ),
      };
    case 'ADD_AREA':
      return { ...next, areas: [...next.areas, action.area], selectedAreaId: action.area.id };
    case 'RENAME_AREA':
      return {
        ...next,
        areas: next.areas.map((a) =>
          a.id === action.areaId ? { ...a, name: action.name } : a,
        ),
      };
    case 'DELETE_AREA':
      return {
        ...next,
        areas: next.areas.filter((a) => a.id !== action.area.id),
        tables: next.tables.filter((t) => t.areaId !== action.area.id),
        selectedAreaId: next.areas[0]?.id ?? '',
      };
    default:
      return state;
  }
}

export function undo(state: FloorPlanState): FloorPlanState {
  if (state.undoStack.length === 0) return state;
  const action = state.undoStack[state.undoStack.length - 1];
  const reversed = reverseAction(action);
  if (!reversed) return state;

  const base = { ...state, undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, action] };
  return applyActionWithoutHistory(base, reversed);
}

export function redo(state: FloorPlanState): FloorPlanState {
  if (state.redoStack.length === 0) return state;
  const action = state.redoStack[state.redoStack.length - 1];
  const base = { ...state, redoStack: state.redoStack.slice(0, -1), undoStack: [...state.undoStack, action] };
  return applyActionWithoutHistory(base, action);
}

function applyActionWithoutHistory(state: FloorPlanState, action: FloorPlanAction): FloorPlanState {
  switch (action.type) {
    case 'ADD_TABLE':
      return { ...state, tables: [...state.tables, action.table] };
    case 'MOVE_TABLE':
      return { ...state, tables: state.tables.map((t) => t.id === action.tableId ? { ...t, x: action.x, y: action.y } : t) };
    case 'RESIZE_TABLE':
      return { ...state, tables: state.tables.map((t) => t.id === action.tableId ? { ...t, width: action.width, height: action.height } : t) };
    case 'ROTATE_TABLE':
      return { ...state, tables: state.tables.map((t) => t.id === action.tableId ? { ...t, rotation: action.rotation } : t) };
    case 'DELETE_TABLE':
      return { ...state, tables: state.tables.filter((t) => t.id !== action.table.id) };
    case 'UPDATE_TABLE':
      return { ...state, tables: state.tables.map((t) => t.id === action.tableId ? { ...t, ...action.updates } : t) };
    case 'ADD_AREA':
      return { ...state, areas: [...state.areas, action.area] };
    case 'RENAME_AREA':
      return { ...state, areas: state.areas.map((a) => a.id === action.areaId ? { ...a, name: action.name } : a) };
    case 'DELETE_AREA':
      return { ...state, areas: state.areas.filter((a) => a.id !== action.area.id), tables: state.tables.filter((t) => t.areaId !== action.area.id) };
    default:
      return state;
  }
}

function reverseAction(action: FloorPlanAction): FloorPlanAction | null {
  switch (action.type) {
    case 'ADD_TABLE':
      return { type: 'DELETE_TABLE', table: action.table };
    case 'MOVE_TABLE':
      return { type: 'MOVE_TABLE', tableId: action.tableId, x: action.prevX, y: action.prevY, prevX: action.x, prevY: action.y };
    case 'RESIZE_TABLE':
      return { type: 'RESIZE_TABLE', tableId: action.tableId, width: action.prevWidth, height: action.prevHeight, prevWidth: action.width, prevHeight: action.height };
    case 'ROTATE_TABLE':
      return { type: 'ROTATE_TABLE', tableId: action.tableId, rotation: action.prevRotation, prevRotation: action.rotation };
    case 'DELETE_TABLE':
      return { type: 'ADD_TABLE', table: action.table };
    case 'UPDATE_TABLE':
      return { type: 'UPDATE_TABLE', tableId: action.tableId, updates: action.prev, prev: action.updates };
    case 'ADD_AREA':
      return { type: 'DELETE_AREA', area: action.area, tables: [] };
    case 'RENAME_AREA':
      return { type: 'RENAME_AREA', areaId: action.areaId, name: action.prevName, prevName: action.name };
    case 'DELETE_AREA':
      return { type: 'ADD_AREA', area: action.area };
    default:
      return null;
  }
}

export function createTable(
  shape: TableShape,
  x: number,
  y: number,
  areaId: string,
): FloorTable {
  const defaults: Record<TableShape, { width: number; height: number; capacityMin: number; capacityMax: number }> = {
    round: { width: 60, height: 60, capacityMin: 2, capacityMax: 4 },
    square: { width: 60, height: 60, capacityMin: 2, capacityMax: 4 },
    rectangle: { width: 100, height: 60, capacityMin: 4, capacityMax: 6 },
    banquette: { width: 120, height: 50, capacityMin: 4, capacityMax: 8 },
    bar: { width: 200, height: 40, capacityMin: 4, capacityMax: 12 },
  };
  const d = defaults[shape];
  return {
    id: crypto.randomUUID(),
    areaId,
    shape,
    x,
    y,
    width: d.width,
    height: d.height,
    rotation: 0,
    capacityMin: d.capacityMin,
    capacityMax: d.capacityMax,
    combinableWith: [],
    serverZone: '',
    tableNumber: '',
    active: true,
  };
}
