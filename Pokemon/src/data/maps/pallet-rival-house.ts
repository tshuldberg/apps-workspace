// === Rival's House in Pallet Town ===

import type { GameMap } from '../game-types.ts';
import { makeHouse } from './map-helpers.ts';

export const palletRivalHouse: GameMap = makeHouse(
  'pallet-rival-house',
  'pallet-town', 7, 4,
  [
    {
      id: 'rival-sister', x: 2, y: 1, spriteId: 'girl', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'My brother is out at Grandpa\'s lab.',
        'Grandpa asked him to come, too.',
      ],
    },
  ],
);
