// === Viridian City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makePokeMart, makeHouse, makeGym } from './map-helpers.ts';

export const viridianPokecenter: GameMap = makePokemonCenter(
  'viridian-pokecenter', 'viridian-city', 14, 5,
);

export const viridianMart: GameMap = makePokeMart(
  'viridian-mart', 'viridian-city', 14, 8,
  ['Welcome!', 'Here, you go! Prof. OAK asked me to give this to you.', 'It\'s a PARCEL for the PROF.'],
);

export const viridianHouse1: GameMap = makeHouse(
  'viridian-house-1', 'viridian-city', 3, 13,
  [
    {
      id: 'viridian-h1-npc', x: 1, y: 1, spriteId: 'old-man', facing: 'right',
      movement: 'stationary',
      dialogue: ['When I was young, POKeMON were everywhere.', 'You could find them in tall grass on any route.'],
    },
  ],
);

export const viridianHouse2: GameMap = makeHouse(
  'viridian-house-2', 'viridian-city', 15, 13,
  [
    {
      id: 'viridian-h2-npc', x: 2, y: 1, spriteId: 'woman', facing: 'down',
      movement: 'stationary',
      dialogue: ['The shop in this town sells all sorts of useful items.', 'You should stock up before heading out!'],
    },
  ],
);

export const gymViridian: GameMap = makeGym(
  'gym-viridian', 'VIRIDIAN CITY GYM', 5, 8,
  'viridian-city', 4, 5,
  [
    { trainerId: 'cooltrainer-m-1', x: 1, y: 5, facing: 'right', sightRange: 3, flag: 'gym-viridian-1' },
    { trainerId: 'cooltrainer-f-1', x: 3, y: 3, facing: 'down', sightRange: 3, flag: 'gym-viridian-2' },
    { trainerId: 'blackbelt-1', x: 1, y: 2, facing: 'right', sightRange: 2, flag: 'gym-viridian-3' },
  ],
  [
    {
      id: 'giovanni-gym', x: 2, y: 1, spriteId: 'giovanni', facing: 'down',
      movement: 'stationary',
      dialogue: ['GIOVANNI: So, you have come this far.', 'Let me show you the true power of GROUND-type POKeMON!'],
    },
  ],
);
