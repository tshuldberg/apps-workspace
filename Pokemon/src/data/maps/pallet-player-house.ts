// === Player's House in Pallet Town ===

import type { GameMap } from '../game-types.ts';
import { makeHouse } from './map-helpers.ts';

export const palletPlayerHouse: GameMap = makeHouse(
  'pallet-player-house',
  'pallet-town', 3, 4,
  [
    {
      id: 'player-mom', x: 1, y: 1, spriteId: 'mom', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'MOM: Right. All boys leave home some day.',
        'It said so on TV.',
        'Oh yes, Prof. OAK next door was looking for you.',
      ],
    },
  ],
);
