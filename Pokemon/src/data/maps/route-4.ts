// === Route 4 — Mt. Moon exit to Cerulean City ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

const w = 20, h = 10;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Borders
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillRow(tiles, 0, h - 1, w, T.TREE);
fillRow(collisions, 0, h - 1, w, C.SOLID);
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// West edge connection from Route 3
setTile(tiles, 0, 4, T.PATH);
setTile(collisions, 0, 4, C.WALKABLE);
setTile(tiles, 0, 5, T.PATH);
setTile(collisions, 0, 5, C.WALKABLE);

// Mt. Moon exit stairs
setTile(tiles, 1, 4, T.STAIRS_UP);
setTile(collisions, 1, 4, C.WARP);
setTile(tiles, 1, 5, T.STAIRS_UP);
setTile(collisions, 1, 5, C.WARP);

// Main path east
fillRect(tiles, 1, 4, 18, 2, T.PATH);
fillRect(collisions, 1, 4, 18, 2, C.WALKABLE);

// Tall grass
fillRect(tiles, 4, 1, 5, 3, T.TALL_GRASS);
fillRect(collisions, 4, 1, 5, 3, C.TALL_GRASS);
fillRect(tiles, 12, 6, 5, 3, T.TALL_GRASS);
fillRect(collisions, 12, 6, 5, 3, C.TALL_GRASS);

// Ledges — can only go east (no backtracking to Mt. Moon)
fillRow(tiles, 3, 3, 6, T.LEDGE_SOUTH);
fillRow(collisions, 3, 3, 6, C.LEDGE_SOUTH);

// East exit to Cerulean
setTile(tiles, w - 1, 4, T.PATH);
setTile(collisions, w - 1, 4, C.WALKABLE);
setTile(tiles, w - 1, 5, T.PATH);
setTile(collisions, w - 1, 5, C.WALKABLE);

export const route4: GameMap = {
  id: 'route-4',
  name: 'ROUTE 4',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 1, y: 4, targetMap: 'mt-moon-b2f', targetX: 13, targetY: 5 },
    { x: 1, y: 5, targetMap: 'mt-moon-1f', targetX: 1, targetY: 1 },
  ],
  npcs: [],
  wildEncounters: [
    { speciesId: 21, levelMin: 8, levelMax: 12, rate: 80 },   // Spearow
    { speciesId: 23, levelMin: 6, levelMax: 12, rate: 60 },   // Ekans
    { speciesId: 27, levelMin: 6, levelMax: 12, rate: 60 },   // Sandshrew
    { speciesId: 56, levelMin: 10, levelMax: 12, rate: 30 },  // Mankey
  ],
  trainerPlacements: [],
  itemBalls: [
    { x: 8, y: 2, itemId: 22, quantity: 1, flag: 'r4-tm-mega-punch' },
  ],
  signs: [],
  connections: [
    { direction: 'left', mapId: 'route-3', offset: -1 },
    { direction: 'right', mapId: 'cerulean-city', offset: 0 },
  ],
  music: 'route-4',
};
