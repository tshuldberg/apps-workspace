// === Routes 5-10 ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

// === Route 5 — Cerulean to Saffron ===
function makeRoute5(): GameMap {
  const w = 10, h = 20;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  // Tall grass
  fillRect(tiles, 1, 5, 3, 4, T.TALL_GRASS); fillRect(collisions, 1, 5, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 6, 8, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 8, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 1, 14, 3, 3, T.TALL_GRASS); fillRect(collisions, 1, 14, 3, 3, C.TALL_GRASS);
  // Underground path entrance
  placeBuilding(tiles, collisions, 6, 15, 3, 2, T.ROOF_BLUE);
  return {
    id: 'route-5', name: 'ROUTE 5', width: w, height: h, tiles, collisions,
    warps: [{ x: 7, y: 16, targetMap: 'underground-path-ns', targetX: 1, targetY: 1 }],
    npcs: [{ id: 'r5-girl', x: 3, y: 10, spriteId: 'girl', facing: 'right', movement: 'stationary',
      dialogue: ['The gate to SAFFRON is closed!', 'But you can use the underground path.'] }],
    wildEncounters: [
      { speciesId: 16, levelMin: 13, levelMax: 16, rate: 80 },
      { speciesId: 52, levelMin: 10, levelMax: 16, rate: 60 },  // Meowth
      { speciesId: 43, levelMin: 13, levelMax: 16, rate: 70 },  // Oddish
      { speciesId: 69, levelMin: 13, levelMax: 16, rate: 46 },  // Bellsprout
    ],
    trainerPlacements: [], itemBalls: [],
    signs: [], connections: [
      { direction: 'north', mapId: 'cerulean-city', offset: 0 },
      { direction: 'south', mapId: 'saffron-city', offset: 0 },
    ],
    music: 'route-5',
  };
}

// === Route 6 — Saffron to Vermilion ===
function makeRoute6(): GameMap {
  const w = 10, h = 20;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  fillRect(tiles, 1, 3, 3, 5, T.TALL_GRASS); fillRect(collisions, 1, 3, 3, 5, C.TALL_GRASS);
  fillRect(tiles, 6, 6, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 6, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 1, 13, 3, 4, T.TALL_GRASS); fillRect(collisions, 1, 13, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 6, 14, 3, 3, T.TALL_GRASS); fillRect(collisions, 6, 14, 3, 3, C.TALL_GRASS);
  // Underground path exit
  placeBuilding(tiles, collisions, 6, 2, 3, 2, T.ROOF_BLUE);
  return {
    id: 'route-6', name: 'ROUTE 6', width: w, height: h, tiles, collisions,
    warps: [{ x: 7, y: 3, targetMap: 'underground-path-ns', targetX: 1, targetY: 18 }],
    npcs: [],
    wildEncounters: [
      { speciesId: 16, levelMin: 13, levelMax: 16, rate: 80 },
      { speciesId: 52, levelMin: 10, levelMax: 16, rate: 60 },
      { speciesId: 43, levelMin: 13, levelMax: 16, rate: 70 },
      { speciesId: 69, levelMin: 13, levelMax: 16, rate: 46 },
    ],
    trainerPlacements: [
      { trainerId: 'bug-catcher-8', x: 3, y: 6, facing: 'right', sightRange: 3, flag: 'r6-bug' },
      { trainerId: 'youngster-2', x: 6, y: 10, facing: 'left', sightRange: 3, flag: 'r6-youngster' },
    ],
    itemBalls: [],
    signs: [], connections: [
      { direction: 'north', mapId: 'saffron-city', offset: 0 },
      { direction: 'south', mapId: 'vermilion-city', offset: 0 },
    ],
    music: 'route-6',
  };
}

