// === Saffron City — Home of Sabrina, Silph Co. ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 24, h = 20;
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

// Main roads (grid pattern)
fillRect(tiles, 11, 1, 2, 18, T.PATH);
fillRect(collisions, 11, 1, 2, 18, C.WALKABLE);
fillRect(tiles, 1, 10, 22, 2, T.PATH);
fillRect(collisions, 1, 10, 22, 2, C.WALKABLE);
fillRect(tiles, 1, 5, 22, 1, T.PATH);
fillRect(collisions, 1, 5, 22, 1, C.WALKABLE);
fillRect(tiles, 1, 15, 22, 1, T.PATH);
fillRect(collisions, 1, 15, 22, 1, C.WALKABLE);

// Silph Co. (large building, center-north)
placeBuilding(tiles, collisions, 8, 1, 6, 4, T.ROOF_BLUE);

// Saffron Gym
placeBuilding(tiles, collisions, 3, 7, 5, 3, T.ROOF_GREEN);

// Fighting Dojo
placeBuilding(tiles, collisions, 16, 7, 5, 3, T.ROOF_RED);

// Pokemon Center
placeBuilding(tiles, collisions, 2, 13, 4, 2, T.ROOF_RED);

// Poke Mart
placeBuilding(tiles, collisions, 18, 13, 4, 2, T.ROOF_BLUE);

// Mr. Psychic's house
placeBuilding(tiles, collisions, 8, 16, 3, 2, T.ROOF_RED);

// Copycat's house
placeBuilding(tiles, collisions, 15, 16, 3, 2, T.ROOF_BLUE);

// Rocket guard at gates (NPC-based blocking)
// Flowers
setTile(tiles, 7, 6, T.FLOWERS);
setTile(tiles, 14, 6, T.FLOWERS);
setTile(tiles, 10, 15, T.FLOWERS);

// Exits (4 directions)
setTile(tiles, 0, 10, T.PATH); setTile(collisions, 0, 10, C.WALKABLE);
setTile(tiles, 0, 11, T.PATH); setTile(collisions, 0, 11, C.WALKABLE);
setTile(tiles, w - 1, 10, T.PATH); setTile(collisions, w - 1, 10, C.WALKABLE);
setTile(tiles, w - 1, 11, T.PATH); setTile(collisions, w - 1, 11, C.WALKABLE);
setTile(tiles, 11, 0, T.PATH); setTile(collisions, 11, 0, C.WALKABLE);
setTile(tiles, 12, 0, T.PATH); setTile(collisions, 12, 0, C.WALKABLE);
setTile(tiles, 11, h - 1, T.PATH); setTile(collisions, 11, h - 1, C.WALKABLE);
setTile(tiles, 12, h - 1, T.PATH); setTile(collisions, 12, h - 1, C.WALKABLE);

export const saffronCity: GameMap = {
  id: 'saffron-city',
  name: 'SAFFRON CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 11, y: 4, targetMap: 'silph-co-1f', targetX: 5, targetY: 9 },
    { x: 5, y: 9, targetMap: 'gym-saffron', targetX: 3, targetY: 7 },
    { x: 18, y: 9, targetMap: 'fighting-dojo', targetX: 3, targetY: 5 },
    { x: 4, y: 14, targetMap: 'saffron-pokecenter', targetX: 2, targetY: 3 },
    { x: 20, y: 14, targetMap: 'saffron-mart', targetX: 2, targetY: 3 },
    { x: 9, y: 17, targetMap: 'saffron-mr-psychic', targetX: 3, targetY: 2 },
    { x: 16, y: 17, targetMap: 'saffron-copycat', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'saffron-rocket-guard', x: 11, y: 6, spriteId: 'rocket', facing: 'down',
      movement: 'stationary',
      dialogue: ['TEAM ROCKET has taken over SILPH CO.!', 'No one gets in without our say-so!'],
      condition: 'before-silph-cleared',
    },
    {
      id: 'saffron-girl', x: 7, y: 11, spriteId: 'girl', facing: 'right',
      movement: 'wander',
      dialogue: ['SAFFRON CITY is the biggest city in KANTO!', 'SILPH CO. makes all kinds of POKeMON products!'],
    },
    {
      id: 'saffron-boy', x: 15, y: 5, spriteId: 'boy', facing: 'down',
      movement: 'stationary',
      dialogue: ['The FIGHTING DOJO used to be the official GYM.', 'But SABRINA defeated all of them!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 10, y: 10, text: 'SAFFRON CITY\nShining, Golden Land of Commerce' },
    { x: 2, y: 8, text: 'SAFFRON CITY POKeMON GYM\nLEADER: SABRINA\nThe Master of Psychic POKeMON!' },
    { x: 15, y: 8, text: 'FIGHTING DOJO\nThe Karate King awaits challengers!' },
  ],
  connections: [
    { direction: 'north', mapId: 'route-5', offset: 0 },
    { direction: 'south', mapId: 'route-6', offset: 0 },
    { direction: 'left', mapId: 'route-7', offset: 0 },
    { direction: 'right', mapId: 'route-8', offset: 0 },
  ],
  music: 'saffron-city',
};
