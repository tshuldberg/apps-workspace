// === Cerulean City — Home of Misty ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 20, h = 18;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree borders
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillRow(tiles, 0, h - 1, w, T.TREE);
fillRow(collisions, 0, h - 1, w, C.SOLID);
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// Main paths
fillRect(tiles, 9, 1, 2, 16, T.PATH);
fillRect(collisions, 9, 1, 2, 16, C.WALKABLE);
fillRect(tiles, 1, 9, 18, 2, T.PATH);
fillRect(collisions, 1, 9, 18, 2, C.WALKABLE);

// Cerulean Gym — north-center
placeBuilding(tiles, collisions, 7, 2, 5, 3, T.ROOF_BLUE);

// Pokemon Center — south-east
placeBuilding(tiles, collisions, 13, 6, 4, 3, T.ROOF_RED);

// Poke Mart — east
placeBuilding(tiles, collisions, 14, 12, 4, 2, T.ROOF_BLUE);

// Bike Shop — west
placeBuilding(tiles, collisions, 2, 6, 4, 3, T.ROOF_GREEN);

// House — south-west
placeBuilding(tiles, collisions, 2, 12, 3, 2, T.ROOF_RED);

// Robbed house (Rocket breaks in)
placeBuilding(tiles, collisions, 7, 12, 4, 2, T.ROOF_RED);

// Water area (north)
fillRect(tiles, 1, 1, 5, 2, T.WATER);
fillRect(collisions, 1, 1, 5, 2, C.WATER);
fillRect(tiles, 14, 1, 5, 3, T.WATER);
fillRect(collisions, 14, 1, 5, 3, C.WATER);

// Flowers
setTile(tiles, 12, 5, T.FLOWERS);
setTile(tiles, 6, 11, T.FLOWERS);
setTile(tiles, 13, 11, T.FLOWERS);

// Exits
setTile(tiles, 9, 0, T.PATH); setTile(collisions, 9, 0, C.WALKABLE);
setTile(tiles, 10, 0, T.PATH); setTile(collisions, 10, 0, C.WALKABLE);
setTile(tiles, 0, 9, T.PATH); setTile(collisions, 0, 9, C.WALKABLE);
setTile(tiles, 0, 10, T.PATH); setTile(collisions, 0, 10, C.WALKABLE);
setTile(tiles, w - 1, 9, T.PATH); setTile(collisions, w - 1, 9, C.WALKABLE);
setTile(tiles, w - 1, 10, T.PATH); setTile(collisions, w - 1, 10, C.WALKABLE);
setTile(tiles, 9, h - 1, T.PATH); setTile(collisions, 9, h - 1, C.WALKABLE);
setTile(tiles, 10, h - 1, T.PATH); setTile(collisions, 10, h - 1, C.WALKABLE);

export const ceruleanCity: GameMap = {
  id: 'cerulean-city',
  name: 'CERULEAN CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 9, y: 4, targetMap: 'gym-cerulean', targetX: 3, targetY: 7 },
    { x: 15, y: 8, targetMap: 'cerulean-pokecenter', targetX: 2, targetY: 3 },
    { x: 16, y: 13, targetMap: 'cerulean-mart', targetX: 2, targetY: 3 },
    { x: 4, y: 8, targetMap: 'cerulean-bike-shop', targetX: 2, targetY: 3 },
    { x: 3, y: 13, targetMap: 'cerulean-house-1', targetX: 3, targetY: 2 },
    { x: 9, y: 13, targetMap: 'cerulean-robbed-house', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'cerulean-officer', x: 8, y: 11, spriteId: 'officer', facing: 'up',
      movement: 'stationary',
      dialogue: ['A robbery! Someone broke into that house!', 'A suspicious character was seen running toward Route 24!'],
    },
    {
      id: 'cerulean-girl', x: 5, y: 5, spriteId: 'girl', facing: 'right',
      movement: 'wander',
      dialogue: ['I love swimming with my POKeMON!', 'The GYM LEADER MISTY is a great swimmer too!'],
    },
    {
      id: 'cerulean-boy', x: 14, y: 15, spriteId: 'boy', facing: 'up',
      movement: 'stationary',
      dialogue: ['Route 9 to the east leads to ROCK TUNNEL.', 'You\'ll need FLASH to see inside!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 8, y: 9, text: 'CERULEAN CITY\nA Mysterious, Blue Aura Surrounds It' },
    { x: 6, y: 3, text: 'CERULEAN CITY POKeMON GYM\nLEADER: MISTY\nThe Tomboyish Mermaid!' },
  ],
  connections: [
    { direction: 'north', mapId: 'route-24', offset: 0 },
    { direction: 'south', mapId: 'route-5', offset: 0 },
    { direction: 'left', mapId: 'route-4', offset: 0 },
    { direction: 'right', mapId: 'route-9', offset: 0 },
  ],
  music: 'cerulean-city',
};
