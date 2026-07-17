// === Pewter City interior maps ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, setTile, makePokemonCenter, makePokeMart, makeHouse, makeGym, T, C } from './map-helpers.ts';

export const pewterPokecenter: GameMap = makePokemonCenter(
  'pewter-pokecenter', 'pewter-city', 15, 9,
);

export const pewterMart: GameMap = makePokeMart(
  'pewter-mart', 'pewter-city', 5, 14,
);

export const pewterHouse: GameMap = makeHouse(
  'pewter-house', 'pewter-city', 14, 14,
  [
    {
      id: 'pewter-h-npc', x: 1, y: 1, spriteId: 'woman', facing: 'down',
      movement: 'stationary',
      dialogue: ['My husband works at the MUSEUM.', 'He\'s always going on about fossils!'],
    },
  ],
);

export const gymPewter: GameMap = makeGym(
  'gym-pewter', 'PEWTER CITY GYM', 5, 8,
  'pewter-city', 4, 5,
  [
    { trainerId: 'camper-1', x: 3, y: 5, facing: 'left', sightRange: 3, flag: 'gym-pewter-1' },
  ],
  [
    {
      id: 'brock', x: 2, y: 1, spriteId: 'brock', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'BROCK: I\'m BROCK! I\'m PEWTER\'s GYM LEADER!',
        'I believe in rock-hard defense and determination!',
        'That\'s why my POKeMON are all the rock type!',
        'Show me your best!',
      ],
    },
  ],
);

// Pewter Museum — simplified as a single room
const musW = 7, musH = 6;
const musTiles = makeGrid(musW, musH, T.FLOOR);
const musCollisions = makeGrid(musW, musH, C.WALKABLE);

// Top row: exhibits
fillRow(musTiles, 0, 0, musW, T.SHELF);
fillRow(musCollisions, 0, 0, musW, C.SOLID);
// Exhibit counters
fillRect(musTiles, 1, 2, 2, 1, T.COUNTER);
fillRect(musCollisions, 1, 2, 2, 1, C.SOLID);
fillRect(musTiles, 4, 2, 2, 1, T.COUNTER);
fillRect(musCollisions, 4, 2, 2, 1, C.SOLID);
// Door
setTile(musTiles, 3, musH - 1, T.DOOR);
setTile(musCollisions, 3, musH - 1, C.WARP);

export const pewterMuseum: GameMap = {
  id: 'pewter-museum',
  name: 'PEWTER MUSEUM',
  width: musW, height: musH,
  tiles: musTiles, collisions: musCollisions,
  warps: [
    { x: 3, y: musH - 1, targetMap: 'pewter-city', targetX: 15, targetY: 4 },
  ],
  npcs: [
    {
      id: 'museum-guide', x: 1, y: 3, spriteId: 'scientist', facing: 'right',
      movement: 'stationary',
      dialogue: ['Welcome to PEWTER MUSEUM of SCIENCE!', 'Admission is $50!', 'Just kidding, come on in!'],
    },
    {
      id: 'museum-researcher', x: 5, y: 3, spriteId: 'scientist', facing: 'left',
      movement: 'stationary',
      dialogue: ['This fossil is from millions of years ago!', 'Ancient POKeMON were incredible creatures.'],
    },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [
    { x: 1, y: 2, text: 'KABUTOPS Fossil\nA vicious and agile predator from prehistory.' },
    { x: 4, y: 2, text: 'AERODACTYL Fossil\nThis extinct POKeMON once soared through ancient skies.' },
  ],
  connections: [],
  music: 'museum',
};
