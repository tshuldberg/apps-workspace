// === Route 3 Pokemon Center (near Mt. Moon) ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter } from './map-helpers.ts';

export const route3Pokecenter: GameMap = makePokemonCenter(
  'route3-pokecenter', 'route-3', 28, 7,
);
