// === Viridian City ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 20, h = 18;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree borders
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// Main north-south path
fillRect(tiles, 9, 0, 2, h, T.PATH);
fillRect(collisions, 9, 0, 2, h, C.WALKABLE);

// East-west paths connecting buildings
fillRect(tiles, 1, 8, 18, 2, T.PATH);
fillRect(collisions, 1, 8, 18, 2, C.WALKABLE);

// Path to gym (west side)
fillRect(tiles, 1, 4, 4, 2, T.PATH);
fillRect(collisions, 1, 4, 4, 2, C.WALKABLE);

// Pokemon Center (red roof) — east side
placeBuilding(tiles, collisions, 12, 2, 4, 3, T.ROOF_RED);

// Poke Mart (blue roof) — east side, below center
placeBuilding(tiles, collisions, 12, 6, 4, 2, T.ROOF_BLUE);

// Viridian Gym (green roof) — west side
placeBuilding(tiles, collisions, 2, 2, 4, 3, T.ROOF_GREEN);

// House north-west
placeBuilding(tiles, collisions, 2, 11, 3, 2, T.ROOF_RED);

// House south-east
placeBuilding(tiles, collisions, 14, 11, 3, 2, T.ROOF_BLUE);

// Trees and flowers
fillRect(tiles, 5, 11, 3, 2, T.TREE);
fillRect(collisions, 5, 11, 3, 2, C.SOLID);
setTile(tiles, 8, 3, T.FLOWERS);
setTile(tiles, 11, 14, T.FLOWERS);
setTile(tiles, 8, 14, T.FLOWERS);

// Fence along south
fillRow(tiles, 1, 17, 8, T.FENCE);
fillRow(collisions, 1, 17, 8, C.SOLID);
fillRow(tiles, 11, 17, 8, T.FENCE);
fillRow(collisions, 11, 17, 8, C.SOLID);

// Signs
setTile(tiles, 8, 8, T.SIGN_TILE);
setTile(tiles, 6, 3, T.SIGN_TILE);

// Tall grass (small patches)
fillRect(tiles, 16, 13, 3, 3, T.TALL_GRASS);
fillRect(collisions, 16, 13, 3, 3, C.TALL_GRASS);

// West exit to Route 22
// (opening in left tree border at row 8-9)
setTile(tiles, 0, 8, T.PATH);
setTile(collisions, 0, 8, C.WALKABLE);
setTile(tiles, 0, 9, T.PATH);
setTile(collisions, 0, 9, C.WALKABLE);

export const viridianCity: GameMap = {
  id: 'viridian-city',
  name: 'VIRIDIAN CITY',
  width: w, height: h,
  tiles, collisions,
  warps: [
    // Pokemon Center
    { x: 14, y: 4, targetMap: 'viridian-pokecenter', targetX: 2, targetY: 3 },
    // Poke Mart
    { x: 14, y: 7, targetMap: 'viridian-mart', targetX: 2, targetY: 3 },
    // Gym
    { x: 4, y: 4, targetMap: 'gym-viridian', targetX: 2, targetY: 7 },
    // House 1
    { x: 3, y: 12, targetMap: 'viridian-house-1', targetX: 3, targetY: 2 },
    // House 2
    { x: 15, y: 12, targetMap: 'viridian-house-2', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'viridian-old-man', x: 8, y: 3, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: ['I\'ve had my coffee now and I feel great!', 'Sure, I\'ll show you how to catch POKeMON!'],
      condition: 'oaks-parcel-delivered',
    },
    {
      id: 'viridian-old-man-blocking', x: 9, y: 2, spriteId: 'old-man', facing: 'down',
      movement: 'stationary',
      dialogue: ['You can\'t go through here!', 'This is private property!'],
      condition: 'before-oaks-parcel',
    },
    {
      id: 'viridian-girl', x: 6, y: 9, spriteId: 'girl', facing: 'right',
      movement: 'wander',
      dialogue: ['VIRIDIAN CITY is a beautiful place.', 'It\'s close to the Pokemon League, too!'],
    },
    {
      id: 'viridian-boy', x: 12, y: 10, spriteId: 'boy', facing: 'up',
      movement: 'stationary',
      dialogue: ['The GYM LEADER is incredibly strong.', 'I wonder who it is...'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 8, y: 8, text: 'VIRIDIAN CITY\nThe Eternally Green Paradise' },
    { x: 6, y: 3, text: 'VIRIDIAN CITY POKeMON GYM\nLEADER: ???' },
  ],
  connections: [
    { direction: 'south', mapId: 'route-1', offset: 0 },
    { direction: 'north', mapId: 'route-2', offset: 0 },
    { direction: 'left', mapId: 'route-22', offset: 0 },
  ],
  music: 'viridian-city',
};
