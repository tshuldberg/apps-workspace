// === Map construction helpers ===

import type { GameMap, NpcData, Warp, SignData } from '../game-types.ts';

/** Create a 2D array filled with a value */
export function makeGrid(width: number, height: number, fill: number): number[][] {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

/** Set a rectangular region in a grid */
export function fillRect(grid: number[][], x: number, y: number, w: number, h: number, value: number): void {
  for (let row = y; row < y + h && row < grid.length; row++) {
    for (let col = x; col < x + w && col < grid[0].length; col++) {
      grid[row][col] = value;
    }
  }
}

/** Set a single tile in a grid */
export function setTile(grid: number[][], x: number, y: number, value: number): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x] = value;
  }
}

/** Place a horizontal row of tiles */
export function fillRow(grid: number[][], x: number, y: number, w: number, value: number): void {
  fillRect(grid, x, y, w, 1, value);
}

/** Place a vertical column of tiles */
export function fillCol(grid: number[][], x: number, y: number, h: number, value: number): void {
  fillRect(grid, x, y, 1, h, value);
}

// Tile IDs
export const T = {
  GRASS: 0, TALL_GRASS: 1, WATER: 2, TREE: 3, TREE_TRUNK: 4,
  PATH: 5, SAND: 6, BUILDING_WALL: 7, ROOF_RED: 8, ROOF_BLUE: 9,
  ROOF_GREEN: 10, DOOR: 11, FLOOR: 12, CARPET: 13, COUNTER: 14,
  SHELF: 15, PC_TERMINAL: 16, CAVE_WALL: 17, CAVE_FLOOR: 18,
  LEDGE_SOUTH: 19, FENCE: 20, FLOWERS: 21, SIGN_TILE: 22,
  STAIRS_UP: 23, STAIRS_DOWN: 24, WATER_EDGE: 25, BOULDER: 26,
  CUT_TREE: 27, GYM_STATUE: 28,
} as const;

// Collision IDs
export const C = {
  WALKABLE: 0, SOLID: 1, WATER: 2, LEDGE_SOUTH: 3,
  TALL_GRASS: 4, WARP: 5, BOULDER: 6, CUT_TREE: 7,
} as const;

