// === Mt. Moon — 3 floors ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

// === Mt. Moon 1F ===
function makeMtMoon1F(): GameMap {
  const w = 20, h = 20;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);

  // Cave walls border
  fillRow(tiles, 0, 0, w, T.CAVE_WALL);
  fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL);
  fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL);
  fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL);
  fillCol(collisions, w - 1, 0, h, C.SOLID);

  // Interior wall formations
  fillRect(tiles, 5, 3, 4, 2, T.CAVE_WALL);
  fillRect(collisions, 5, 3, 4, 2, C.SOLID);
  fillRect(tiles, 12, 2, 3, 5, T.CAVE_WALL);
  fillRect(collisions, 12, 2, 3, 5, C.SOLID);
  fillRect(tiles, 3, 8, 6, 2, T.CAVE_WALL);
  fillRect(collisions, 3, 8, 6, 2, C.SOLID);
  fillRect(tiles, 11, 9, 5, 3, T.CAVE_WALL);
  fillRect(collisions, 11, 9, 5, 3, C.SOLID);
  fillRect(tiles, 2, 13, 4, 3, T.CAVE_WALL);
  fillRect(collisions, 2, 13, 4, 3, C.SOLID);
  fillRect(tiles, 9, 14, 3, 2, T.CAVE_WALL);
  fillRect(collisions, 9, 14, 3, 2, C.SOLID);
  fillRect(tiles, 14, 14, 4, 3, T.CAVE_WALL);
  fillRect(collisions, 14, 14, 4, 3, C.SOLID);

  // Boulders
  setTile(tiles, 10, 5, T.BOULDER);
  setTile(collisions, 10, 5, C.SOLID);
  setTile(tiles, 3, 6, T.BOULDER);
  setTile(collisions, 3, 6, C.SOLID);
  setTile(tiles, 16, 7, T.BOULDER);
  setTile(collisions, 16, 7, C.SOLID);

  // Entrance (from Route 3/4)
  setTile(tiles, 1, 1, T.STAIRS_UP);
  setTile(collisions, 1, 1, C.WARP);

  // Stairs to B1F
  setTile(tiles, 17, 17, T.STAIRS_DOWN);
  setTile(collisions, 17, 17, C.WARP);

  // Second stairs to B1F
  setTile(tiles, 8, 12, T.STAIRS_DOWN);
  setTile(collisions, 8, 12, C.WARP);

  return {
    id: 'mt-moon-1f',
    name: 'MT. MOON 1F',
    width: w, height: h,
    tiles, collisions,
    warps: [
      { x: 1, y: 1, targetMap: 'route-4', targetX: 1, targetY: 5 },
      { x: 17, y: 17, targetMap: 'mt-moon-b1f', targetX: 17, targetY: 1 },
      { x: 8, y: 12, targetMap: 'mt-moon-b1f', targetX: 8, targetY: 8 },
    ],
    npcs: [
      {
        id: 'mtmoon-hiker', x: 4, y: 2, spriteId: 'hiker', facing: 'down',
        movement: 'stationary',
        dialogue: ['Wow, it\'s so dark in here!', 'ZUBAT keep flying at me!'],
      },
    ],
    wildEncounters: [
      { speciesId: 41, levelMin: 7, levelMax: 9, rate: 100 },   // Zubat
      { speciesId: 74, levelMin: 7, levelMax: 9, rate: 70 },    // Geodude
      { speciesId: 46, levelMin: 8, levelMax: 10, rate: 30 },   // Paras
      { speciesId: 35, levelMin: 8, levelMax: 12, rate: 10 },   // Clefairy
    ],
    trainerPlacements: [
      { trainerId: 'rocket-grunt-1', x: 9, y: 3, facing: 'left', sightRange: 3, flag: 'mtm-1f-rocket-1' },
      { trainerId: 'bug-catcher-7', x: 15, y: 8, facing: 'down', sightRange: 3, flag: 'mtm-1f-bug' },
      { trainerId: 'lass-3', x: 7, y: 16, facing: 'right', sightRange: 3, flag: 'mtm-1f-lass' },
      { trainerId: 'hiker-1', x: 3, y: 11, facing: 'right', sightRange: 4, flag: 'mtm-1f-hiker' },
    ],
    itemBalls: [
      { x: 15, y: 2, itemId: 17, quantity: 1, flag: 'mtm-1f-potion' },
      { x: 1, y: 17, itemId: 29, quantity: 1, flag: 'mtm-1f-escape-rope' },
      { x: 18, y: 10, itemId: 20, quantity: 1, flag: 'mtm-1f-rare-candy' },
    ],
    signs: [],
    connections: [],
    music: 'mt-moon',
  };
}