// === Route 7 — Saffron to Celadon ===
function makeRoute7(): GameMap {
  const w = 15, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  fillRect(tiles, 1, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 1, 1, 4, 3, C.TALL_GRASS);
  fillRect(tiles, 8, 6, 4, 3, T.TALL_GRASS); fillRect(collisions, 8, 6, 4, 3, C.TALL_GRASS);
  // Underground path entrance
  placeBuilding(tiles, collisions, 5, 7, 3, 2, T.ROOF_BLUE);
  return {
    id: 'route-7', name: 'ROUTE 7', width: w, height: h, tiles, collisions,
    warps: [{ x: 6, y: 8, targetMap: 'underground-path-ew', targetX: 1, targetY: 1 }],
    npcs: [],
    wildEncounters: [
      { speciesId: 37, levelMin: 18, levelMax: 22, rate: 40 },   // Vulpix
      { speciesId: 43, levelMin: 19, levelMax: 22, rate: 60 },   // Oddish
      { speciesId: 52, levelMin: 17, levelMax: 20, rate: 60 },   // Meowth
      { speciesId: 58, levelMin: 18, levelMax: 22, rate: 40 },   // Growlithe
    ],
    trainerPlacements: [], itemBalls: [],
    signs: [], connections: [
      { direction: 'left', mapId: 'celadon-city', offset: 0 },
      { direction: 'right', mapId: 'saffron-city', offset: 0 },
    ],
    music: 'route-7',
  };
}

// === Route 8 — Saffron to Lavender ===
function makeRoute8(): GameMap {
  const w = 25, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  fillRect(tiles, 2, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 2, 1, 4, 3, C.TALL_GRASS);
  fillRect(tiles, 10, 6, 5, 3, T.TALL_GRASS); fillRect(collisions, 10, 6, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 18, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 18, 1, 4, 3, C.TALL_GRASS);
  // Underground path exit
  placeBuilding(tiles, collisions, 18, 6, 3, 2, T.ROOF_BLUE);
  return {
    id: 'route-8', name: 'ROUTE 8', width: w, height: h, tiles, collisions,
    warps: [{ x: 19, y: 7, targetMap: 'underground-path-ew', targetX: 1, targetY: 18 }],
    npcs: [],
    wildEncounters: [
      { speciesId: 37, levelMin: 18, levelMax: 22, rate: 40 },
      { speciesId: 52, levelMin: 18, levelMax: 22, rate: 60 },
      { speciesId: 58, levelMin: 18, levelMax: 22, rate: 40 },
      { speciesId: 56, levelMin: 18, levelMax: 22, rate: 50 },   // Mankey
    ],
    trainerPlacements: [
      { trainerId: 'gambler-1', x: 6, y: 4, facing: 'right', sightRange: 4, flag: 'r8-gambler-1' },
      { trainerId: 'gambler-2', x: 12, y: 5, facing: 'left', sightRange: 4, flag: 'r8-gambler-2' },
      { trainerId: 'lass-6', x: 9, y: 3, facing: 'down', sightRange: 2, flag: 'r8-lass' },
      { trainerId: 'super-nerd-4', x: 16, y: 5, facing: 'left', sightRange: 3, flag: 'r8-nerd' },
    ],
    itemBalls: [],
    signs: [], connections: [
      { direction: 'left', mapId: 'saffron-city', offset: 0 },
      { direction: 'right', mapId: 'lavender-town', offset: 0 },
    ],
    music: 'route-8',
  };
}

// === Route 9 — Cerulean to Rock Tunnel ===
function makeRoute9(): GameMap {
  const w = 25, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  // Winding path with tall grass
  fillRect(tiles, 3, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 3, 1, 4, 3, C.TALL_GRASS);
  fillRect(tiles, 10, 6, 5, 3, T.TALL_GRASS); fillRect(collisions, 10, 6, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 18, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 18, 1, 5, 3, C.TALL_GRASS);
  // Ledges
  fillRow(tiles, 8, 3, 4, T.LEDGE_SOUTH); fillRow(collisions, 8, 3, 4, C.LEDGE_SOUTH);

  // North/south connection seam with Route 10
  setTile(tiles, 4, h - 1, T.PATH); setTile(collisions, 4, h - 1, C.WALKABLE);
  setTile(tiles, 5, h - 1, T.PATH); setTile(collisions, 5, h - 1, C.WALKABLE);
  return {
    id: 'route-9', name: 'ROUTE 9', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 21, levelMin: 16, levelMax: 20, rate: 70 },   // Spearow
      { speciesId: 19, levelMin: 14, levelMax: 17, rate: 60 },   // Rattata
      { speciesId: 23, levelMin: 11, levelMax: 17, rate: 50 },   // Ekans
      { speciesId: 100, levelMin: 14, levelMax: 17, rate: 30 },  // Voltorb
    ],
    trainerPlacements: [
      { trainerId: 'hiker-3', x: 6, y: 4, facing: 'right', sightRange: 3, flag: 'r9-hiker-1' },
      { trainerId: 'hiker-4', x: 14, y: 5, facing: 'left', sightRange: 3, flag: 'r9-hiker-2' },
      { trainerId: 'youngster-3', x: 9, y: 7, facing: 'up', sightRange: 3, flag: 'r9-youngster' },
      { trainerId: 'bug-catcher-9', x: 20, y: 4, facing: 'left', sightRange: 4, flag: 'r9-bug' },
    ],
    itemBalls: [
      { x: 23, y: 2, itemId: 22, quantity: 1, flag: 'r9-tm' },
    ],
    signs: [], connections: [
      { direction: 'left', mapId: 'cerulean-city', offset: 0 },
      { direction: 'right', mapId: 'route-10', offset: 0 },
    ],
    music: 'route-9',
  };
}