/** Standard Pokemon Center interior (5x4 tiles) */
export function makePokemonCenter(id: string, exitMap: string, exitX: number, exitY: number): GameMap {
  const w = 5, h = 4;
  const tiles = makeGrid(w, h, T.FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  // Counter across top
  fillRow(tiles, 0, 0, w, T.COUNTER);
  fillRow(collisions, 0, 0, w, C.SOLID);
  // PC terminal top-right
  setTile(tiles, 4, 0, T.PC_TERMINAL);
  // Carpet path to door
  setTile(tiles, 2, 1, T.CARPET);
  setTile(tiles, 2, 2, T.CARPET);
  setTile(tiles, 2, 3, T.CARPET);
  // Door at bottom center
  setTile(tiles, 2, 3, T.DOOR);
  setTile(collisions, 2, 3, C.WARP);

  return {
    id, name: 'Pokemon Center',
    width: w, height: h, tiles, collisions,
    warps: [{ x: 2, y: 3, targetMap: exitMap, targetX: exitX, targetY: exitY }],
    npcs: [
      { id: `${id}-nurse`, x: 2, y: 0, spriteId: 'nurse', facing: 'down', movement: 'stationary',
        dialogue: ['Welcome to the POKeMON CENTER!', 'We\'ll heal your POKeMON back to full health.', 'Please wait... Your POKeMON are fully healed!'] },
    ],
    wildEncounters: [], trainerPlacements: [], itemBalls: [],
    signs: [], connections: [], music: 'pokemon-center',
  };
}

/** Standard Poke Mart interior (5x4 tiles) */
export function makePokeMart(id: string, exitMap: string, exitX: number, exitY: number, shopDialogue?: string[]): GameMap {
  const w = 5, h = 4;
  const tiles = makeGrid(w, h, T.FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  // Counter + shelves at top
  fillRow(tiles, 0, 0, 3, T.COUNTER);
  fillRow(collisions, 0, 0, 3, C.SOLID);
  fillRow(tiles, 3, 0, 2, T.SHELF);
  fillRow(collisions, 3, 0, 2, C.SOLID);
  // Shelves on right wall
  setTile(tiles, 4, 1, T.SHELF);
  setTile(collisions, 4, 1, C.SOLID);
  // Door at bottom center
  setTile(tiles, 2, 3, T.DOOR);
  setTile(collisions, 2, 3, C.WARP);

  return {
    id, name: 'Poke Mart',
    width: w, height: h, tiles, collisions,
    warps: [{ x: 2, y: 3, targetMap: exitMap, targetX: exitX, targetY: exitY }],
    npcs: [
      { id: `${id}-clerk`, x: 1, y: 0, spriteId: 'clerk', facing: 'down', movement: 'stationary',
        dialogue: shopDialogue ?? ['Welcome! How may I help you?'] },
    ],
    wildEncounters: [], trainerPlacements: [], itemBalls: [],
    signs: [], connections: [], music: 'poke-mart',
  };
}

/** Standard house interior (4x3 tiles) */
export function makeHouse(id: string, exitMap: string, exitX: number, exitY: number, npcs: NpcData[]): GameMap {
  const w = 4, h = 3;
  const tiles = makeGrid(w, h, T.FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  // Shelf/counter at top-left
  setTile(tiles, 0, 0, T.SHELF);
  setTile(collisions, 0, 0, C.SOLID);
  setTile(tiles, 1, 0, T.SHELF);
  setTile(collisions, 1, 0, C.SOLID);
  // TV/shelf at top-right
  setTile(tiles, 3, 0, T.SHELF);
  setTile(collisions, 3, 0, C.SOLID);
  // Carpet
  setTile(tiles, 1, 1, T.CARPET);
  setTile(tiles, 2, 1, T.CARPET);
  // Door bottom-right
  setTile(tiles, 3, 2, T.DOOR);
  setTile(collisions, 3, 2, C.WARP);

  return {
    id, name: 'House',
    width: w, height: h, tiles, collisions,
    warps: [{ x: 3, y: 2, targetMap: exitMap, targetX: exitX, targetY: exitY }],
    npcs,
    wildEncounters: [], trainerPlacements: [], itemBalls: [],
    signs: [], connections: [], music: 'house',
  };
}

/** Standard Gym interior */
export function makeGym(
  id: string, name: string, width: number, height: number,
  exitMap: string, exitX: number, exitY: number,
  trainerPlacements: GameMap['trainerPlacements'],
  npcs: NpcData[],
): GameMap {
  const tiles = makeGrid(width, height, T.FLOOR);
  const collisions = makeGrid(width, height, C.WALKABLE);

  // Gym statues flanking entrance
  setTile(tiles, 0, height - 1, T.GYM_STATUE);
  setTile(collisions, 0, height - 1, C.SOLID);
  setTile(tiles, width - 1, height - 1, T.GYM_STATUE);
  setTile(collisions, width - 1, height - 1, C.SOLID);

  // Walls on sides
  fillCol(tiles, 0, 0, height - 1, T.BUILDING_WALL);
  fillCol(collisions, 0, 0, height - 1, C.SOLID);
  fillCol(tiles, width - 1, 0, height - 1, T.BUILDING_WALL);
  fillCol(collisions, width - 1, 0, height - 1, C.SOLID);

  // Door bottom center
  const doorX = Math.floor(width / 2);
  setTile(tiles, doorX, height - 1, T.DOOR);
  setTile(collisions, doorX, height - 1, C.WARP);

  return {
    id, name,
    width, height, tiles, collisions,
    warps: [{ x: doorX, y: height - 1, targetMap: exitMap, targetX: exitX, targetY: exitY }],
    npcs, trainerPlacements,
    wildEncounters: [], itemBalls: [],
    signs: [], connections: [], music: 'gym',
  };
}

/** Place a building footprint on a town map (roof + wall + door) */
export function placeBuilding(
  tiles: number[][], collisions: number[][],
  x: number, y: number, w: number, h: number,
  roofTile: number
): void {
  // Roof row
  fillRect(tiles, x, y, w, 1, roofTile);
  fillRect(collisions, x, y, w, 1, C.SOLID);
  // Wall rows (below roof, above door row)
  if (h > 2) {
    fillRect(tiles, x, y + 1, w, h - 2, T.BUILDING_WALL);
    fillRect(collisions, x, y + 1, w, h - 2, C.SOLID);
  }
  // Bottom row: wall with door in center
  const doorRow = y + h - 1;
  fillRect(tiles, x, doorRow, w, 1, T.BUILDING_WALL);
  fillRect(collisions, x, doorRow, w, 1, C.SOLID);
  const doorX = x + Math.floor(w / 2);
  setTile(tiles, doorX, doorRow, T.DOOR);
  setTile(collisions, doorX, doorRow, C.WARP);
}

/** Place a tree border around the edges of a map */
export function placeTreeBorder(tiles: number[][], collisions: number[][], width: number, height: number): void {
  fillRow(tiles, 0, 0, width, T.TREE);
  fillRow(collisions, 0, 0, width, C.SOLID);
  fillRow(tiles, 0, height - 1, width, T.TREE);
  fillRow(collisions, 0, height - 1, width, C.SOLID);
  fillCol(tiles, 0, 0, height, T.TREE);
  fillCol(collisions, 0, 0, height, C.SOLID);
  fillCol(tiles, width - 1, 0, height, T.TREE);
  fillCol(collisions, width - 1, 0, height, C.SOLID);
}
