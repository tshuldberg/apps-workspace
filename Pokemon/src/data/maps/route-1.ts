// === Route 1 — Pallet Town to Viridian City ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

const w = 10, h = 30;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree borders on left and right
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// Central path
fillRect(tiles, 4, 0, 2, h, T.PATH);
fillRect(collisions, 4, 0, 2, h, C.WALKABLE);

// Tall grass patches on sides
fillRect(tiles, 1, 3, 3, 4, T.TALL_GRASS);
fillRect(collisions, 1, 3, 3, 4, C.TALL_GRASS);
fillRect(tiles, 6, 3, 3, 4, T.TALL_GRASS);
fillRect(collisions, 6, 3, 3, 4, C.TALL_GRASS);

fillRect(tiles, 1, 10, 3, 5, T.TALL_GRASS);
fillRect(collisions, 1, 10, 3, 5, C.TALL_GRASS);
fillRect(tiles, 6, 12, 3, 4, T.TALL_GRASS);
fillRect(collisions, 6, 12, 3, 4, C.TALL_GRASS);

fillRect(tiles, 1, 19, 3, 4, T.TALL_GRASS);
fillRect(collisions, 1, 19, 3, 4, C.TALL_GRASS);
fillRect(tiles, 6, 20, 3, 3, T.TALL_GRASS);
fillRect(collisions, 6, 20, 3, 3, C.TALL_GRASS);

fillRect(tiles, 2, 25, 2, 3, T.TALL_GRASS);
fillRect(collisions, 2, 25, 2, 3, C.TALL_GRASS);
fillRect(tiles, 6, 25, 3, 3, T.TALL_GRASS);
fillRect(collisions, 6, 25, 3, 3, C.TALL_GRASS);

// Ledges for one-way shortcuts going south
fillRow(tiles, 1, 8, 3, T.LEDGE_SOUTH);
fillRow(collisions, 1, 8, 3, C.LEDGE_SOUTH);
fillRow(tiles, 6, 17, 3, T.LEDGE_SOUTH);
fillRow(collisions, 6, 17, 3, C.LEDGE_SOUTH);

// A few extra trees for variety
setTile(tiles, 2, 16, T.TREE);
setTile(collisions, 2, 16, C.SOLID);
setTile(tiles, 7, 9, T.TREE);
setTile(collisions, 7, 9, C.SOLID);

export const route1: GameMap = {
  id: 'route-1',
  name: 'ROUTE 1',
  width: w, height: h,
  tiles, collisions,
  warps: [],
  npcs: [
    {
      id: 'route1-man', x: 3, y: 15, spriteId: 'boy', facing: 'left',
      movement: 'stationary',
      dialogue: ['POKeMON live in tall grass.', 'You need your own POKeMON to go through safely.'],
    },
  ],
  wildEncounters: [
    { speciesId: 16, levelMin: 2, levelMax: 5, rate: 128 },  // Pidgey
    { speciesId: 19, levelMin: 2, levelMax: 4, rate: 128 },  // Rattata
  ],
  trainerPlacements: [],
  itemBalls: [
    { x: 7, y: 5, itemId: 17, quantity: 1, flag: 'route1-potion' },  // Potion
  ],
  signs: [],
  connections: [
    { direction: 'south', mapId: 'pallet-town', offset: 0 },
    { direction: 'north', mapId: 'viridian-city', offset: 0 },
  ],
  music: 'route-1',
};