// === Route 10 — Rock Tunnel to Lavender ===
function makeRoute10(): GameMap {
  const w = 10, h = 25;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  // Rock Tunnel entrance
  fillRect(tiles, 3, 5, 4, 2, T.CAVE_WALL); fillRect(collisions, 3, 5, 4, 2, C.SOLID);
  setTile(tiles, 5, 6, T.DOOR); setTile(collisions, 5, 6, C.WARP);
  // Pokemon Center near tunnel
  placeBuilding(tiles, collisions, 1, 2, 3, 2, T.ROOF_RED);
  // Power Plant entrance (requires Surf)
  fillRect(tiles, 7, 1, 2, 3, T.WATER); fillRect(collisions, 7, 1, 2, 3, C.WATER);
  placeBuilding(tiles, collisions, 7, 4, 2, 2, T.ROOF_BLUE);
  // Tall grass
  fillRect(tiles, 1, 8, 3, 5, T.TALL_GRASS); fillRect(collisions, 1, 8, 3, 5, C.TALL_GRASS);
  fillRect(tiles, 6, 10, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 10, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 1, 16, 3, 4, T.TALL_GRASS); fillRect(collisions, 1, 16, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 6, 18, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 18, 3, 4, C.TALL_GRASS);

  // West edge connection from Route 9
  setTile(tiles, 0, 4, T.PATH); setTile(collisions, 0, 4, C.WALKABLE);
  setTile(tiles, 0, 5, T.PATH); setTile(collisions, 0, 5, C.WALKABLE);
  return {
    id: 'route-10', name: 'ROUTE 10', width: w, height: h, tiles, collisions,
    warps: [
      { x: 5, y: 6, targetMap: 'rock-tunnel-1f', targetX: 1, targetY: 1 },
      { x: 2, y: 3, targetMap: 'route10-pokecenter', targetX: 2, targetY: 3 },
      { x: 8, y: 5, targetMap: 'power-plant', targetX: 1, targetY: 14 },
    ],
    npcs: [],
    wildEncounters: [
      { speciesId: 21, levelMin: 16, levelMax: 22, rate: 60 },
      { speciesId: 100, levelMin: 14, levelMax: 19, rate: 80 },  // Voltorb
      { speciesId: 81, levelMin: 16, levelMax: 22, rate: 50 },   // Magnemite
      { speciesId: 21, levelMin: 16, levelMax: 20, rate: 66 },   // Spearow
    ],
    trainerPlacements: [
      { trainerId: 'hiker-5', x: 3, y: 14, facing: 'right', sightRange: 3, flag: 'r10-hiker' },
      { trainerId: 'pokemaniac-1', x: 6, y: 16, facing: 'left', sightRange: 3, flag: 'r10-maniac' },
    ],
    itemBalls: [],
    signs: [], connections: [
      { direction: 'north', mapId: 'route-9', offset: 0 },
      { direction: 'south', mapId: 'lavender-town', offset: 0 },
    ],
    music: 'route-10',
  };
}

export const route5 = makeRoute5();
export const route6 = makeRoute6();
export const route7 = makeRoute7();
export const route8 = makeRoute8();
export const route9 = makeRoute9();
export const route10 = makeRoute10();
