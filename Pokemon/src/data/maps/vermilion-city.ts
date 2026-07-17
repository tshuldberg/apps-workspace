// === Vermilion City — Home of Lt. Surge ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 20, h = 18;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree/fence borders
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// South: water/port area
fillRect(tiles, 0, 15, w, 3, T.WATER);
fillRect(collisions, 0, 15, w, 3, C.WATER);
fillRect(tiles, 6, 15, 8, 1, T.PATH);  // dock
fillRect(collisions, 6, 15, 8, 1, C.WALKABLE);

// Main paths
fillRect(tiles, 9, 0, 2, 15, T.PATH);
fillRect(collisions, 9, 0, 2, 15, C.WALKABLE);
fillRect(tiles, 1, 8, 18, 2, T.PATH);
fillRect(collisions, 1, 8, 18, 2, C.WALKABLE);
fillRect(tiles, 6, 12, 8, 3, T.PATH);
fillRect(collisions, 6, 12, 8, 3, C.WALKABLE);

// Vermilion Gym — south-west
placeBuilding(tiles, collisions, 2, 4, 5, 3, T.ROOF_GREEN);

// Pokemon Center — north-east
placeBuilding(tiles, collisions, 13, 2, 4, 3, T.ROOF_RED);

// Poke Mart — mid-east
placeBuilding(tiles, collisions, 14, 6, 4, 2, T.ROOF_BLUE);

// Pokemon Fan Club
placeBuilding(tiles, collisions, 2, 10, 4, 2, T.ROOF_RED);

// SS Anne dock building
placeBuilding(tiles, collisions, 8, 13, 4, 2, T.ROOF_BLUE);

// House
placeBuilding(tiles, collisions, 14, 10, 3, 2, T.ROOF_RED);

// Cut tree blocking gym path
setTile(tiles, 4, 3, T.CUT_TREE);
setTile(collisions, 4, 3, C.CUT_TREE);

// Flowers
setTile(tiles, 8, 3, T.FLOWERS);
setTile(tiles, 12, 11, T.FLOWERS);

// North exit
setTile(tiles, 9, 0, T.PATH); setTile(collisions, 9, 0, C.WALKABLE);
setTile(tiles, 10, 0, T.PATH); setTile(collisions, 10, 0, C.WALKABLE);

// East exit
setTile(tiles, w - 1, 8, T.PATH); setTile(collisions, w - 1, 8, C.WALKABLE);
setTile(tiles, w - 1, 9, T.PATH); setTile(collisions, w - 1, 9, C.WALKABLE);

export const vermilionCity: GameMap = {
  id: 'vermilion-city',
  name: 'VERMILION CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 4, y: 6, targetMap: 'gym-vermilion', targetX: 2, targetY: 7 },
    { x: 15, y: 4, targetMap: 'vermilion-pokecenter', targetX: 2, targetY: 3 },
    { x: 16, y: 7, targetMap: 'vermilion-mart', targetX: 2, targetY: 3 },
    { x: 4, y: 11, targetMap: 'vermilion-fan-club', targetX: 3, targetY: 2 },
    { x: 10, y: 14, targetMap: 'ss-anne-1f', targetX: 10, targetY: 19 },
    { x: 15, y: 11, targetMap: 'vermilion-house', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'vermilion-sailor', x: 7, y: 14, spriteId: 'sailor', facing: 'right',
      movement: 'stationary',
      dialogue: ['The SS ANNE is a famous luxury cruise ship.', 'You need an SS TICKET to get on!'],
      condition: 'no-ss-ticket',
    },
    {
      id: 'vermilion-girl', x: 12, y: 5, spriteId: 'girl', facing: 'left',
      movement: 'wander',
      dialogue: ['Lt. SURGE is the GYM LEADER here!', 'He\'s an ELECTRIC-type expert!'],
    },
    {
      id: 'vermilion-officer', x: 8, y: 9, spriteId: 'officer', facing: 'down',
      movement: 'stationary',
      dialogue: ['VERMILION PORT is the gateway to the world!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 8, y: 8, text: 'VERMILION CITY\nThe Port of Exquisite Sunsets' },
    { x: 6, y: 5, text: 'VERMILION CITY POKeMON GYM\nLEADER: LT. SURGE\nThe Lightning American!' },
  ],
  connections: [
    { direction: 'north', mapId: 'route-6', offset: 0 },
    { direction: 'right', mapId: 'route-11', offset: 0 },
  ],
  music: 'vermilion-city',
};
