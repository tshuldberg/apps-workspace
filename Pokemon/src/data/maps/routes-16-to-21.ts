// === Routes 16-21 ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

// === Route 16 — Celadon west, Cycling Road entrance (Snorlax blocks) ===
function makeRoute16(): GameMap {
  const w = 15, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  // Snorlax blocking
  setTile(tiles, 6, 4, T.BOULDER); setTile(collisions, 6, 4, C.SOLID);
  fillRect(tiles, 1, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 1, 1, 4, 3, C.TALL_GRASS);
  fillRect(tiles, 9, 6, 4, 3, T.TALL_GRASS); fillRect(collisions, 9, 6, 4, 3, C.TALL_GRASS);
  // Cut tree for shortcut
  setTile(tiles, 3, 6, T.CUT_TREE); setTile(collisions, 3, 6, C.CUT_TREE);
  // South exit gap through bottom tree border (for route-17 connection)
  setTile(tiles, 3, h - 1, T.PATH); setTile(collisions, 3, h - 1, C.WALKABLE);
  setTile(tiles, 4, h - 1, T.PATH); setTile(collisions, 4, h - 1, C.WALKABLE);
  return {
    id: 'route-16', name: 'ROUTE 16', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 19, levelMin: 18, levelMax: 22, rate: 60 },
      { speciesId: 20, levelMin: 23, levelMax: 25, rate: 50 },  // Raticate
      { speciesId: 21, levelMin: 20, levelMax: 22, rate: 50 },
      { speciesId: 84, levelMin: 18, levelMax: 22, rate: 40 },  // Doduo
    ],
    trainerPlacements: [],
    itemBalls: [],
    signs: [
      { x: 7, y: 3, text: 'CYCLING ROAD\nBICYCLE riders only beyond this point!' },
    ],
    connections: [
      { direction: 'right', mapId: 'celadon-city', offset: 0 },
      { direction: 'south', mapId: 'route-17', offset: 0 },
    ],
    music: 'route-16',
  };
}

// === Route 17 — Cycling Road (long north-south route) ===
function makeRoute17(): GameMap {
  const w = 8, h = 40;
  const tiles = makeGrid(w, h, T.PATH);
  const collisions = makeGrid(w, h, C.WALKABLE);
  // Fence borders (cycling road)
  fillCol(tiles, 0, 0, h, T.FENCE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.FENCE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  // Ledges forcing downward movement
  for (let y = 5; y < h; y += 6) {
    fillRow(tiles, 1, y, 3, T.LEDGE_SOUTH);
    fillRow(collisions, 1, y, 3, C.LEDGE_SOUTH);
  }
  return {
    id: 'route-17', name: 'ROUTE 17', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [],
    trainerPlacements: [
      { trainerId: 'biker-4', x: 3, y: 8, facing: 'down', sightRange: 4, flag: 'r17-biker-1' },
      { trainerId: 'biker-5', x: 5, y: 15, facing: 'up', sightRange: 4, flag: 'r17-biker-2' },
      { trainerId: 'biker-6', x: 2, y: 22, facing: 'right', sightRange: 3, flag: 'r17-biker-3' },
      { trainerId: 'cue-ball-1', x: 5, y: 28, facing: 'left', sightRange: 4, flag: 'r17-cueball' },
      { trainerId: 'biker-7', x: 3, y: 35, facing: 'down', sightRange: 3, flag: 'r17-biker-4' },
    ],
    itemBalls: [
      { x: 6, y: 12, itemId: 20, quantity: 1, flag: 'r17-rare-candy' },
      { x: 2, y: 30, itemId: 26, quantity: 1, flag: 'r17-max-elixir' },
    ],
    signs: [],
    connections: [
      { direction: 'north', mapId: 'route-16', offset: 0 },
      { direction: 'south', mapId: 'route-18', offset: 0 },
    ],
    music: 'cycling',
  };
}

// === Route 18 — End of Cycling Road to Fuchsia ===
function makeRoute18(): GameMap {
  const w = 15, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  fillRect(tiles, 5, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 5, 1, 4, 3, C.TALL_GRASS);
  fillRect(tiles, 9, 6, 4, 3, T.TALL_GRASS); fillRect(collisions, 9, 6, 4, 3, C.TALL_GRASS);
  // North exit gap through top tree border (for route-17 connection)
  setTile(tiles, 3, 0, T.PATH); setTile(collisions, 3, 0, C.WALKABLE);
  setTile(tiles, 4, 0, T.PATH); setTile(collisions, 4, 0, C.WALKABLE);
  // Right exit gap through right tree border (for fuchsia-city connection)
  setTile(tiles, w - 1, 4, T.PATH); setTile(collisions, w - 1, 4, C.WALKABLE);
  setTile(tiles, w - 1, 5, T.PATH); setTile(collisions, w - 1, 5, C.WALKABLE);
  return {
    id: 'route-18', name: 'ROUTE 18', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 21, levelMin: 20, levelMax: 26, rate: 60 },
      { speciesId: 84, levelMin: 24, levelMax: 28, rate: 60 },
      { speciesId: 20, levelMin: 25, levelMax: 29, rate: 50 },
    ],
    trainerPlacements: [
      { trainerId: 'bird-keeper-5', x: 6, y: 3, facing: 'down', sightRange: 3, flag: 'r18-bird-1' },
      { trainerId: 'bird-keeper-6', x: 11, y: 5, facing: 'left', sightRange: 3, flag: 'r18-bird-2' },
    ],
    itemBalls: [],
    signs: [],
    connections: [
      { direction: 'north', mapId: 'route-17', offset: 0 },
      { direction: 'right', mapId: 'fuchsia-city', offset: 0 },
    ],
    music: 'route-18',
  };
}

