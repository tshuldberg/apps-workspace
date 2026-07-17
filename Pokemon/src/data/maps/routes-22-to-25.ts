// === Routes 22-25 ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

// === Route 22 — Viridian west, Rival encounter, Victory Road Gate ===
function makeRoute22(): GameMap {
  const w = 20, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  // Tall grass
  fillRect(tiles, 3, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 3, 1, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 3, 6, 5, 3, T.TALL_GRASS); fillRect(collisions, 3, 6, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 12, 1, 4, 3, T.TALL_GRASS); fillRect(collisions, 12, 1, 4, 3, C.TALL_GRASS);
  // Water (fishing spot)
  fillRect(tiles, 12, 6, 5, 3, T.WATER); fillRect(collisions, 12, 6, 5, 3, C.WATER);
  // Gate building at west end
  placeBuilding(tiles, collisions, 17, 3, 2, 4, T.ROOF_RED);
  setTile(tiles, 18, 4, T.DOOR); setTile(collisions, 18, 4, C.WARP);
  setTile(tiles, 18, 5, T.DOOR); setTile(collisions, 18, 5, C.WARP);
  // East exit to Viridian
  setTile(tiles, w - 1, 4, T.PATH); setTile(collisions, w - 1, 4, C.WALKABLE);
  setTile(tiles, w - 1, 5, T.PATH); setTile(collisions, w - 1, 5, C.WALKABLE);
  // North/south seam with Route 23
  setTile(tiles, 4, 0, T.PATH); setTile(collisions, 4, 0, C.WALKABLE);
  setTile(tiles, 5, 0, T.PATH); setTile(collisions, 5, 0, C.WALKABLE);
  return {
    id: 'route-22', name: 'ROUTE 22', width: w, height: h, tiles, collisions,
    warps: [
      { x: 18, y: 4, targetMap: 'route-23', targetX: 4, targetY: 29 },
      { x: 18, y: 5, targetMap: 'route-23', targetX: 4, targetY: 29 },
    ],
    npcs: [],
    wildEncounters: [
      { speciesId: 19, levelMin: 2, levelMax: 5, rate: 70 },
      { speciesId: 56, levelMin: 2, levelMax: 5, rate: 60 },
      { speciesId: 21, levelMin: 3, levelMax: 5, rate: 60 },
      { speciesId: 29, levelMin: 3, levelMax: 5, rate: 33 },   // Nidoran-F
      { speciesId: 32, levelMin: 3, levelMax: 5, rate: 33 },   // Nidoran-M
    ],
    trainerPlacements: [],
    itemBalls: [],
    signs: [
      { x: 10, y: 4, text: 'POKeMON LEAGUE Front Gate\nAll 8 badges required to pass!' },
    ],
    connections: [
      { direction: 'right', mapId: 'viridian-city', offset: 0 },
    ],
    music: 'route-22',
  };
}

// === Route 23 — Victory Road approach (badge check gates) ===
function makeRoute23(): GameMap {
  const w = 10, h = 30;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  // Water areas
  fillRect(tiles, 1, 8, 3, 5, T.WATER); fillRect(collisions, 1, 8, 3, 5, C.WATER);
  fillRect(tiles, 6, 12, 3, 4, T.WATER); fillRect(collisions, 6, 12, 3, 4, C.WATER);
  // Tall grass
  fillRect(tiles, 1, 18, 3, 4, T.TALL_GRASS); fillRect(collisions, 1, 18, 3, 4, C.TALL_GRASS);
  fillRect(tiles, 6, 20, 3, 4, T.TALL_GRASS); fillRect(collisions, 6, 20, 3, 4, C.TALL_GRASS);
  // Victory Road entrance (cave)
  fillRect(tiles, 3, 1, 4, 2, T.CAVE_WALL); fillRect(collisions, 3, 1, 4, 2, C.SOLID);
  setTile(tiles, 5, 2, T.DOOR); setTile(collisions, 5, 2, C.WARP);
  return {
    id: 'route-23', name: 'ROUTE 23', width: w, height: h, tiles, collisions,
    warps: [
      { x: 5, y: 2, targetMap: 'victory-road-1f', targetX: 1, targetY: 14 },
    ],
    npcs: [
      { id: 'r23-guard-1', x: 4, y: 25, spriteId: 'officer', facing: 'up', movement: 'stationary',
        dialogue: ['Show me your BOULDER BADGE!', 'Good! You may pass!'] },
      { id: 'r23-guard-2', x: 4, y: 20, spriteId: 'officer', facing: 'up', movement: 'stationary',
        dialogue: ['The CASCADE BADGE! Very good!'] },
    ],
    wildEncounters: [
      { speciesId: 21, levelMin: 26, levelMax: 30, rate: 50 },
      { speciesId: 22, levelMin: 34, levelMax: 38, rate: 30 },   // Fearow
      { speciesId: 23, levelMin: 26, levelMax: 30, rate: 40 },
      { speciesId: 27, levelMin: 26, levelMax: 30, rate: 40 },
      { speciesId: 56, levelMin: 26, levelMax: 30, rate: 40 },
      { speciesId: 132, levelMin: 26, levelMax: 30, rate: 10 },
    ],
    trainerPlacements: [],
    itemBalls: [],
    signs: [],
    connections: [
      { direction: 'south', mapId: 'route-22', offset: 0 },
      { direction: 'north', mapId: 'indigo-plateau', offset: 0 },
    ],
    music: 'route-23',
  };
}

