// === Saffron City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makePokeMart, makeHouse, makeGym, makeGrid, fillRect, fillRow, setTile, T, C } from './map-helpers.ts';

export const saffronPokecenter: GameMap = makePokemonCenter(
  'saffron-pokecenter', 'saffron-city', 4, 15,
);

export const saffronMart: GameMap = makePokeMart(
  'saffron-mart', 'saffron-city', 20, 15,
);

export const saffronMrPsychic: GameMap = makeHouse(
  'saffron-mr-psychic', 'saffron-city', 9, 18,
  [
    {
      id: 'mr-psychic', x: 1, y: 0, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'I knew you were coming! I used my psychic powers!',
        'Take this TM for PSYCHIC! I know you want it!',
      ],
    },
  ],
);

export const saffronCopycat: GameMap = makeHouse(
  'saffron-copycat', 'saffron-city', 16, 18,
  [
    {
      id: 'copycat', x: 2, y: 1, spriteId: 'girl', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'Hi! Do you like POKeMON? I like POKeMON too!',
        'You want to trade a CLEFAIRY DOLL for TM31?',
      ],
    },
  ],
);

// Saffron Gym
export const gymSaffron: GameMap = makeGym(
  'gym-saffron', 'SAFFRON CITY GYM', 7, 8,
  'saffron-city', 5, 10,
  [
    { trainerId: 'psychic-m-1', x: 2, y: 5, facing: 'right', sightRange: 3, flag: 'gym-saffron-1' },
    { trainerId: 'psychic-f-1', x: 5, y: 4, facing: 'left', sightRange: 3, flag: 'gym-saffron-2' },
    { trainerId: 'psychic-m-2', x: 1, y: 3, facing: 'right', sightRange: 2, flag: 'gym-saffron-3' },
    { trainerId: 'channeler-1', x: 4, y: 2, facing: 'down', sightRange: 2, flag: 'gym-saffron-4' },
  ],
  [
    {
      id: 'sabrina', x: 3, y: 1, spriteId: 'sabrina', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'SABRINA: I had a vision of your arrival!',
        'I have had psychic powers since I was a child.',
        'I first learned to bend spoons with my mind.',
        'I dislike fighting, but if you wish, I will show you my powers!',
      ],
    },
  ],
);

// Fighting Dojo
const dojoW = 7, dojoH = 6;
const dojoTiles = makeGrid(dojoW, dojoH, T.FLOOR);
const dojoColl = makeGrid(dojoW, dojoH, C.WALKABLE);
fillRow(dojoTiles, 0, 0, dojoW, T.BUILDING_WALL);
fillRow(dojoColl, 0, 0, dojoW, C.SOLID);
fillRect(dojoTiles, 0, 0, 1, dojoH, T.BUILDING_WALL);
fillRect(dojoColl, 0, 0, 1, dojoH, C.SOLID);
fillRect(dojoTiles, dojoW - 1, 0, 1, dojoH, T.BUILDING_WALL);
fillRect(dojoColl, dojoW - 1, 0, 1, dojoH, C.SOLID);
setTile(dojoTiles, 3, dojoH - 1, T.DOOR);
setTile(dojoColl, 3, dojoH - 1, C.WARP);

