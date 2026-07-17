// === Cinnabar Island interior maps ===

import type { GameMap } from '../game-types.ts';
import { makePokemonCenter, makePokeMart, makeGym, makeGrid, fillRect, fillRow, setTile, T, C } from './map-helpers.ts';

export const cinnabarPokecenter: GameMap = makePokemonCenter(
  'cinnabar-pokecenter', 'cinnabar-island', 11, 5,
);

export const cinnabarMart: GameMap = makePokeMart(
  'cinnabar-mart', 'cinnabar-island', 11, 11,
);

// Pokemon Lab (fossil revival, etc.)
const labW = 7, labH = 6;
const labTiles = makeGrid(labW, labH, T.FLOOR);
const labColl = makeGrid(labW, labH, C.WALKABLE);
fillRow(labTiles, 0, 0, labW, T.SHELF);
fillRow(labColl, 0, 0, labW, C.SOLID);
fillRect(labTiles, 1, 2, 2, 1, T.COUNTER);
fillRect(labColl, 1, 2, 2, 1, C.SOLID);
fillRect(labTiles, 4, 2, 2, 1, T.COUNTER);
fillRect(labColl, 4, 2, 2, 1, C.SOLID);
setTile(labTiles, 3, labH - 1, T.DOOR);
setTile(labColl, 3, labH - 1, C.WARP);

export const cinnabarLab: GameMap = {
  id: 'cinnabar-lab',
  name: 'POKeMON LAB',
  width: labW, height: labH,
  tiles: labTiles, collisions: labColl,
  warps: [
    { x: 3, y: labH - 1, targetMap: 'cinnabar-island', targetX: 5, targetY: 11 },
  ],
  npcs: [
    {
      id: 'lab-scientist-1', x: 2, y: 2, spriteId: 'scientist', facing: 'down',
      movement: 'stationary',
      dialogue: ['I can revive fossils into living POKeMON!', 'Bring me a fossil and I\'ll bring it back to life!'],
    },
    {
      id: 'lab-scientist-2', x: 5, y: 2, spriteId: 'scientist', facing: 'down',
      movement: 'stationary',
      dialogue: ['We research POKeMON evolution here.', 'Did you know some POKeMON only evolve by trading?'],
    },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [], music: 'pokemon-center',
};

// Cinnabar Gym (quiz-based gym)
export const gymCinnabar: GameMap = makeGym(
  'gym-cinnabar', 'CINNABAR ISLAND GYM', 7, 8,
  'cinnabar-island', 5, 6,
  [
    { trainerId: 'super-nerd-1', x: 2, y: 6, facing: 'right', sightRange: 2, flag: 'gym-cinnabar-1' },
    { trainerId: 'burglar-1', x: 5, y: 5, facing: 'left', sightRange: 3, flag: 'gym-cinnabar-2' },
    { trainerId: 'super-nerd-2', x: 2, y: 4, facing: 'right', sightRange: 2, flag: 'gym-cinnabar-3' },
    { trainerId: 'burglar-2', x: 5, y: 3, facing: 'left', sightRange: 3, flag: 'gym-cinnabar-4' },
    { trainerId: 'super-nerd-3', x: 2, y: 2, facing: 'right', sightRange: 2, flag: 'gym-cinnabar-5' },
  ],
  [
    {
      id: 'blaine', x: 3, y: 1, spriteId: 'blaine', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'BLAINE: Hah!',
        'I am BLAINE! I am the GYM LEADER of CINNABAR ISLAND!',
        'My fiery POKeMON are all warmed up and ready to battle!',
        'You better have BURN HEAL!',
      ],
    },
  ],
);

// Pokemon Mansion 1F (simplified)
const pmW = 15, pmH = 15;
const pmTiles = makeGrid(pmW, pmH, T.FLOOR);
const pmColl = makeGrid(pmW, pmH, C.WALKABLE);
fillRow(pmTiles, 0, 0, pmW, T.BUILDING_WALL);
fillRow(pmColl, 0, 0, pmW, C.SOLID);
fillRow(pmTiles, 0, pmH - 1, pmW, T.BUILDING_WALL);
fillRow(pmColl, 0, pmH - 1, pmW, C.SOLID);
fillRect(pmTiles, 0, 0, 1, pmH, T.BUILDING_WALL);
fillRect(pmColl, 0, 0, 1, pmH, C.SOLID);
fillRect(pmTiles, pmW - 1, 0, 1, pmH, T.BUILDING_WALL);
fillRect(pmColl, pmW - 1, 0, 1, pmH, C.SOLID);
// Interior walls
fillRect(pmTiles, 5, 3, 5, 2, T.BUILDING_WALL);
fillRect(pmColl, 5, 3, 5, 2, C.SOLID);
fillRect(pmTiles, 3, 8, 3, 4, T.BUILDING_WALL);
fillRect(pmColl, 3, 8, 3, 4, C.SOLID);
fillRect(pmTiles, 9, 7, 4, 3, T.BUILDING_WALL);
fillRect(pmColl, 9, 7, 4, 3, C.SOLID);
// Stairs
setTile(pmTiles, 12, 1, T.STAIRS_DOWN);
setTile(pmColl, 12, 1, C.WARP);
// Exit
setTile(pmTiles, 8, pmH - 1, T.DOOR);
setTile(pmColl, 8, pmH - 1, C.WARP);

