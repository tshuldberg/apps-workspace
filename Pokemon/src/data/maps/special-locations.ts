// === Special locations: Underground paths, Bill's house, misc ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, makePokemonCenter, T, C } from './map-helpers.ts';

// === Underground Path (North-South: Route 5 to Route 6) ===
const unsW = 3, unsH = 20;
const unsT = makeGrid(unsW, unsH, T.CAVE_FLOOR);
const unsC = makeGrid(unsW, unsH, C.WALKABLE);
fillCol(unsT, 0, 0, unsH, T.CAVE_WALL); fillCol(unsC, 0, 0, unsH, C.SOLID);
fillCol(unsT, unsW - 1, 0, unsH, T.CAVE_WALL); fillCol(unsC, unsW - 1, 0, unsH, C.SOLID);
setTile(unsT, 1, 0, T.STAIRS_UP); setTile(unsC, 1, 0, C.WARP);
setTile(unsT, 1, unsH - 1, T.STAIRS_UP); setTile(unsC, 1, unsH - 1, C.WARP);

export const undergroundPathNS: GameMap = {
  id: 'underground-path-ns', name: 'UNDERGROUND PATH',
  width: unsW, height: unsH, tiles: unsT, collisions: unsC,
  warps: [
    { x: 1, y: 0, targetMap: 'route-5', targetX: 7, targetY: 17 },
    { x: 1, y: unsH - 1, targetMap: 'route-6', targetX: 7, targetY: 4 },
  ],
  npcs: [], wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [], music: 'underground',
};

// === Underground Path (East-West: Route 7 to Route 8) ===
const uewW = 20, uewH = 3;
const uewT = makeGrid(uewW, uewH, T.CAVE_FLOOR);
const uewC = makeGrid(uewW, uewH, C.WALKABLE);
fillRow(uewT, 0, 0, uewW, T.CAVE_WALL); fillRow(uewC, 0, 0, uewW, C.SOLID);
fillRow(uewT, 0, uewH - 1, uewW, T.CAVE_WALL); fillRow(uewC, 0, uewH - 1, uewW, C.SOLID);
setTile(uewT, 0, 1, T.STAIRS_UP); setTile(uewC, 0, 1, C.WARP);
setTile(uewT, uewW - 1, 1, T.STAIRS_UP); setTile(uewC, uewW - 1, 1, C.WARP);

export const undergroundPathEW: GameMap = {
  id: 'underground-path-ew', name: 'UNDERGROUND PATH',
  width: uewW, height: uewH, tiles: uewT, collisions: uewC,
  warps: [
    { x: 0, y: 1, targetMap: 'route-7', targetX: 6, targetY: 9 },
    { x: uewW - 1, y: 1, targetMap: 'route-8', targetX: 19, targetY: 8 },
  ],
  npcs: [], wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [], music: 'underground',
};

// === Bill's House ===
const billW = 4, billH = 3;
const billT = makeGrid(billW, billH, T.FLOOR);
const billC = makeGrid(billW, billH, C.WALKABLE);
setTile(billT, 0, 0, T.SHELF); setTile(billC, 0, 0, C.SOLID);
setTile(billT, 1, 0, T.SHELF); setTile(billC, 1, 0, C.SOLID);
setTile(billT, 3, 0, T.PC_TERMINAL); setTile(billC, 3, 0, C.SOLID);
setTile(billT, 3, 2, T.DOOR); setTile(billC, 3, 2, C.WARP);

export const billsHouse: GameMap = {
  id: 'bills-house', name: 'BILL\'S HOUSE',
  width: billW, height: billH, tiles: billT, collisions: billC,
  warps: [
    { x: 3, y: 2, targetMap: 'route-25', targetX: 17, targetY: 5 },
  ],
  npcs: [
    {
      id: 'bill', x: 2, y: 0, spriteId: 'scientist', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'BILL: Hi! I\'m a POKeMON researcher!',
        'I got mixed up with a POKeMON in a teleporter experiment!',
        'Could you help me out?',
        'Thanks! Here, take this S.S. TICKET as a reward!',
      ],
    },
  ],
  wildEncounters: [], trainerPlacements: [],
  itemBalls: [],
  signs: [], connections: [],
  music: 'house',
};

// === Route 10 Pokemon Center ===
export const route10Pokecenter: GameMap = makePokemonCenter(
  'route10-pokecenter', 'route-10', 2, 4,
);
