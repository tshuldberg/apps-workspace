// === Lavender Town interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makeHouse } from './map-helpers.ts';

export const lavenderPokecenter: GameMap = makePokemonCenter(
  'lavender-pokecenter', 'lavender-town', 4, 6,
);

export const lavenderFujiHouse: GameMap = makeHouse(
  'lavender-fuji-house', 'lavender-town', 3, 12,
  [
    {
      id: 'fuji-aide', x: 1, y: 1, spriteId: 'girl', facing: 'right',
      movement: 'stationary',
      dialogue: ['Mr. FUJI takes care of abandoned POKeMON.', 'He\'s such a kind man!'],
    },
  ],
);

export const lavenderVolunteerHouse: GameMap = makeHouse(
  'lavender-volunteer-house', 'lavender-town', 12, 12,
  [
    {
      id: 'name-rater', x: 1, y: 0, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: ['Hello! I\'m the NAME RATER!', 'I rate the nicknames of POKeMON.', 'Want me to rate your POKeMON\'s name?'],
    },
  ],
);
