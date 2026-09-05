export type TableShape = 'round' | 'square' | 'rectangle' | 'banquette' | 'bar';

export interface FloorTable {
  id: string;
  areaId: string;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacityMin: number;
  capacityMax: number;
  combinableWith: string[];
  serverZone: string;
  tableNumber: string;
  active: boolean;
}

export interface FloorArea {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

export interface FloorLayout {
  id: string;
  name: string;
  snapshot: {
    areas: FloorArea[];
    tables: FloorTable[];
  };
}

export interface FloorPlanState {
  areas: FloorArea[];
  tables: FloorTable[];
  selectedTableId: string | null;
  selectedAreaId: string;
  zoom: number;
  panX: number;
  panY: number;
  snapEnabled: boolean;
  snapSize: 8 | 16;
  serviceLocked: boolean;
  undoStack: FloorPlanAction[];
  redoStack: FloorPlanAction[];
}

export type FloorPlanAction =
  | { type: 'ADD_TABLE'; table: FloorTable }
  | { type: 'MOVE_TABLE'; tableId: string; x: number; y: number; prevX: number; prevY: number }
  | { type: 'RESIZE_TABLE'; tableId: string; width: number; height: number; prevWidth: number; prevHeight: number }
  | { type: 'ROTATE_TABLE'; tableId: string; rotation: number; prevRotation: number }
  | { type: 'DELETE_TABLE'; table: FloorTable }
  | { type: 'UPDATE_TABLE'; tableId: string; updates: Partial<FloorTable>; prev: Partial<FloorTable> }
  | { type: 'ADD_AREA'; area: FloorArea }
  | { type: 'RENAME_AREA'; areaId: string; name: string; prevName: string }
  | { type: 'DELETE_AREA'; area: FloorArea; tables: FloorTable[] };
