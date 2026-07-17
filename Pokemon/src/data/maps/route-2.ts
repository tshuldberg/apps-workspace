// === Route 2 — Viridian City to Pewter City (through Viridian Forest) ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

const w = 10, h = 25;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree borders
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// Central path
fillRect(tiles, 4, 0, 2, h, T.PATH);
fillRect(collisions, 4, 0, 2, h, C.WALKABLE);

// Viridian Forest entrance (building structure mid-route)
fillRect(tiles, 3, 10, 4, 2, T.BUILDING_WALL);
fillRect(collisions, 3, 10, 4, 2, C.SOLID);
setTile(tiles, 5, 11, T.DOOR);
setTile(collisions, 5, 11, C.WARP);
setTile(tiles, 4, 10, T.DOOR);
setTile(collisions, 4, 10, C.WARP);

// Tall grass patches
fillRect(tiles, 1, 2, 3, 4, T.TALL_GRASS);
fillRect(collisions, 1, 2, 3, 4, C.TALL_GRASS);
fillRect(tiles, 6, 3, 3, 3, T.TALL_GRASS);
fillRect(collisions, 6, 3, 3, 3, C.TALL_GRASS);

fillRect(tiles, 1, 14, 3, 4, T.TALL_GRASS);
fillRect(collisions, 1, 14, 3, 4, C.TALL_GRASS);
fillRect(tiles, 6, 15, 3, 3, T.TALL_GRASS);
fillRect(collisions, 6, 15, 3, 3, C.TALL_GRASS);

fillRect(tiles, 2, 20, 2, 3, T.TALL_GRASS);
fillRect(collisions, 2, 20, 2, 3, C.TALL_GRASS);
fillRect(tiles, 6, 20, 3, 3, T.TALL_GRASS);
fillRect(collisions, 6, 20, 3, 3, C.TALL_GRASS);

// Extra trees
setTile(tiles, 3, 7, T.TREE);
setTile(collisions, 3, 7, C.SOLID);
setTile(tiles, 7, 8, T.TREE);
setTile(collisions, 7, 8, C.SOLID);

// Ledge
fillRow(tiles, 1, 19, 3, T.LEDGE_SOUTH);
fillRow(collisions, 1, 19, 3, C.LEDGE_SOUTH);

// Cut tree (Diglett's Cave access later)
setTile(tiles, 7, 22, T.CUT_TREE);
setTile(collisions, 7, 22, C.CUT_TREE);

export const route2: GameMap = {
  id: 'route-2',
  name: 'ROUTE 2',
  width: w, height: h,
  tiles, collisions,
  warps: [
    // Forest south entrance (going in)
    { x: 5, y: 11, targetMap: 'viridian-forest', targetX: 7, targetY: 29 },
    // Forest north exit (coming out)
    { x: 4, y: 10, targetMap: 'viridian-forest', targetX: 1, targetY: 0 },
  ],
  npcs: [
    {
      id: 'route2-boy', x: 3, y: 17, spriteId: 'boy', facing: 'up',
      movement: 'stationary',
      dialogue: ['The forest up ahead is a natural maze.', 'Be sure you have plenty of POKeBOLLS!'],
    },
  ],
  wildEncounters: [
    { speciesId: 16, levelMin: 3, levelMax: 5, rate: 80 },   // Pidgey
    { speciesId: 19, levelMin: 3, levelMax: 5, rate: 80 },   // Rattata
    { speciesId: 10, levelMin: 3, levelMax: 5, rate: 50 },   // Caterpie
    { speciesId: 13, levelMin: 3, levelMax: 5, rate: 46 },   // Weedle
  ],
  trainerPlacements: [],
  itemBalls: [],
  signs: [],
  connections: [
    { direction: 'south', mapId: 'viridian-city', offset: 0 },
    { direction: 'north', mapId: 'pewter-city', offset: 0 },
  ],
  music: 'route-2',
};
