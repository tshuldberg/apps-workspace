// === Fuchsia City — Home of Koga, Safari Zone ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 20, h = 18;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Borders
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillRow(tiles, 0, h - 1, w, T.TREE);
fillRow(collisions, 0, h - 1, w, C.SOLID);
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// Paths
fillRect(tiles, 9, 1, 2, 16, T.PATH);
fillRect(collisions, 9, 1, 2, 16, C.WALKABLE);
fillRect(tiles, 1, 9, 18, 2, T.PATH);
fillRect(collisions, 1, 9, 18, 2, C.WALKABLE);

// Fuchsia Gym — center
placeBuilding(tiles, collisions, 7, 12, 5, 3, T.ROOF_GREEN);

// Pokemon Center
placeBuilding(tiles, collisions, 2, 3, 4, 3, T.ROOF_RED);

// Poke Mart
placeBuilding(tiles, collisions, 14, 3, 4, 2, T.ROOF_BLUE);

// Safari Zone entrance — north
placeBuilding(tiles, collisions, 7, 1, 6, 3, T.ROOF_GREEN);

// Warden's house
placeBuilding(tiles, collisions, 14, 12, 4, 2, T.ROOF_RED);

// House
placeBuilding(tiles, collisions, 2, 12, 3, 2, T.ROOF_BLUE);

// Fence around Safari Zone area
fillRow(tiles, 1, 5, 6, T.FENCE);
fillRow(collisions, 1, 5, 6, C.SOLID);
fillRow(tiles, 13, 5, 6, T.FENCE);
fillRow(collisions, 13, 5, 6, C.SOLID);

// Flowers
setTile(tiles, 6, 7, T.FLOWERS);
setTile(tiles, 13, 7, T.FLOWERS);
setTile(tiles, 5, 15, T.FLOWERS);

// Exits
setTile(tiles, 0, 9, T.PATH); setTile(collisions, 0, 9, C.WALKABLE);
setTile(tiles, 0, 10, T.PATH); setTile(collisions, 0, 10, C.WALKABLE);
setTile(tiles, w - 1, 9, T.PATH); setTile(collisions, w - 1, 9, C.WALKABLE);
setTile(tiles, w - 1, 10, T.PATH); setTile(collisions, w - 1, 10, C.WALKABLE);
// South water exit
fillRect(tiles, 8, h - 1, 4, 1, T.WATER_EDGE);
fillRect(collisions, 8, h - 1, 4, 1, C.WATER);

export const fuchsiaCity: GameMap = {
  id: 'fuchsia-city',
  name: 'FUCHSIA CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 9, y: 14, targetMap: 'gym-fuchsia', targetX: 3, targetY: 7 },
    { x: 4, y: 5, targetMap: 'fuchsia-pokecenter', targetX: 2, targetY: 3 },
    { x: 16, y: 4, targetMap: 'fuchsia-mart', targetX: 2, targetY: 3 },
    { x: 10, y: 3, targetMap: 'safari-zone-1', targetX: 10, targetY: 19 },
    { x: 16, y: 13, targetMap: 'fuchsia-warden-house', targetX: 3, targetY: 2 },
    { x: 3, y: 13, targetMap: 'fuchsia-house', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'fuchsia-girl', x: 6, y: 9, spriteId: 'girl', facing: 'right',
      movement: 'wander',
      dialogue: ['The SAFARI ZONE is amazing!', 'You can catch rare POKeMON there!'],
    },
    {
      id: 'fuchsia-boy', x: 12, y: 15, spriteId: 'boy', facing: 'up',
      movement: 'stationary',
      dialogue: ['KOGA is a master of POISON-type POKeMON!', 'His invisible walls are tricky!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 8, y: 9, text: 'FUCHSIA CITY\nBehold! It\'s Passion Pink!' },
    { x: 6, y: 13, text: 'FUCHSIA CITY POKeMON GYM\nLEADER: KOGA\nThe Poisonous Ninja Master' },
  ],
  connections: [
    { direction: 'left', mapId: 'route-18', offset: 0 },
    { direction: 'right', mapId: 'route-15', offset: 0 },
  ],
  music: 'fuchsia-city',
};
