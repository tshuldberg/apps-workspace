// === Routes 11-15 ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

// === Route 11 — Vermilion east ===
function makeRoute11(): GameMap {
  const w = 25, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  fillRect(tiles, 3, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 3, 1, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 12, 6, 5, 3, T.TALL_GRASS); fillRect(collisions, 12, 6, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 19, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 19, 1, 4, 3, C.TALL_GRASS);
  // Diglett's Cave entrance at east end
  fillRect(tiles, 22, 6, 2, 2, T.CAVE_WALL); fillRect(collisions, 22, 6, 2, 2, C.SOLID);
  setTile(tiles, 23, 7, T.DOOR); setTile(collisions, 23, 7, C.WARP);
  return {
    id: 'route-11', name: 'ROUTE 11', width: w, height: h, tiles, collisions,
    warps: [
      { x: 23, y: 7, targetMap: 'digletts-cave', targetX: 1, targetY: 1 },
    ],
    npcs: [
      { id: 'r11-aide', x: 22, y: 4, spriteId: 'scientist', facing: 'left', movement: 'stationary',
        dialogue: ['Prof. OAK\'s aide is in the gate ahead.', 'If you\'ve caught 30+ POKeMON, he has something for you!'] },
    ],
    wildEncounters: [
      { speciesId: 21, levelMin: 13, levelMax: 17, rate: 70 },
      { speciesId: 23, levelMin: 12, levelMax: 15, rate: 50 },
      { speciesId: 96, levelMin: 9, levelMax: 17, rate: 50 },   // Drowzee
      { speciesId: 19, levelMin: 13, levelMax: 17, rate: 86 },
    ],
    trainerPlacements: [
      { trainerId: 'youngster-4', x: 5, y: 4, facing: 'right', sightRange: 3, flag: 'r11-youngster-1' },
      { trainerId: 'youngster-5', x: 10, y: 5, facing: 'left', sightRange: 3, flag: 'r11-youngster-2' },
      { trainerId: 'gambler-3', x: 15, y: 4, facing: 'right', sightRange: 4, flag: 'r11-gambler' },
      { trainerId: 'engineer-1', x: 18, y: 5, facing: 'left', sightRange: 3, flag: 'r11-engineer' },
    ],
    itemBalls: [],
    signs: [], connections: [
      { direction: 'left', mapId: 'vermilion-city', offset: 0 },
      { direction: 'right', mapId: 'route-12', offset: 0 },
    ],
    music: 'route-11',
  };
}

