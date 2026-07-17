// === Cerulean City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makePokeMart, makeHouse, makeGym, makeGrid, fillRect, setTile, T, C } from './map-helpers.ts';

export const ceruleanPokecenter: GameMap = makePokemonCenter(
  'cerulean-pokecenter', 'cerulean-city', 15, 9,
);

export const ceruleanMart: GameMap = makePokeMart(
  'cerulean-mart', 'cerulean-city', 16, 14,
);

export const ceruleanBikeShop: GameMap = {
  ...makePokeMart('cerulean-bike-shop', 'cerulean-city', 4, 9),
  name: 'Bike Shop',
  npcs: [
    {
      id: 'bike-shop-owner', x: 1, y: 0, spriteId: 'clerk', facing: 'down',
      movement: 'stationary',
      dialogue: ['Welcome to the BIKE SHOP!', 'A BICYCLE costs $1,000,000!', 'But if you have a BIKE VOUCHER, I\'ll trade you for one!'],
    },
  ],
  music: 'poke-mart',
};

export const ceruleanHouse1: GameMap = makeHouse(
  'cerulean-house-1', 'cerulean-city', 3, 14,
  [
    {
      id: 'cerulean-h1-npc', x: 1, y: 1, spriteId: 'woman', facing: 'right',
      movement: 'stationary',
      dialogue: ['CERULEAN CITY has always been known for its beautiful blue river.'],
    },
  ],
);

export const ceruleanRobbedHouse: GameMap = makeHouse(
  'cerulean-robbed-house', 'cerulean-city', 9, 14,
  [
    {
      id: 'robbed-man', x: 2, y: 1, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: ['A TEAM ROCKET thug broke in and stole a TM!', 'He went out through a hole in back!'],
    },
  ],
);

export const gymCerulean: GameMap = makeGym(
  'gym-cerulean', 'CERULEAN CITY GYM', 7, 8,
  'cerulean-city', 9, 5,
  [
    { trainerId: 'swimmer-f-1', x: 2, y: 5, facing: 'right', sightRange: 3, flag: 'gym-cerulean-1' },
    { trainerId: 'swimmer-f-2', x: 5, y: 4, facing: 'left', sightRange: 3, flag: 'gym-cerulean-2' },
  ],
  [
    {
      id: 'misty', x: 3, y: 1, spriteId: 'misty', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'MISTY: Hi, you\'re a new face!',
        'I\'m the world-famous beauty, MISTY!',
        'My policy is an all-out offensive with WATER-type POKeMON!',
      ],
    },
  ],
);

// Add water tiles to gym interior
const gymTiles = gymCerulean.tiles;
const gymColl = gymCerulean.collisions;
fillRect(gymTiles, 1, 3, 2, 3, T.WATER);
fillRect(gymColl, 1, 3, 2, 3, C.WATER);
fillRect(gymTiles, 4, 2, 2, 4, T.WATER);
fillRect(gymColl, 4, 2, 2, 4, C.WATER);
