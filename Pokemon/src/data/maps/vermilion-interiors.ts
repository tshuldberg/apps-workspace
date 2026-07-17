// === Vermilion City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makePokeMart, makeHouse, makeGym, makeGrid, fillRect, fillRow, setTile, T, C } from './map-helpers.ts';

export const vermilionPokecenter: GameMap = makePokemonCenter(
  'vermilion-pokecenter', 'vermilion-city', 15, 5,
);

export const vermilionMart: GameMap = makePokeMart(
  'vermilion-mart', 'vermilion-city', 16, 8,
);

export const vermilionHouse: GameMap = makeHouse(
  'vermilion-house', 'vermilion-city', 15, 12,
  [
    {
      id: 'vermilion-h-npc', x: 1, y: 1, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: ['I love the sunsets at this port.', 'They fill me with nostalgia.'],
    },
  ],
);

export const vermilionFanClub: GameMap = makeHouse(
  'vermilion-fan-club', 'vermilion-city', 4, 12,
  [
    {
      id: 'fan-club-chair', x: 1, y: 0, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'Hello! I\'m the POKEMON FAN CLUB CHAIRMAN!',
        'Let me tell you about my darling POKeMON...',
        'My RAPIDASH... Oh, it runs so beautifully!',
        'Here, take this BIKE VOUCHER for listening!',
      ],
    },
    {
      id: 'fan-club-member', x: 2, y: 1, spriteId: 'girl', facing: 'left',
      movement: 'stationary',
      dialogue: ['I just adore POKeMON!', 'Don\'t you think PIKACHU is the cutest?'],
    },
  ],
);

// Lt. Surge's Gym — electric theme with trash can puzzle
export const gymVermilion: GameMap = (() => {
  const base = makeGym(
    'gym-vermilion', 'VERMILION CITY GYM', 5, 8,
    'vermilion-city', 4, 7,
    [
      { trainerId: 'sailor-1', x: 1, y: 5, facing: 'right', sightRange: 3, flag: 'gym-vermilion-1' },
      { trainerId: 'rocker-1', x: 3, y: 4, facing: 'down', sightRange: 3, flag: 'gym-vermilion-2' },
      { trainerId: 'gentleman-1', x: 1, y: 3, facing: 'right', sightRange: 2, flag: 'gym-vermilion-3' },
    ],
    [
      {
        id: 'lt-surge', x: 2, y: 1, spriteId: 'lt-surge', facing: 'down',
        movement: 'stationary',
        dialogue: [
          'LT. SURGE: Hey, kid! What do you think you\'re doing here?',
          'You won\'t live long in combat! Not with your puny power!',
          'I tell you, kid, ELECTRIC POKeMON saved me during the war!',
          'They zapped my enemies into paralysis!',
          'The same as I\'ll do to you!',
        ],
      },
    ],
  );
  return base;
})();

// SS Anne — simplified as single floor
const ssW = 20, ssH = 20;
const ssTiles = makeGrid(ssW, ssH, T.FLOOR);
const ssCollisions = makeGrid(ssW, ssH, C.WALKABLE);

// Walls
fillRow(ssTiles, 0, 0, ssW, T.BUILDING_WALL);
fillRow(ssCollisions, 0, 0, ssW, C.SOLID);
fillRow(ssTiles, 0, ssH - 1, ssW, T.BUILDING_WALL);
fillRow(ssCollisions, 0, ssH - 1, ssW, C.SOLID);
fillRect(ssTiles, 0, 0, 1, ssH, T.BUILDING_WALL);
fillRect(ssCollisions, 0, 0, 1, ssH, C.SOLID);
fillRect(ssTiles, ssW - 1, 0, 1, ssH, T.BUILDING_WALL);
fillRect(ssCollisions, ssW - 1, 0, 1, ssH, C.SOLID);

// Corridor
fillRect(ssTiles, 1, 9, 18, 2, T.CARPET);
// Cabins (rooms off corridor)
for (let i = 0; i < 6; i++) {
  fillRect(ssTiles, 2 + i * 3, 1, 2, 3, T.FLOOR);
  fillRect(ssTiles, 2 + i * 3, 0, 2, 1, T.COUNTER);
  fillRect(ssCollisions, 2 + i * 3, 0, 2, 1, C.SOLID);
}
for (let i = 0; i < 6; i++) {
  fillRect(ssTiles, 2 + i * 3, 12, 2, 3, T.FLOOR);
  fillRect(ssTiles, 2 + i * 3, 15, 2, 1, T.COUNTER);
  fillRect(ssCollisions, 2 + i * 3, 15, 2, 1, C.SOLID);
}

// Captain's room at top-center
fillRect(ssTiles, 8, 1, 4, 3, T.CARPET);
fillRect(ssTiles, 8, 0, 4, 1, T.SHELF);
fillRect(ssCollisions, 8, 0, 4, 1, C.SOLID);

// Exit
setTile(ssTiles, 10, ssH - 1, T.DOOR);
setTile(ssCollisions, 10, ssH - 1, C.WARP);

export const ssAnne1F: GameMap = {
  id: 'ss-anne-1f',
  name: 'S.S. ANNE',
  width: ssW, height: ssH,
  tiles: ssTiles, collisions: ssCollisions,
  warps: [
    { x: 10, y: ssH - 1, targetMap: 'vermilion-city', targetX: 10, targetY: 14 },
  ],
  npcs: [
    {
      id: 'ss-captain', x: 10, y: 1, spriteId: 'sailor', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'Urrp... I feel seasick...',
        'Oh! You know RUBDOWN? Could you rub my back?',
        'Thank you! Here, take this HM for CUT!',
      ],
    },
    {
      id: 'ss-rival', x: 10, y: 10, spriteId: 'rival', facing: 'up',
      movement: 'stationary',
      dialogue: ['RIVAL: Bonjour! Fancy meeting you here!', 'Let\'s check out our POKeMON!'],
      condition: 'before-ss-anne-rival',
    },
  ],
  wildEncounters: [],
  trainerPlacements: [
    { trainerId: 'sailor-2', x: 3, y: 10, facing: 'right', sightRange: 3, flag: 'ss-sailor-1' },
    { trainerId: 'sailor-3', x: 15, y: 10, facing: 'left', sightRange: 3, flag: 'ss-sailor-2' },
    { trainerId: 'gentleman-2', x: 5, y: 5, facing: 'down', sightRange: 2, flag: 'ss-gent-1' },
    { trainerId: 'lass-4', x: 14, y: 5, facing: 'down', sightRange: 3, flag: 'ss-lass-1' },
  ],
  itemBalls: [
    { x: 17, y: 2, itemId: 22, quantity: 1, flag: 'ss-tm-body-slam' },
    { x: 2, y: 13, itemId: 20, quantity: 1, flag: 'ss-rare-candy' },
  ],
  signs: [],
  connections: [],
  music: 'ss-anne',
};