export const fightingDojo: GameMap = {
  id: 'fighting-dojo',
  name: 'FIGHTING DOJO',
  width: dojoW, height: dojoH,
  tiles: dojoTiles, collisions: dojoColl,
  warps: [
    { x: 3, y: dojoH - 1, targetMap: 'saffron-city', targetX: 18, targetY: 10 },
  ],
  npcs: [
    {
      id: 'karate-king', x: 3, y: 1, spriteId: 'blackbelt', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'I am the KARATE KING!',
        'You beat me? Fine! Choose one of my POKeMON!',
        'HITMONLEE, the kicking fiend, or HITMONCHAN, the punching demon?',
      ],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [
    { trainerId: 'blackbelt-2', x: 2, y: 3, facing: 'right', sightRange: 2, flag: 'dojo-1' },
    { trainerId: 'blackbelt-3', x: 5, y: 3, facing: 'left', sightRange: 2, flag: 'dojo-2' },
    { trainerId: 'blackbelt-4', x: 2, y: 4, facing: 'right', sightRange: 2, flag: 'dojo-3' },
    { trainerId: 'blackbelt-5', x: 5, y: 4, facing: 'left', sightRange: 2, flag: 'dojo-4' },
  ],
  itemBalls: [
    // Gift Pokemon: Hitmonlee or Hitmonchan
    { x: 2, y: 1, itemId: 0, quantity: 1, flag: 'dojo-hitmonlee' },
    { x: 4, y: 1, itemId: 0, quantity: 1, flag: 'dojo-hitmonchan' },
  ],
  signs: [],
  connections: [],
  music: 'gym',
};

// Silph Co 1F (simplified — single representative floor)
const silphW = 10, silphH = 10;
const silphTiles = makeGrid(silphW, silphH, T.FLOOR);
const silphColl = makeGrid(silphW, silphH, C.WALKABLE);
fillRow(silphTiles, 0, 0, silphW, T.BUILDING_WALL);
fillRow(silphColl, 0, 0, silphW, C.SOLID);
fillRect(silphTiles, 0, 0, 1, silphH, T.BUILDING_WALL);
fillRect(silphColl, 0, 0, 1, silphH, C.SOLID);
fillRect(silphTiles, silphW - 1, 0, 1, silphH, T.BUILDING_WALL);
fillRect(silphColl, silphW - 1, 0, 1, silphH, C.SOLID);
fillRow(silphTiles, 0, silphH - 1, silphW, T.BUILDING_WALL);
fillRow(silphColl, 0, silphH - 1, silphW, C.SOLID);
// Lobby desk
fillRect(silphTiles, 3, 2, 4, 1, T.COUNTER);
fillRect(silphColl, 3, 2, 4, 1, C.SOLID);
// Elevator
setTile(silphTiles, 1, 1, T.DOOR);
setTile(silphColl, 1, 1, C.WARP);
// Stairs up
setTile(silphTiles, 8, 1, T.STAIRS_UP);
setTile(silphColl, 8, 1, C.WARP);
// Exit
setTile(silphTiles, 5, silphH - 1, T.DOOR);
setTile(silphColl, 5, silphH - 1, C.WARP);

export const silphCo1F: GameMap = {
  id: 'silph-co-1f',
  name: 'SILPH CO. 1F',
  width: silphW, height: silphH,
  tiles: silphTiles, collisions: silphColl,
  warps: [
    { x: 5, y: silphH - 1, targetMap: 'saffron-city', targetX: 11, targetY: 5 },
    { x: 8, y: 1, targetMap: 'silph-co-7f', targetX: 8, targetY: 8 },
    { x: 1, y: 1, targetMap: 'silph-co-11f', targetX: 1, targetY: 8 },
  ],
  npcs: [
    {
      id: 'silph-receptionist', x: 5, y: 2, spriteId: 'girl', facing: 'down',
      movement: 'stationary',
      dialogue: ['Welcome to SILPH CO.!', 'Oh no... TEAM ROCKET has taken over the building!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [
    { trainerId: 'rocket-grunt-5', x: 4, y: 5, facing: 'down', sightRange: 3, flag: 'silph-1f-rocket' },
  ],
  itemBalls: [],
  signs: [],
  connections: [],
  music: 'silph-co',
};

// Silph Co 7F (Rival battle + Lapras gift)
const s7Tiles = makeGrid(silphW, silphH, T.FLOOR);
const s7Coll = makeGrid(silphW, silphH, C.WALKABLE);
fillRow(s7Tiles, 0, 0, silphW, T.BUILDING_WALL);
fillRow(s7Coll, 0, 0, silphW, C.SOLID);
fillRect(s7Tiles, 0, 0, 1, silphH, T.BUILDING_WALL);
fillRect(s7Coll, 0, 0, 1, silphH, C.SOLID);
fillRect(s7Tiles, silphW - 1, 0, 1, silphH, T.BUILDING_WALL);
fillRect(s7Coll, silphW - 1, 0, 1, silphH, C.SOLID);
fillRow(s7Tiles, 0, silphH - 1, silphW, T.BUILDING_WALL);
fillRow(s7Coll, 0, silphH - 1, silphW, C.SOLID);
setTile(s7Tiles, 8, 8, T.STAIRS_DOWN);
setTile(s7Coll, 8, 8, C.WARP);
setTile(s7Tiles, 8, 1, T.STAIRS_UP);
setTile(s7Coll, 8, 1, C.WARP);

export const silphCo7F: GameMap = {
  id: 'silph-co-7f',
  name: 'SILPH CO. 7F',
  width: silphW, height: silphH,
  tiles: s7Tiles, collisions: s7Coll,
  warps: [
    { x: 8, y: 8, targetMap: 'silph-co-1f', targetX: 8, targetY: 1 },
    { x: 8, y: 1, targetMap: 'silph-co-11f', targetX: 8, targetY: 8 },
  ],
  npcs: [
    {
      id: 'silph-rival', x: 5, y: 4, spriteId: 'rival', facing: 'down',
      movement: 'stationary',
      dialogue: ['RIVAL: What? You here too?', 'I\'m cleaning up TEAM ROCKET all by myself!'],
      condition: 'before-silph-rival',
    },
    {
      id: 'silph-employee', x: 2, y: 2, spriteId: 'scientist', facing: 'right',
      movement: 'stationary',
      dialogue: ['Thank you for saving us!', 'Please, take this LAPRAS! It was lonely here.'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [
    { trainerId: 'rocket-grunt-6', x: 3, y: 6, facing: 'right', sightRange: 3, flag: 'silph-7f-rocket-1' },
    { trainerId: 'rocket-grunt-7', x: 6, y: 3, facing: 'down', sightRange: 3, flag: 'silph-7f-rocket-2' },
  ],
  itemBalls: [
    { x: 1, y: 1, itemId: 36, quantity: 1, flag: 'silph-card-key' },
  ],
  signs: [],
  connections: [],
  music: 'silph-co',
};

// Silph Co 11F (Giovanni boss)
const s11Tiles = makeGrid(silphW, silphH, T.FLOOR);
const s11Coll = makeGrid(silphW, silphH, C.WALKABLE);
fillRow(s11Tiles, 0, 0, silphW, T.BUILDING_WALL);
fillRow(s11Coll, 0, 0, silphW, C.SOLID);
fillRect(s11Tiles, 0, 0, 1, silphH, T.BUILDING_WALL);
fillRect(s11Coll, 0, 0, 1, silphH, C.SOLID);
fillRect(s11Tiles, silphW - 1, 0, 1, silphH, T.BUILDING_WALL);
fillRect(s11Coll, silphW - 1, 0, 1, silphH, C.SOLID);
fillRow(s11Tiles, 0, silphH - 1, silphW, T.BUILDING_WALL);
fillRow(s11Coll, 0, silphH - 1, silphW, C.SOLID);
// Giovanni's desk
fillRect(s11Tiles, 4, 2, 2, 1, T.COUNTER);
fillRect(s11Coll, 4, 2, 2, 1, C.SOLID);
setTile(s11Tiles, 1, 8, T.STAIRS_DOWN);
setTile(s11Coll, 1, 8, C.WARP);
setTile(s11Tiles, 8, 8, T.STAIRS_DOWN);
setTile(s11Coll, 8, 8, C.WARP);

export const silphCo11F: GameMap = {
  id: 'silph-co-11f',
  name: 'SILPH CO. 11F',
  width: silphW, height: silphH,
  tiles: s11Tiles, collisions: s11Coll,
  warps: [
    { x: 1, y: 8, targetMap: 'silph-co-1f', targetX: 1, targetY: 1 },
    { x: 8, y: 8, targetMap: 'silph-co-7f', targetX: 8, targetY: 1 },
  ],
  npcs: [
    {
      id: 'giovanni-silph', x: 5, y: 1, spriteId: 'giovanni', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'GIOVANNI: So! I must say, I am impressed you got here!',
        'The MASTER BALL project is now complete!',
        'But you shall not have it!',
      ],
    },
    {
      id: 'silph-president', x: 2, y: 5, spriteId: 'old-man', facing: 'right',
      movement: 'stationary',
      dialogue: [
        'Oh! You saved SILPH CO.!',
        'Thank you! Please take this MASTER BALL!',
        'It\'s our finest creation — it catches any POKeMON without fail!',
      ],
      condition: 'after-giovanni-silph',
    },
  ],
  wildEncounters: [],
  trainerPlacements: [
    { trainerId: 'rocket-grunt-8', x: 3, y: 5, facing: 'right', sightRange: 3, flag: 'silph-11f-rocket' },
  ],
  itemBalls: [],
  signs: [],
  connections: [],
  music: 'silph-co',
};