export const pokemonMansion1F: GameMap = {
  id: 'pokemon-mansion-1f',
  name: 'POKeMON MANSION 1F',
  width: pmW, height: pmH,
  tiles: pmTiles, collisions: pmColl,
  warps: [
    { x: 8, y: pmH - 1, targetMap: 'cinnabar-island', targetX: 7, targetY: 3 },
    { x: 12, y: 1, targetMap: 'pokemon-mansion-b1f', targetX: 12, targetY: 1 },
  ],
  npcs: [],
  wildEncounters: [
    { speciesId: 77, levelMin: 34, levelMax: 38, rate: 60 },   // Ponyta
    { speciesId: 109, levelMin: 30, levelMax: 36, rate: 80 },  // Koffing
    { speciesId: 88, levelMin: 30, levelMax: 36, rate: 60 },   // Grimer
    { speciesId: 58, levelMin: 34, levelMax: 36, rate: 30 },   // Growlithe
  ],
  trainerPlacements: [
    { trainerId: 'burglar-3', x: 3, y: 5, facing: 'right', sightRange: 3, flag: 'pm-burglar-1' },
    { trainerId: 'scientist-1', x: 10, y: 5, facing: 'left', sightRange: 3, flag: 'pm-scientist-1' },
  ],
  itemBalls: [
    { x: 2, y: 1, itemId: 29, quantity: 1, flag: 'pm-escape-rope' },
    { x: 7, y: 6, itemId: 20, quantity: 1, flag: 'pm-rare-candy' },
  ],
  signs: [
    { x: 3, y: 1, text: 'A diary entry:\n"MEWTWO is far too powerful..."' },
    { x: 7, y: 1, text: 'A diary entry:\n"We used genetic engineering to create MEWTWO."' },
  ],
  connections: [],
  music: 'pokemon-mansion',
};

// Pokemon Mansion B1F (Secret Key location)
const pmb1Tiles = makeGrid(10, 10, T.FLOOR);
const pmb1Coll = makeGrid(10, 10, C.WALKABLE);
fillRow(pmb1Tiles, 0, 0, 10, T.BUILDING_WALL);
fillRow(pmb1Coll, 0, 0, 10, C.SOLID);
fillRow(pmb1Tiles, 0, 9, 10, T.BUILDING_WALL);
fillRow(pmb1Coll, 0, 9, 10, C.SOLID);
fillRect(pmb1Tiles, 0, 0, 1, 10, T.BUILDING_WALL);
fillRect(pmb1Coll, 0, 0, 1, 10, C.SOLID);
fillRect(pmb1Tiles, 9, 0, 1, 10, T.BUILDING_WALL);
fillRect(pmb1Coll, 9, 0, 1, 10, C.SOLID);
fillRect(pmb1Tiles, 3, 3, 4, 2, T.BUILDING_WALL);
fillRect(pmb1Coll, 3, 3, 4, 2, C.SOLID);
setTile(pmb1Tiles, 8, 1, T.STAIRS_UP);
setTile(pmb1Coll, 8, 1, C.WARP);

export const pokemonMansionB1F: GameMap = {
  id: 'pokemon-mansion-b1f',
  name: 'POKeMON MANSION B1F',
  width: 10, height: 10,
  tiles: pmb1Tiles, collisions: pmb1Coll,
  warps: [
    { x: 8, y: 1, targetMap: 'pokemon-mansion-1f', targetX: 12, targetY: 1 },
  ],
  npcs: [],
  wildEncounters: [
    { speciesId: 109, levelMin: 32, levelMax: 38, rate: 80 },
    { speciesId: 88, levelMin: 32, levelMax: 38, rate: 70 },
    { speciesId: 132, levelMin: 30, levelMax: 36, rate: 30 },  // Ditto
  ],
  trainerPlacements: [
    { trainerId: 'scientist-2', x: 3, y: 6, facing: 'right', sightRange: 3, flag: 'pm-b1-scientist' },
  ],
  itemBalls: [
    { x: 1, y: 8, itemId: 37, quantity: 1, flag: 'pm-secret-key' },  // Secret Key
  ],
  signs: [
    { x: 2, y: 1, text: 'A diary entry:\n"Feb 6: MEWTWO was born. It is far too powerful. We have failed to curb its vicious tendencies..."' },
  ],
  connections: [],
  music: 'pokemon-mansion',
};
