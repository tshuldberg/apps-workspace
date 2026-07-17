// === Pallet Town — Where it all begins ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, setTile, fillRow, fillCol, placeBuilding, placeTreeBorder, T, C } from './map-helpers.ts';

const w = 10, h = 10;
const tiles = makeGrid(w, h, T.GRASS);
const collisions = makeGrid(w, h, C.WALKABLE);

// Tree border (top, left, right edges — south is open for Route 21 water)
fillRow(tiles, 0, 0, w, T.TREE);
fillRow(collisions, 0, 0, w, C.SOLID);
fillCol(tiles, 0, 0, h, T.TREE);
fillCol(collisions, 0, 0, h, C.SOLID);
fillCol(tiles, w - 1, 0, h, T.TREE);
fillCol(collisions, w - 1, 0, h, C.SOLID);

// Path running north-south through center (starts at y=0 to open gap in tree border)
fillRect(tiles, 4, 0, 2, 9, T.PATH);
fillRect(collisions, 4, 0, 2, 9, C.WALKABLE);

// Path connecting houses to main road
fillRow(tiles, 2, 4, 3, T.PATH);
fillRow(collisions, 2, 4, 3, C.WALKABLE);
fillRow(tiles, 5, 4, 3, T.PATH);
fillRow(collisions, 5, 4, 3, C.WALKABLE);

// Path in front of Oak's Lab (approach from below the building)
fillRow(tiles, 3, 8, 4, T.PATH);
fillRow(collisions, 3, 8, 4, C.WALKABLE);

// Player's house (top-left area) — red roof, 3x2
placeBuilding(tiles, collisions, 2, 2, 3, 2, T.ROOF_RED);

// Rival's house (top-right area) — blue roof, 3x2
placeBuilding(tiles, collisions, 6, 2, 3, 2, T.ROOF_BLUE);

// Oak's Lab (bottom-center) — green roof, 4x2
placeBuilding(tiles, collisions, 3, 6, 4, 2, T.ROOF_GREEN);

// Flowers
setTile(tiles, 1, 5, T.FLOWERS);
setTile(tiles, 8, 5, T.FLOWERS);

// Sign tile for town
setTile(tiles, 3, 4, T.SIGN_TILE);

// South row — water edge leading to Route 21 (moved to y=9)
fillRow(tiles, 1, 9, w - 2, T.WATER_EDGE);
fillRow(collisions, 1, 9, w - 2, C.WATER);

export const palletTown: GameMap = {
  id: 'pallet-town',
  name: 'PALLET TOWN',
  width: w, height: h,
  tiles, collisions,
  warps: [
    // Player's house door
    { x: 3, y: 3, targetMap: 'pallet-player-house', targetX: 3, targetY: 2 },
    // Rival's house door
    { x: 7, y: 3, targetMap: 'pallet-rival-house', targetX: 3, targetY: 2 },
    // Oak's Lab door
    { x: 5, y: 7, targetMap: 'oak-lab', targetX: 2, targetY: 4 },
  ],
  npcs: [
    {
      id: 'pallet-girl', x: 2, y: 5, spriteId: 'girl', facing: 'right',
      movement: 'wander',
      dialogue: ['I\'m raising POKeMON too!', 'When they get strong, they can protect me!'],
    },
    {
      id: 'pallet-boy', x: 8, y: 4, spriteId: 'boy', facing: 'left',
      movement: 'stationary',
      dialogue: ['Technology is incredible!', 'You can now store and recall items and POKeMON via PC!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 3, y: 4, text: 'PALLET TOWN\nShades of your journey await!' },
    { x: 4, y: 1, text: 'ROUTE 1\nViridian City ahead' },
  ],
  connections: [
    { direction: 'north', mapId: 'route-1', offset: 0 },
  ],
  music: 'pallet-town',
};