// === Route 24 — Nugget Bridge (north of Cerulean) ===
function makeRoute24(): GameMap {
  const w = 10, h = 20;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillCol(tiles, 0, 0, h, T.TREE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  // Bridge (path over water)
  fillRect(tiles, 4, 0, 2, h, T.PATH); fillRect(collisions, 4, 0, 2, h, C.WALKABLE);
  // Water on sides
  fillRect(tiles, 1, 3, 3, 14, T.WATER); fillRect(collisions, 1, 3, 3, 14, C.WATER);
  fillRect(tiles, 6, 3, 3, 14, T.WATER); fillRect(collisions, 6, 3, 3, 14, C.WATER);
  // Tall grass at north
  fillRect(tiles, 1, 0, 3, 3, T.TALL_GRASS); fillRect(collisions, 1, 0, 3, 3, C.TALL_GRASS);
  fillRect(tiles, 6, 0, 3, 3, T.TALL_GRASS); fillRect(collisions, 6, 0, 3, 3, C.TALL_GRASS);
  // East/west seam with Route 25
  setTile(tiles, w - 1, 4, T.PATH); setTile(collisions, w - 1, 4, C.WALKABLE);
  setTile(tiles, w - 1, 5, T.PATH); setTile(collisions, w - 1, 5, C.WALKABLE);
  return {
    id: 'route-24', name: 'ROUTE 24', width: w, height: h, tiles, collisions,
    warps: [],
    npcs: [
      { id: 'r24-rocket', x: 4, y: 1, spriteId: 'rocket', facing: 'down', movement: 'stationary',
        dialogue: ['Congratulations on beating the NUGGET BRIDGE!', 'Here\'s your prize: a NUGGET!', '...Now join TEAM ROCKET!', 'No? Then I\'ll make you join!'],
        condition: 'before-nugget-bridge' },
    ],
    wildEncounters: [
      { speciesId: 10, levelMin: 7, levelMax: 11, rate: 40 },
      { speciesId: 43, levelMin: 12, levelMax: 14, rate: 50 },
      { speciesId: 13, levelMin: 7, levelMax: 11, rate: 40 },
      { speciesId: 63, levelMin: 7, levelMax: 12, rate: 40 },   // Abra
    ],
    trainerPlacements: [
      { trainerId: 'bug-catcher-10', x: 5, y: 16, facing: 'up', sightRange: 3, flag: 'nugget-1' },
      { trainerId: 'lass-7', x: 4, y: 13, facing: 'down', sightRange: 3, flag: 'nugget-2' },
      { trainerId: 'youngster-7', x: 5, y: 10, facing: 'up', sightRange: 3, flag: 'nugget-3' },
      { trainerId: 'lass-8', x: 4, y: 7, facing: 'down', sightRange: 3, flag: 'nugget-4' },
      { trainerId: 'camper-2', x: 5, y: 4, facing: 'up', sightRange: 3, flag: 'nugget-5' },
    ],
    itemBalls: [],
    signs: [
      { x: 4, y: 18, text: 'NUGGET BRIDGE\nDefeat 5 trainers to win a fabulous prize!' },
    ],
    connections: [
      { direction: 'south', mapId: 'cerulean-city', offset: 0 },
      { direction: 'north', mapId: 'route-25', offset: 0 },
    ],
    music: 'route-24',
  };
}

// === Route 25 — Bill's House (east from Nugget Bridge) ===
function makeRoute25(): GameMap {
  const w = 20, h = 10;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.TREE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.TREE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.TREE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 0, 4, w, 2, T.PATH); fillRect(collisions, 0, 4, w, 2, C.WALKABLE);
  // Tall grass
  fillRect(tiles, 3, 1, 5, 3, T.TALL_GRASS); fillRect(collisions, 3, 1, 5, 3, C.TALL_GRASS);
  fillRect(tiles, 10, 6, 5, 3, T.TALL_GRASS); fillRect(collisions, 10, 6, 5, 3, C.TALL_GRASS);
  // Bill's house at east end
  placeBuilding(tiles, collisions, 16, 3, 3, 2, T.ROOF_GREEN);
  // Water patches
  fillRect(tiles, 1, 6, 3, 3, T.WATER); fillRect(collisions, 1, 6, 3, 3, C.WATER);
  // North/south seam with Route 24
  setTile(tiles, 4, h - 1, T.PATH); setTile(collisions, 4, h - 1, C.WALKABLE);
  setTile(tiles, 5, h - 1, T.PATH); setTile(collisions, 5, h - 1, C.WALKABLE);
  return {
    id: 'route-25', name: 'ROUTE 25', width: w, height: h, tiles, collisions,
    warps: [
      { x: 17, y: 4, targetMap: 'bills-house', targetX: 3, targetY: 2 },
    ],
    npcs: [],
    wildEncounters: [
      { speciesId: 43, levelMin: 12, levelMax: 14, rate: 50 },
      { speciesId: 69, levelMin: 12, levelMax: 14, rate: 50 },
      { speciesId: 63, levelMin: 9, levelMax: 12, rate: 30 },
      { speciesId: 10, levelMin: 8, levelMax: 12, rate: 40 },
      { speciesId: 16, levelMin: 11, levelMax: 13, rate: 40 },
    ],
    trainerPlacements: [
      { trainerId: 'hiker-6', x: 4, y: 4, facing: 'right', sightRange: 3, flag: 'r25-hiker' },
      { trainerId: 'youngster-8', x: 8, y: 5, facing: 'left', sightRange: 3, flag: 'r25-youngster' },
      { trainerId: 'lass-9', x: 12, y: 4, facing: 'right', sightRange: 3, flag: 'r25-lass' },
    ],
    itemBalls: [],
    signs: [],
    connections: [
      { direction: 'left', mapId: 'route-24', offset: 0 },
    ],
    music: 'route-25',
  };
}

export const route22 = makeRoute22();
export const route23 = makeRoute23();
export const route24 = makeRoute24();
export const route25 = makeRoute25();
