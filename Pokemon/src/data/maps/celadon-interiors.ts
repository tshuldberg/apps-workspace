// === Celadon City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makeHouse, makeGym, makeGrid, fillRect, fillRow, setTile, T, C } from './map-helpers.ts';

export const celadonPokecenter: GameMap = makePokemonCenter(
  'celadon-pokecenter', 'celadon-city', 19, 6,
);

export const celadonHotel: GameMap = makeHouse(
  'celadon-hotel', 'celadon-city', 17, 14,
  [
    {
      id: 'hotel-clerk', x: 1, y: 0, spriteId: 'clerk', facing: 'down',
      movement: 'stationary',
      dialogue: ['Welcome to CELADON HOTEL!', 'Your POKeMON look tired. Please rest here!'],
    },
  ],
);

export const celadonRestaurant: GameMap = makeHouse(
  'celadon-restaurant', 'celadon-city', 22, 14,
  [
    {
      id: 'restaurant-chef', x: 1, y: 0, spriteId: 'clerk', facing: 'down',
      movement: 'stationary',
      dialogue: ['Welcome! Our special today is the RAGE CANDY BAR!'],
    },
  ],
);

export const celadonMansion: GameMap = makeHouse(
  'celadon-mansion', 'celadon-city', 19, 9,
  [
    {
      id: 'mansion-npc', x: 1, y: 1, spriteId: 'scientist', facing: 'right',
      movement: 'stationary',
      dialogue: ['I wrote this game!', 'Would you like to use the PC upstairs?'],
    },
  ],
);

// Celadon Dept Store (simplified - single floor)
const deptW = 8, deptH = 8;
const deptTiles = makeGrid(deptW, deptH, T.FLOOR);
const deptColl = makeGrid(deptW, deptH, C.WALKABLE);
fillRow(deptTiles, 0, 0, deptW, T.SHELF);
fillRow(deptColl, 0, 0, deptW, C.SOLID);
fillRect(deptTiles, 1, 2, 2, 1, T.COUNTER);
fillRect(deptColl, 1, 2, 2, 1, C.SOLID);
fillRect(deptTiles, 5, 2, 2, 1, T.COUNTER);
fillRect(deptColl, 5, 2, 2, 1, C.SOLID);
fillRect(deptTiles, 1, 4, 2, 1, T.COUNTER);
fillRect(deptColl, 1, 4, 2, 1, C.SOLID);
fillRect(deptTiles, 5, 4, 2, 1, T.COUNTER);
fillRect(deptColl, 5, 4, 2, 1, C.SOLID);
setTile(deptTiles, 3, deptH - 1, T.DOOR);
setTile(deptColl, 3, deptH - 1, C.WARP);

export const celadonDeptStore: GameMap = {
  id: 'celadon-dept-store',
  name: 'CELADON DEPT. STORE',
  width: deptW, height: deptH,
  tiles: deptTiles, collisions: deptColl,
  warps: [
    { x: 3, y: deptH - 1, targetMap: 'celadon-city', targetX: 5, targetY: 6 },
  ],
  npcs: [
    { id: 'dept-clerk-1', x: 2, y: 2, spriteId: 'clerk', facing: 'down', movement: 'stationary',
      dialogue: ['2F: Trainer supplies! POKe BALLS, POTIONS, and more!'] },
    { id: 'dept-clerk-2', x: 6, y: 2, spriteId: 'clerk', facing: 'down', movement: 'stationary',
      dialogue: ['We sell TMs and evolution stones!'] },
    { id: 'dept-clerk-3', x: 2, y: 4, spriteId: 'clerk', facing: 'down', movement: 'stationary',
      dialogue: ['Fresh Water, Soda Pop, and Lemonade! Refreshing!'] },
    { id: 'dept-clerk-4', x: 6, y: 4, spriteId: 'clerk', facing: 'down', movement: 'stationary',
      dialogue: ['Rooftop vending machines are popular!'] },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [], music: 'poke-mart',
};

// Game Corner
const gcW = 10, gcH = 8;
const gcTiles = makeGrid(gcW, gcH, T.FLOOR);
const gcColl = makeGrid(gcW, gcH, C.WALKABLE);
fillRow(gcTiles, 0, 0, gcW, T.SHELF);
fillRow(gcColl, 0, 0, gcW, C.SOLID);
// Slot machine rows
for (let i = 0; i < 4; i++) {
  fillRect(gcTiles, 1 + i * 2, 2, 1, 4, T.COUNTER);
  fillRect(gcColl, 1 + i * 2, 2, 1, 4, C.SOLID);
}
setTile(gcTiles, 5, gcH - 1, T.DOOR);
setTile(gcColl, 5, gcH - 1, C.WARP);

export const celadonGameCorner: GameMap = {
  id: 'celadon-game-corner',
  name: 'GAME CORNER',
  width: gcW, height: gcH,
  tiles: gcTiles, collisions: gcColl,
  warps: [
    { x: 5, y: gcH - 1, targetMap: 'celadon-city', targetX: 10, targetY: 15 },
  ],
  npcs: [
    { id: 'gc-rocket', x: 8, y: 3, spriteId: 'rocket', facing: 'left', movement: 'stationary',
      dialogue: ['Hey! Don\'t bother me while I\'m playing!', '...Wait, there\'s a poster behind me? So what?'] },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [], music: 'game-corner',
};

// Celadon Gym
export const gymCeladon: GameMap = makeGym(
  'gym-celadon', 'CELADON CITY GYM', 7, 8,
  'celadon-city', 4, 15,
  [
    { trainerId: 'beauty-1', x: 2, y: 5, facing: 'right', sightRange: 3, flag: 'gym-celadon-1' },
    { trainerId: 'beauty-2', x: 5, y: 3, facing: 'down', sightRange: 2, flag: 'gym-celadon-2' },
    { trainerId: 'lass-5', x: 1, y: 3, facing: 'right', sightRange: 2, flag: 'gym-celadon-3' },
    { trainerId: 'cooltrainer-f-2', x: 4, y: 5, facing: 'left', sightRange: 3, flag: 'gym-celadon-4' },
  ],
  [
    {
      id: 'erika', x: 3, y: 1, spriteId: 'erika', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'ERIKA: Hello... Lovely weather, isn\'t it?',
        'It\'s so pleasant here in the gym among all these flowers...',
        'Oh, I\'m sorry, I must have dozed off.',
        'Welcome! I am ERIKA, the GYM LEADER!',
        'I specialize in GRASS-type POKeMON!',
      ],
    },
  ],
);