// === Route 12 — Lavender south (fishing route with Snorlax) ===
function makeRoute12(): GameMap {
  const w = 10, h = 30;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  // Water areas
  fillRect(tiles, 1, 3, 3, 5, T.WATER); fillRect(collisions, 1, 3, 3, 5, C.WATER);
  fillRect(tiles, 6, 6, 3, 4, T.WATER); fillRect(collisions, 6, 6, 3, 4, C.WATER);
  fillRect(tiles, 1, 15, 3, 4, T.WATER); fillRect(collisions, 1, 15, 3, 4, C.WATER);
  // Tall grass
  fillRect(tiles, 6, 12, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 12, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 1, 22, 3, 4, T.TALL_GRASS); fillRect(collisions, 1, 22, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 6, 20, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 20, 3, 4, C.TALL_GRASS);
  // East/west route seams
  setTile(tiles, 0, 4, T.PATH); setTile(collisions, 0, 4, C.WALKABLE);
  setTile(tiles, 0, 5, T.PATH); setTile(collisions, 0, 5, C.WALKABLE);
  setTile(tiles, w - 1, 4, T.PATH); setTile(collisions, w - 1, 4, C.WALKABLE);
  setTile(tiles, w - 1, 5, T.PATH); setTile(collisions, w - 1, 5, C.WALKABLE);
  // Snorlax blocking path
  setTile(tiles, 4, 10, T.BOULDER); setTile(collisions, 4, 10, C.SOLID);
  return {
    id: 'route-12', name: 'ROUTE 12', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [
      { id: 'r12-fisherman', x: 3, y: 9, spriteId: 'fisher', facing: 'left', movement: 'stationary',
        dialogue: ['I love fishing!', 'Here, take this SUPER ROD!'] },
    ],
    wildEncounters: [
      { speciesId: 16, levelMin: 23, levelMax: 27, rate: 50 },
      { speciesId: 43, levelMin: 22, levelMax: 26, rate: 50 },
      { speciesId: 48, levelMin: 24, levelMax: 26, rate: 50 },   // Venonat
      { speciesId: 69, levelMin: 22, levelMax: 26, rate: 50 },   // Bellsprout
    ],
    trainerPlacements: [
      { trainerId: 'fisher-1', x: 2, y: 6, facing: 'right', sightRange: 2, flag: 'r12-fisher-1' },
      { trainerId: 'fisher-2', x: 2, y: 18, facing: 'right', sightRange: 2, flag: 'r12-fisher-2' },
      { trainerId: 'youngster-6', x: 6, y: 14, facing: 'left', sightRange: 3, flag: 'r12-youngster' },
    ],
    itemBalls: [
      { x: 8, y: 25, itemId: 22, quantity: 1, flag: 'r12-tm' },
    ],
    signs: [], connections: [
      { direction: 'north', mapId: 'lavender-town', offset: 0 },
      { direction: 'south', mapId: 'route-13', offset: 0 },
    ],
    music: 'route-12',
  };
}

// === Route 13 — South coast east ===
function makeRoute13(): GameMap {
  const w = 25, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  // South water edge
  fillRow(tiles, 0, h - 1, w, T.WATER_EDGE); fillRow(collisions, 0, h - 1, w, C.WATER);
  fillRow(tiles, 0, h - 2, w, T.WATER); fillRow(collisions, 0, h - 2, w, C.WATER);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  fillRect(tiles, 3, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 3, 1, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 12, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 12, 1, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 19, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 19, 1, 4, 3, C.TALL_GRASS);
  // Route seams (north and both horizontal edges)
  setTile(tiles, 4, 0, T.PATH); setTile(collisions, 4, 0, C.WALKABLE);
  setTile(tiles, 5, 0, T.PATH); setTile(collisions, 5, 0, C.WALKABLE);
  setTile(tiles, 0, 4, T.PATH); setTile(collisions, 0, 4, C.WALKABLE);
  setTile(tiles, 0, 5, T.PATH); setTile(collisions, 0, 5, C.WALKABLE);
  setTile(tiles, w - 1, 4, T.PATH); setTile(collisions, w - 1, 4, C.WALKABLE);
  setTile(tiles, w - 1, 5, T.PATH); setTile(collisions, w - 1, 5, C.WALKABLE);
  return {
    id: 'route-13', name: 'ROUTE 13', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 43, levelMin: 22, levelMax: 26, rate: 60 },
      { speciesId: 69, levelMin: 22, levelMax: 26, rate: 60 },
      { speciesId: 16, levelMin: 25, levelMax: 27, rate: 50 },
      { speciesId: 132, levelMin: 25, levelMax: 28, rate: 10 },  // Ditto
    ],
    trainerPlacements: [
      { trainerId: 'bird-keeper-1', x: 5, y: 3, facing: 'down', sightRange: 3, flag: 'r13-bird-1' },
      { trainerId: 'beauty-3', x: 10, y: 4, facing: 'right', sightRange: 3, flag: 'r13-beauty' },
      { trainerId: 'biker-1', x: 16, y: 5, facing: 'left', sightRange: 4, flag: 'r13-biker' },
    ],
    itemBalls: [],
    signs: [], connections: [
      { direction: 'right', mapId: 'route-12', offset: 0 },
      { direction: 'left', mapId: 'route-14', offset: 0 },
    ],
    music: 'route-13',
  };
}