// === Route 19 — Fuchsia south to Seafoam Islands (water route) ===
function makeRoute19(): GameMap {
  const w = 10, h = 20;
  const tiles = makeGrid(w, h, T.WATER);
  const collisions = makeGrid(w, h, C.WATER);
  // Small beach at north
  fillRect(tiles, 2, 0, 6, 3, T.SAND);
  fillRect(collisions, 2, 0, 6, 3, C.WALKABLE);
  fillRect(tiles, 3, 0, 4, 2, T.PATH);
  fillRect(collisions, 3, 0, 4, 2, C.WALKABLE);
  // Water edge
  fillRow(tiles, 2, 3, 6, T.WATER_EDGE);
  return {
    id: 'route-19', name: 'ROUTE 19', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 72, levelMin: 5, levelMax: 40, rate: 200 },   // Tentacool
      { speciesId: 73, levelMin: 30, levelMax: 40, rate: 56 },   // Tentacruel
    ],
    trainerPlacements: [
      { trainerId: 'swimmer-m-1', x: 3, y: 8, facing: 'down', sightRange: 4, flag: 'r19-swimmer-1' },
      { trainerId: 'swimmer-f-3', x: 6, y: 12, facing: 'up', sightRange: 4, flag: 'r19-swimmer-2' },
      { trainerId: 'swimmer-m-2', x: 4, y: 16, facing: 'right', sightRange: 3, flag: 'r19-swimmer-3' },
    ],
    itemBalls: [],
    signs: [],
    connections: [
      { direction: 'north', mapId: 'fuchsia-city', offset: 0 },
      { direction: 'south', mapId: 'route-20', offset: 0 },
    ],
    music: 'surf',
  };
}

// === Route 20 — Sea route, Seafoam Islands (water route) ===
function makeRoute20(): GameMap {
  const w = 30, h = 10;
  const tiles = makeGrid(w, h, T.WATER);
  const collisions = makeGrid(w, h, C.WATER);
  // Seafoam Islands in the middle (small island)
  fillRect(tiles, 12, 3, 6, 4, T.SAND);
  fillRect(collisions, 12, 3, 6, 4, C.WALKABLE);
  fillRect(tiles, 13, 3, 4, 2, T.CAVE_WALL);
  fillRect(collisions, 13, 3, 4, 2, C.SOLID);
  setTile(tiles, 15, 4, T.DOOR); setTile(collisions, 15, 4, C.WARP);
  return {
    id: 'route-20', name: 'ROUTE 20', width: w, height: h, tiles, collisions,
    warps: [
      { x: 15, y: 4, targetMap: 'seafoam-islands-1f', targetX: 5, targetY: 9 },
    ],
    npcs: [],
    wildEncounters: [
      { speciesId: 72, levelMin: 5, levelMax: 40, rate: 200 },
      { speciesId: 73, levelMin: 30, levelMax: 40, rate: 56 },
    ],
    trainerPlacements: [
      { trainerId: 'swimmer-m-3', x: 5, y: 4, facing: 'right', sightRange: 4, flag: 'r20-swimmer-1' },
      { trainerId: 'swimmer-f-4', x: 22, y: 5, facing: 'left', sightRange: 4, flag: 'r20-swimmer-2' },
      { trainerId: 'beauty-5', x: 8, y: 6, facing: 'up', sightRange: 3, flag: 'r20-beauty' },
    ],
    itemBalls: [],
    signs: [],
    connections: [
      { direction: 'north', mapId: 'route-19', offset: 0 },
      { direction: 'left', mapId: 'cinnabar-island', offset: 0 },
    ],
    music: 'surf',
  };
}

// === Route 21 — Cinnabar to Pallet (water route) ===
function makeRoute21(): GameMap {
  const w = 10, h = 25;
  const tiles = makeGrid(w, h, T.WATER);
  const collisions = makeGrid(w, h, C.WATER);
  // Small grassy islands
  fillRect(tiles, 3, 8, 4, 3, T.GRASS);
  fillRect(collisions, 3, 8, 4, 3, C.WALKABLE);
  fillRect(tiles, 4, 8, 2, 1, T.TALL_GRASS);
  fillRect(collisions, 4, 8, 2, 1, C.TALL_GRASS);
  return {
    id: 'route-21', name: 'ROUTE 21', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [],
    wildEncounters: [
      { speciesId: 72, levelMin: 5, levelMax: 40, rate: 200 },
      { speciesId: 73, levelMin: 30, levelMax: 40, rate: 56 },
    ],
    trainerPlacements: [
      { trainerId: 'swimmer-m-4', x: 4, y: 4, facing: 'down', sightRange: 4, flag: 'r21-swimmer-1' },
      { trainerId: 'fisher-3', x: 3, y: 15, facing: 'right', sightRange: 3, flag: 'r21-fisher' },
      { trainerId: 'swimmer-f-5', x: 6, y: 20, facing: 'up', sightRange: 4, flag: 'r21-swimmer-2' },
    ],
    itemBalls: [],
    signs: [],
    connections: [
      { direction: 'south', mapId: 'cinnabar-island', offset: 0 },
      { direction: 'north', mapId: 'pallet-town', offset: 0 },
    ],
    music: 'surf',
  };
}

export const route16 = makeRoute16();
export const route17 = makeRoute17();
export const route18 = makeRoute18();
export const route19 = makeRoute19();
export const route20 = makeRoute20();
export const route21 = makeRoute21();