// === Mt. Moon B1F ===
function makeMtMoonB1F(): GameMap {
  const w = 20, h = 20;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);

  // Cave walls border
  fillRow(tiles, 0, 0, w, T.CAVE_WALL);
  fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL);
  fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL);
  fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL);
  fillCol(collisions, w - 1, 0, h, C.SOLID);

  // Interior walls
  fillRect(tiles, 4, 3, 5, 3, T.CAVE_WALL);
  fillRect(collisions, 4, 3, 5, 3, C.SOLID);
  fillRect(tiles, 12, 4, 4, 4, T.CAVE_WALL);
  fillRect(collisions, 12, 4, 4, 4, C.SOLID);
  fillRect(tiles, 2, 10, 6, 2, T.CAVE_WALL);
  fillRect(collisions, 2, 10, 6, 2, C.SOLID);
  fillRect(tiles, 10, 11, 3, 4, T.CAVE_WALL);
  fillRect(collisions, 10, 11, 3, 4, C.SOLID);
  fillRect(tiles, 15, 12, 3, 3, T.CAVE_WALL);
  fillRect(collisions, 15, 12, 3, 3, C.SOLID);
  fillRect(tiles, 3, 15, 5, 2, T.CAVE_WALL);
  fillRect(collisions, 3, 15, 5, 2, C.SOLID);

  // Stairs up to 1F
  setTile(tiles, 17, 1, T.STAIRS_UP);
  setTile(collisions, 17, 1, C.WARP);
  setTile(tiles, 8, 8, T.STAIRS_UP);
  setTile(collisions, 8, 8, C.WARP);

  // Stairs down to B2F
  setTile(tiles, 2, 17, T.STAIRS_DOWN);
  setTile(collisions, 2, 17, C.WARP);

  return {
    id: 'mt-moon-b1f',
    name: 'MT. MOON B1F',
    width: w, height: h,
    tiles, collisions,
    warps: [
      { x: 17, y: 1, targetMap: 'mt-moon-1f', targetX: 17, targetY: 17 },
      { x: 8, y: 8, targetMap: 'mt-moon-1f', targetX: 8, targetY: 12 },
      { x: 2, y: 17, targetMap: 'mt-moon-b2f', targetX: 2, targetY: 2 },
    ],
    npcs: [],
    wildEncounters: [
      { speciesId: 41, levelMin: 8, levelMax: 11, rate: 100 },
      { speciesId: 74, levelMin: 8, levelMax: 10, rate: 70 },
      { speciesId: 46, levelMin: 9, levelMax: 11, rate: 40 },
      { speciesId: 35, levelMin: 9, levelMax: 12, rate: 10 },
    ],
    trainerPlacements: [
      { trainerId: 'rocket-grunt-2', x: 10, y: 2, facing: 'down', sightRange: 3, flag: 'mtm-b1-rocket-1' },
      { trainerId: 'rocket-grunt-3', x: 16, y: 9, facing: 'left', sightRange: 4, flag: 'mtm-b1-rocket-2' },
      { trainerId: 'hiker-2', x: 5, y: 7, facing: 'right', sightRange: 3, flag: 'mtm-b1-hiker' },
    ],
    itemBalls: [
      { x: 1, y: 5, itemId: 22, quantity: 1, flag: 'mtm-b1-tm-water-pulse' },
      { x: 18, y: 15, itemId: 30, quantity: 1, flag: 'mtm-b1-star-piece' },
    ],
    signs: [],
    connections: [],
    music: 'mt-moon',
  };
}

// === Mt. Moon B2F — Fossil room ===
function makeMtMoonB2F(): GameMap {
  const w = 15, h = 12;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);

  // Cave walls border
  fillRow(tiles, 0, 0, w, T.CAVE_WALL);
  fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL);
  fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL);
  fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL);
  fillCol(collisions, w - 1, 0, h, C.SOLID);

  // Interior walls
  fillRect(tiles, 5, 3, 5, 2, T.CAVE_WALL);
  fillRect(collisions, 5, 3, 5, 2, C.SOLID);
  fillRect(tiles, 2, 7, 3, 2, T.CAVE_WALL);
  fillRect(collisions, 2, 7, 3, 2, C.SOLID);
  fillRect(tiles, 10, 6, 3, 3, T.CAVE_WALL);
  fillRect(collisions, 10, 6, 3, 3, C.SOLID);

  // Stairs up to B1F
  setTile(tiles, 2, 2, T.STAIRS_UP);
  setTile(collisions, 2, 2, C.WARP);

  // Exit to Route 4
  setTile(tiles, 13, 5, T.STAIRS_UP);
  setTile(collisions, 13, 5, C.WARP);

  // Fossil pedestals
  setTile(tiles, 6, 1, T.COUNTER);
  setTile(collisions, 6, 1, C.SOLID);
  setTile(tiles, 8, 1, T.COUNTER);
  setTile(collisions, 8, 1, C.SOLID);

  return {
    id: 'mt-moon-b2f',
    name: 'MT. MOON B2F',
    width: w, height: h,
    tiles, collisions,
    warps: [
      { x: 2, y: 2, targetMap: 'mt-moon-b1f', targetX: 2, targetY: 17 },
      { x: 13, y: 5, targetMap: 'route-4', targetX: 1, targetY: 4 },
    ],
    npcs: [
      {
        id: 'super-nerd', x: 7, y: 2, spriteId: 'scientist', facing: 'down',
        movement: 'stationary',
        dialogue: [
          'I found these fossils! They\'re both mine!',
          'Wait, you beat me? Fine, take one!',
        ],
      },
    ],
    wildEncounters: [
      { speciesId: 41, levelMin: 9, levelMax: 12, rate: 120 },
      { speciesId: 74, levelMin: 9, levelMax: 11, rate: 80 },
      { speciesId: 35, levelMin: 9, levelMax: 12, rate: 15 },
    ],
    trainerPlacements: [
      { trainerId: 'rocket-grunt-4', x: 5, y: 9, facing: 'up', sightRange: 3, flag: 'mtm-b2-rocket' },
    ],
    itemBalls: [
      // Helix Fossil and Dome Fossil (choose one, event-driven)
      { x: 6, y: 1, itemId: 40, quantity: 1, flag: 'helix-fossil' },
      { x: 8, y: 1, itemId: 41, quantity: 1, flag: 'dome-fossil' },
    ],
    signs: [],
    connections: [],
    music: 'mt-moon',
  };
}

export const mtMoon1F = makeMtMoon1F();
export const mtMoonB1F = makeMtMoonB1F();
export const mtMoonB2F = makeMtMoonB2F();