// === Route 14 — South coast center ===
function makeRoute14(): GameMap {
  const w = 10, h = 20;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  fillRect(tiles, 1, 3, 3, 5, T.TALL_GRASS); fillRect(collisions, 1, 3, 3, 5, C.TALL_GRASS);
  fillRect(tiles, 6, 6, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 6, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 1, 13, 3, 4, T.TALL_GRASS); fillRect(collisions, 1, 13, 3, 4, C.TALL_GRASS);
  // East/west route seams
  setTile(tiles, 0, 4, T.PATH); setTile(collisions, 0, 4, C.WALKABLE);
  setTile(tiles, 0, 5, T.PATH); setTile(collisions, 0, 5, C.WALKABLE);
  setTile(tiles, w - 1, 4, T.PATH); setTile(collisions, w - 1, 4, C.WALKABLE);
  setTile(tiles, w - 1, 5, T.PATH); setTile(collisions, w - 1, 5, C.WALKABLE);
  return {
    id: 'route-14', name: 'ROUTE 14', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 43, levelMin: 24, levelMax: 28, rate: 60 },
      { speciesId: 69, levelMin: 24, levelMax: 28, rate: 60 },
      { speciesId: 48, levelMin: 26, levelMax: 30, rate: 50 },
      { speciesId: 132, levelMin: 23, levelMax: 30, rate: 10 },
    ],
    trainerPlacements: [
      { trainerId: 'bird-keeper-2', x: 3, y: 5, facing: 'right', sightRange: 3, flag: 'r14-bird-1' },
      { trainerId: 'biker-2', x: 6, y: 8, facing: 'left', sightRange: 3, flag: 'r14-biker' },
      { trainerId: 'bird-keeper-3', x: 3, y: 14, facing: 'right', sightRange: 3, flag: 'r14-bird-2' },
    ],
    itemBalls: [],
    signs: [], connections: [
      { direction: 'north', mapId: 'route-13', offset: 0 },
      { direction: 'south', mapId: 'route-15', offset: 0 },
    ],
    music: 'route-14',
  };
}

// === Route 15 — South coast to Fuchsia ===
function makeRoute15(): GameMap {
  const w = 25, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  fillRect(tiles, 3, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 3, 1, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 12, 6, 5, 3, T.TALL_GRASS); fillRect(collisions, 12, 6, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 19, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 19, 1, 4, 3, C.TALL_GRASS);
  // North/south seam with Route 14
  setTile(tiles, 4, 0, T.PATH); setTile(collisions, 4, 0, C.WALKABLE);
  setTile(tiles, 5, 0, T.PATH); setTile(collisions, 5, 0, C.WALKABLE);
  return {
    id: 'route-15', name: 'ROUTE 15', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 43, levelMin: 24, levelMax: 28, rate: 60 },
      { speciesId: 69, levelMin: 24, levelMax: 28, rate: 60 },
      { speciesId: 48, levelMin: 26, levelMax: 30, rate: 50 },
      { speciesId: 132, levelMin: 23, levelMax: 30, rate: 10 },
    ],
    trainerPlacements: [
      { trainerId: 'beauty-4', x: 6, y: 4, facing: 'right', sightRange: 3, flag: 'r15-beauty' },
      { trainerId: 'bird-keeper-4', x: 14, y: 5, facing: 'left', sightRange: 3, flag: 'r15-bird' },
      { trainerId: 'biker-3', x: 20, y: 4, facing: 'left', sightRange: 4, flag: 'r15-biker' },
    ],
    itemBalls: [
      { x: 22, y: 2, itemId: 22, quantity: 1, flag: 'r15-tm' },
    ],
    signs: [], connections: [
      { direction: 'right', mapId: 'route-14', offset: 0 },
      { direction: 'left', mapId: 'fuchsia-city', offset: 0 },
    ],
    music: 'route-15',
  };
}

export const route11 = makeRoute11();
export const route12 = makeRoute12();
export const route13 = makeRoute13();
export const route14 = makeRoute14();
export const route15 = makeRoute15();
