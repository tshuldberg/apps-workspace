// === Route 3 — Pewter City to Mt. Moon entrance ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

const w = 30, h = 10;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree borders
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillRow(tiles, 0, h - 1, w, T.TREE);
fillRow(collisions, 0, h - 1, w, C.SOLID);

// West exit border
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
setTile(tiles, 0, 4, T.PATH);
setTile(collisions, 0, 4, C.WALKABLE);
setTile(tiles, 0, 5, T.PATH);
setTile(collisions, 0, 5, C.WALKABLE);

// Main path winding east
fillRect(tiles, 0, 4, 8, 2, T.PATH);
fillRect(collisions, 0, 4, 8, 2, C.WALKABLE);
fillRect(tiles, 7, 2, 2, 3, T.PATH);
fillRect(collisions, 7, 2, 2, 3, C.WALKABLE);
fillRect(tiles, 8, 2, 8, 2, T.PATH);
fillRect(collisions, 8, 2, 8, 2, C.WALKABLE);
fillRect(tiles, 15, 2, 2, 5, T.PATH);
fillRect(collisions, 15, 2, 2, 5, C.WALKABLE);
fillRect(tiles, 16, 6, 10, 2, T.PATH);
fillRect(collisions, 16, 6, 10, 2, C.WALKABLE);
fillRect(tiles, 25, 3, 2, 4, T.PATH);
fillRect(collisions, 25, 3, 2, 4, C.WALKABLE);
fillRect(tiles, 26, 3, 4, 2, T.PATH);
fillRect(collisions, 26, 3, 4, 2, C.WALKABLE);

// Tall grass patches
fillRect(tiles, 1, 1, 4, 3, T.TALL_GRASS);
fillRect(collisions, 1, 1, 4, 3, C.TALL_GRASS);
fillRect(tiles, 1, 6, 5, 3, T.TALL_GRASS);
fillRect(collisions, 1, 6, 5, 3, C.TALL_GRASS);
fillRect(tiles, 10, 5, 5, 4, T.TALL_GRASS);
fillRect(collisions, 10, 5, 5, 4, C.TALL_GRASS);
fillRect(tiles, 18, 1, 5, 4, T.TALL_GRASS);
fillRect(collisions, 18, 1, 5, 4, C.TALL_GRASS);
fillRect(tiles, 24, 6, 4, 3, T.TALL_GRASS);
fillRect(collisions, 24, 6, 4, 3, C.TALL_GRASS);

// Ledges
fillRow(tiles, 6, 6, 4, T.LEDGE_SOUTH);
fillRow(collisions, 6, 6, 4, C.LEDGE_SOUTH);
fillRow(tiles, 17, 5, 6, T.LEDGE_SOUTH);
fillRow(collisions, 17, 5, 6, C.LEDGE_SOUTH);

// Trees scattered
setTile(tiles, 12, 1, T.TREE);
setTile(collisions, 12, 1, C.SOLID);
setTile(tiles, 23, 2, T.TREE);
setTile(collisions, 23, 2, C.SOLID);

// Pokemon Center near east end
setTile(tiles, 27, 5, T.ROOF_RED);
setTile(collisions, 27, 5, C.SOLID);
setTile(tiles, 28, 5, T.ROOF_RED);
setTile(collisions, 28, 5, C.SOLID);
setTile(tiles, 27, 6, T.BUILDING_WALL);
setTile(collisions, 27, 6, C.SOLID);
setTile(tiles, 28, 6, T.DOOR);
setTile(collisions, 28, 6, C.WARP);

// East exit to Route 4 / Mt. Moon
fillCol(tiles, w - 1, 3, 4, T.TREE);
fillCol(collisions, w - 1, 3, 4, C.SOLID);
setTile(tiles, w - 1, 3, T.PATH);
setTile(collisions, w - 1, 3, C.WALKABLE);
setTile(tiles, w - 1, 4, T.PATH);
setTile(collisions, w - 1, 4, C.WALKABLE);

export const route3: GameMap = {
  id: 'route-3',
  name: 'ROUTE 3',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 28, y: 6, targetMap: 'route3-pokecenter', targetX: 2, targetY: 3 },
  ],
  npcs: [],
  wildEncounters: [
    { speciesId: 16, levelMin: 6, levelMax: 8, rate: 60 },   // Pidgey
    { speciesId: 21, levelMin: 6, levelMax: 8, rate: 80 },   // Spearow
    { speciesId: 39, levelMin: 3, levelMax: 7, rate: 15 },   // Jigglypuff
    { speciesId: 27, levelMin: 6, levelMax: 8, rate: 50 },   // Sandshrew
    { speciesId: 23, levelMin: 6, levelMax: 8, rate: 51 },   // Ekans
  ],
  trainerPlacements: [
    { trainerId: 'bug-catcher-4', x: 5, y: 3, facing: 'down', sightRange: 2, flag: 'r3-trainer-1' },
    { trainerId: 'bug-catcher-5', x: 9, y: 4, facing: 'left', sightRange: 3, flag: 'r3-trainer-2' },
    { trainerId: 'bug-catcher-6', x: 14, y: 7, facing: 'up', sightRange: 3, flag: 'r3-trainer-3' },
    { trainerId: 'lass-1', x: 12, y: 2, facing: 'down', sightRange: 2, flag: 'r3-trainer-4' },
    { trainerId: 'lass-2', x: 20, y: 3, facing: 'left', sightRange: 3, flag: 'r3-trainer-5' },
    { trainerId: 'youngster-1', x: 23, y: 7, facing: 'up', sightRange: 4, flag: 'r3-trainer-6' },
  ],
  itemBalls: [],
  signs: [],
  connections: [
    { direction: 'left', mapId: 'pewter-city', offset: 0 },
    { direction: 'right', mapId: 'route-4', offset: 1 },
  ],
  music: 'route-3',
};
