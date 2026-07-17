// === Viridian Forest — Bug-type haven ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

const w = 15, h = 30;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Dense tree borders
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillRow(tiles, 0, h - 1, w, T.TREE);
fillRow(collisions, 0, h - 1, w, C.SOLID);

// Interior tree clusters forming maze-like paths
// Left cluster
fillRect(tiles, 3, 3, 3, 4, T.TREE);
fillRect(collisions, 3, 3, 3, 4, C.SOLID);
// Right cluster
fillRect(tiles, 9, 2, 4, 3, T.TREE);
fillRect(collisions, 9, 2, 4, 3, C.SOLID);
// Mid-left cluster
fillRect(tiles, 2, 10, 4, 3, T.TREE);
fillRect(collisions, 2, 10, 4, 3, C.SOLID);
// Mid-right cluster
fillRect(tiles, 8, 8, 3, 5, T.TREE);
fillRect(collisions, 8, 8, 3, 5, C.SOLID);
// Center cluster
fillRect(tiles, 5, 15, 5, 3, T.TREE);
fillRect(collisions, 5, 15, 5, 3, C.SOLID);
// Lower-left cluster
fillRect(tiles, 1, 20, 4, 3, T.TREE);
fillRect(collisions, 1, 20, 4, 3, C.SOLID);
// Lower-right cluster
fillRect(tiles, 10, 18, 3, 4, T.TREE);
fillRect(collisions, 10, 18, 3, 4, C.SOLID);
// Bottom cluster
fillRect(tiles, 4, 24, 5, 3, T.TREE);
fillRect(collisions, 4, 24, 5, 3, C.SOLID);

// Tall grass patches throughout
fillRect(tiles, 1, 1, 2, 2, T.TALL_GRASS);
fillRect(collisions, 1, 1, 2, 2, C.TALL_GRASS);
fillRect(tiles, 6, 1, 3, 3, T.TALL_GRASS);
fillRect(collisions, 6, 1, 3, 3, C.TALL_GRASS);
fillRect(tiles, 1, 7, 2, 3, T.TALL_GRASS);
fillRect(collisions, 1, 7, 2, 3, C.TALL_GRASS);
fillRect(tiles, 6, 7, 2, 3, T.TALL_GRASS);
fillRect(collisions, 6, 7, 2, 3, C.TALL_GRASS);
fillRect(tiles, 11, 6, 3, 2, T.TALL_GRASS);
fillRect(collisions, 11, 6, 3, 2, C.TALL_GRASS);
fillRect(tiles, 1, 14, 4, 3, T.TALL_GRASS);
fillRect(collisions, 1, 14, 4, 3, C.TALL_GRASS);
fillRect(tiles, 10, 14, 4, 3, T.TALL_GRASS);
fillRect(collisions, 10, 14, 4, 3, C.TALL_GRASS);
fillRect(tiles, 5, 19, 5, 2, T.TALL_GRASS);
fillRect(collisions, 5, 19, 5, 2, C.TALL_GRASS);
fillRect(tiles, 1, 24, 3, 4, T.TALL_GRASS);
fillRect(collisions, 1, 24, 3, 4, C.TALL_GRASS);
fillRect(tiles, 9, 23, 4, 4, T.TALL_GRASS);
fillRect(collisions, 9, 23, 4, 4, C.TALL_GRASS);

// Paths through the maze
fillRect(tiles, 1, 5, 2, 2, T.PATH);
fillRect(collisions, 1, 5, 2, 2, C.WALKABLE);

// North exit (to Route 2 north section)
setTile(tiles, 1, 0, T.PATH);
setTile(collisions, 1, 0, C.WALKABLE);

// South exit (to Route 2 south section)
setTile(tiles, 7, h - 1, T.PATH);
setTile(collisions, 7, h - 1, C.WALKABLE);

export const viridianForest: GameMap = {
  id: 'viridian-forest',
  name: 'VIRIDIAN FOREST',
  width: w, height: h,
  tiles, collisions,
  warps: [
    // North exit → Route 2 (north side of forest gate building)
    { x: 1, y: 0, targetMap: 'route-2', targetX: 4, targetY: 9 },
    // South exit → Route 2 (south side of forest gate building)
    { x: 7, y: h - 1, targetMap: 'route-2', targetX: 5, targetY: 12 },
  ],
  npcs: [],
  wildEncounters: [
    { speciesId: 10, levelMin: 3, levelMax: 5, rate: 80 },   // Caterpie
    { speciesId: 11, levelMin: 4, levelMax: 6, rate: 30 },   // Metapod
    { speciesId: 13, levelMin: 3, levelMax: 5, rate: 80 },   // Weedle
    { speciesId: 14, levelMin: 4, levelMax: 6, rate: 30 },   // Kakuna
    { speciesId: 25, levelMin: 3, levelMax: 5, rate: 10 },   // Pikachu (rare)
  ],
  trainerPlacements: [
    { trainerId: 'bug-catcher-1', x: 7, y: 5, facing: 'left', sightRange: 3, flag: 'vf-trainer-1' },
    { trainerId: 'bug-catcher-2', x: 3, y: 13, facing: 'right', sightRange: 3, flag: 'vf-trainer-2' },
    { trainerId: 'bug-catcher-3', x: 10, y: 22, facing: 'up', sightRange: 4, flag: 'vf-trainer-3' },
  ],
  itemBalls: [
    { x: 12, y: 5, itemId: 4, quantity: 1, flag: 'vf-pokeball' },    // Poke Ball
    { x: 2, y: 18, itemId: 18, quantity: 1, flag: 'vf-antidote' },   // Antidote
    { x: 13, y: 27, itemId: 17, quantity: 1, flag: 'vf-potion' },    // Potion
  ],
  signs: [],
  connections: [],
  music: 'viridian-forest',
};
