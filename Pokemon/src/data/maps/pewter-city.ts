// === Pewter City — Home of Brock ===

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
fillRect(tiles, 9, 1, 2, 16, T.PATH);  // N-S main road
fillRect(collisions, 9, 1, 2, 16, C.WALKABLE);
fillRect(tiles, 1, 9, 18, 2, T.PATH);   // E-W cross road
fillRect(collisions, 1, 9, 18, 2, C.WALKABLE);

// Pewter Gym (green roof) — west side
placeBuilding(tiles, collisions, 2, 2, 5, 3, T.ROOF_GREEN);

// Museum (blue roof) — north-east
placeBuilding(tiles, collisions, 13, 1, 5, 3, T.ROOF_BLUE);

// Pokemon Center (red roof) — south-east
placeBuilding(tiles, collisions, 13, 6, 4, 3, T.ROOF_RED);

// Poke Mart (blue roof) — south area
placeBuilding(tiles, collisions, 3, 12, 4, 2, T.ROOF_BLUE);

// House
placeBuilding(tiles, collisions, 13, 12, 3, 2, T.ROOF_RED);

// Rocky terrain / boulders
setTile(tiles, 7, 3, T.BOULDER);
setTile(collisions, 7, 3, C.SOLID);
setTile(tiles, 8, 5, T.BOULDER);
setTile(collisions, 8, 5, C.SOLID);
setTile(tiles, 2, 7, T.BOULDER);
setTile(collisions, 2, 7, C.SOLID);

// Flowers
setTile(tiles, 11, 4, T.FLOWERS);
setTile(tiles, 12, 4, T.FLOWERS);
setTile(tiles, 11, 14, T.FLOWERS);

// Fence
fillRow(tiles, 2, 6, 5, T.FENCE);
fillRow(collisions, 2, 6, 5, C.SOLID);

// Sign locations
setTile(tiles, 8, 9, T.SIGN_TILE);
setTile(tiles, 6, 3, T.SIGN_TILE);

// South exit (to Route 2)
setTile(tiles, 9, h - 1, T.PATH);
setTile(collisions, 9, h - 1, C.WALKABLE);
setTile(tiles, 10, h - 1, T.PATH);
setTile(collisions, 10, h - 1, C.WALKABLE);

// East exit (to Route 3)
setTile(tiles, w - 1, 9, T.PATH);
setTile(collisions, w - 1, 9, C.WALKABLE);
setTile(tiles, w - 1, 10, T.PATH);
setTile(collisions, w - 1, 10, C.WALKABLE);

export const pewterCity: GameMap = {
  id: 'pewter-city',
  name: 'PEWTER CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 4, y: 4, targetMap: 'gym-pewter', targetX: 2, targetY: 7 },
    { x: 15, y: 3, targetMap: 'pewter-museum', targetX: 3, targetY: 5 },
    { x: 15, y: 8, targetMap: 'pewter-pokecenter', targetX: 2, targetY: 3 },
    { x: 5, y: 13, targetMap: 'pewter-mart', targetX: 2, targetY: 3 },
    { x: 14, y: 13, targetMap: 'pewter-house', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'pewter-boy', x: 6, y: 5, spriteId: 'boy', facing: 'right',
      movement: 'stationary',
      dialogue: ['BROCK is the GYM LEADER here.', 'He uses ROCK-type POKeMON.', 'Water and Grass moves work great against him!'],
    },
    {
      id: 'pewter-girl', x: 12, y: 11, spriteId: 'girl', facing: 'left',
      movement: 'wander',
      dialogue: ['Have you been to the MUSEUM?', 'They have real fossils there!'],
    },
    {
      id: 'pewter-scientist', x: 16, y: 5, spriteId: 'scientist', facing: 'down',
      movement: 'stationary',
      dialogue: ['The MUSEUM has a magnificent collection.', 'You should check it out!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 8, y: 9, text: 'PEWTER CITY\nA Stone Gray City' },
    { x: 6, y: 3, text: 'PEWTER CITY POKeMON GYM\nLEADER: BROCK\nThe Rock-Solid POKeMON Trainer!' },
  ],
  connections: [
    { direction: 'south', mapId: 'route-2', offset: 0 },
    { direction: 'right', mapId: 'route-3', offset: 0 },
  ],
  music: 'pewter-city',
};
