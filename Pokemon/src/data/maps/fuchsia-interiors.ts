// === Fuchsia City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makePokeMart, makeHouse, makeGym } from './map-helpers.ts';

export const fuchsiaPokecenter: GameMap = makePokemonCenter(
  'fuchsia-pokecenter', 'fuchsia-city', 4, 6,
);

export const fuchsiaMart: GameMap = makePokeMart(
  'fuchsia-mart', 'fuchsia-city', 16, 5,
);

export const fuchsiaHouse: GameMap = makeHouse(
  'fuchsia-house', 'fuchsia-city', 3, 14,
  [
    {
      id: 'fuchsia-h-npc', x: 1, y: 1, spriteId: 'woman', facing: 'down',
      movement: 'stationary',
      dialogue: ['Lots of trainers come here for the SAFARI ZONE!'],
    },
  ],
);

export const fuchsiaWardenHouse: GameMap = makeHouse(
  'fuchsia-warden-house', 'fuchsia-city', 16, 14,
  [
    {
      id: 'warden', x: 1, y: 1, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'Rrr... Rrrr... I can\'t talk without my teeth!',
        'Oh! My GOLD TEETH! Thank you!',
        'Here, take HM04 STRENGTH as a reward!',
      ],
    },
  ],
);

export const gymFuchsia: GameMap = makeGym(
  'gym-fuchsia', 'FUCHSIA CITY GYM', 7, 8,
  'fuchsia-city', 9, 15,
  [
    { trainerId: 'juggler-1', x: 2, y: 5, facing: 'right', sightRange: 3, flag: 'gym-fuchsia-1' },
    { trainerId: 'juggler-2', x: 5, y: 4, facing: 'left', sightRange: 3, flag: 'gym-fuchsia-2' },
    { trainerId: 'tamer-1', x: 1, y: 3, facing: 'right', sightRange: 2, flag: 'gym-fuchsia-3' },
  ],
  [
    {
      id: 'koga', x: 3, y: 1, spriteId: 'koga', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'KOGA: Fwahahaha!',
        'A mere child like you dares to challenge me?',
        'Very well. I shall show you true terror!',
        'Beware my POISON-type POKeMON!',
      ],
    },
  ],
);
