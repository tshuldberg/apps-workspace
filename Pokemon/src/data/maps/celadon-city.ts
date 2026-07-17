// === Celadon City — Home of Erika, Dept. Store, Game Corner ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 25, h = 18;
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

// Main paths
fillRect(tiles, 12, 1, 2, 16, T.PATH);
fillRect(collisions, 12, 1, 2, 16, C.WALKABLE);
fillRect(tiles, 1, 9, 23, 2, T.PATH);
fillRect(collisions, 1, 9, 23, 2, C.WALKABLE);

// Celadon Dept. Store (large, blue roof) — north-west
placeBuilding(tiles, collisions, 2, 2, 6, 4, T.ROOF_BLUE);

// Celadon Gym — south-west
placeBuilding(tiles, collisions, 2, 12, 5, 3, T.ROOF_GREEN);

// Game Corner — center-south
placeBuilding(tiles, collisions, 8, 12, 5, 3, T.ROOF_RED);

// Pokemon Center — east
placeBuilding(tiles, collisions, 17, 3, 4, 3, T.ROOF_RED);

// Celadon Mansion — north-east
placeBuilding(tiles, collisions, 17, 7, 4, 2, T.ROOF_BLUE);

// Hotel
placeBuilding(tiles, collisions, 15, 12, 4, 2, T.ROOF_RED);

// Restaurant
placeBuilding(tiles, collisions, 20, 12, 4, 2, T.ROOF_GREEN);

// Rocket Game Corner entrance (hidden)
setTile(tiles, 10, 14, T.STAIRS_DOWN);
setTile(collisions, 10, 14, C.WARP);

// Flowers and garden (Celadon is known for flowers)
fillRect(tiles, 8, 3, 3, 2, T.FLOWERS);
fillRect(tiles, 15, 5, 2, 2, T.FLOWERS);
setTile(tiles, 6, 11, T.FLOWERS);
setTile(tiles, 14, 15, T.FLOWERS);

// Trees
fillRect(tiles, 8, 6, 3, 2, T.TREE);
fillRect(collisions, 8, 6, 3, 2, C.SOLID);

// Exits
setTile(tiles, 0, 9, T.PATH); setTile(collisions, 0, 9, C.WALKABLE);
setTile(tiles, 0, 10, T.PATH); setTile(collisions, 0, 10, C.WALKABLE);
setTile(tiles, w - 1, 9, T.PATH); setTile(collisions, w - 1, 9, C.WALKABLE);
setTile(tiles, w - 1, 10, T.PATH); setTile(collisions, w - 1, 10, C.WALKABLE);

export const celadonCity: GameMap = {
  id: 'celadon-city',
  name: 'CELADON CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 5, y: 5, targetMap: 'celadon-dept-store', targetX: 3, targetY: 7 },
    { x: 4, y: 14, targetMap: 'gym-celadon', targetX: 3, targetY: 7 },
    { x: 10, y: 14, targetMap: 'celadon-game-corner', targetX: 5, targetY: 7 },
    { x: 19, y: 5, targetMap: 'celadon-pokecenter', targetX: 2, targetY: 3 },
    { x: 19, y: 8, targetMap: 'celadon-mansion', targetX: 3, targetY: 2 },
    { x: 17, y: 13, targetMap: 'celadon-hotel', targetX: 3, targetY: 2 },
    { x: 22, y: 13, targetMap: 'celadon-restaurant', targetX: 3, targetY: 2 },
    // Rocket Hideout at (10,14) is behind the Game Corner poster — triggered via event, not tile warp
  ],
  npcs: [
    {
      id: 'celadon-girl', x: 9, y: 5, spriteId: 'girl', facing: 'down',
      movement: 'wander',
      dialogue: ['CELADON\'s department store is amazing!', 'They sell everything a trainer could need!'],
    },
    {
      id: 'celadon-man', x: 16, y: 11, spriteId: 'boy', facing: 'left',
      movement: 'stationary',
      dialogue: ['The GAME CORNER is so fun!', 'But I keep losing coins...'],
    },
    {
      id: 'celadon-rocket', x: 7, y: 13, spriteId: 'rocket', facing: 'right',
      movement: 'stationary',
      dialogue: ['Hey! What are you looking at?', 'Get lost, kid!'],
      condition: 'before-rocket-hideout',
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 11, y: 9, text: 'CELADON CITY\nThe City of Rainbow Dreams' },
    { x: 1, y: 13, text: 'CELADON CITY POKeMON GYM\nLEADER: ERIKA\nThe Nature-Loving Princess!' },
  ],
  connections: [
    { direction: 'left', mapId: 'route-16', offset: 0 },
    { direction: 'right', mapId: 'route-7', offset: 0 },
  ],
  music: 'celadon-city',
};
