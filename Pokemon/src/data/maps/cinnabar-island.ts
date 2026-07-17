// === Cinnabar Island — Home of Blaine ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 16, h = 14;
const tiles = makeGrid(w, h, T.SAND);
const collisions = makeGrid(w, h, C.WALKABLE);

// Water surrounds the island
fillRow(tiles, 0, 0, w, T.WATER);
fillRow(collisions, 0, 0, w, C.WATER);
fillRow(tiles, 0, h - 1, w, T.WATER);
fillRow(collisions, 0, h - 1, w, C.WATER);
fillCol(tiles, 0, 0, h, T.WATER);
fillCol(collisions, 0, 0, h, C.WATER);
fillCol(tiles, w - 1, 0, h, T.WATER);
fillCol(collisions, w - 1, 0, h, C.WATER);

// Second water border for wider ocean feel
fillRow(tiles, 0, 1, w, T.WATER_EDGE);
fillRow(collisions, 0, 1, w, C.WATER);
fillCol(tiles, 1, 1, h - 2, T.WATER_EDGE);
fillCol(collisions, 1, 1, h - 2, C.WATER);

// Sandy island interior
fillRect(tiles, 2, 2, w - 4, h - 4, T.SAND);
fillRect(collisions, 2, 2, w - 4, h - 4, C.WALKABLE);

// Paths
fillRect(tiles, 7, 2, 2, 10, T.PATH);
fillRect(collisions, 7, 2, 2, 10, C.WALKABLE);
fillRect(tiles, 2, 7, 12, 2, T.PATH);
fillRect(collisions, 2, 7, 12, 2, C.WALKABLE);

// Cinnabar Gym
placeBuilding(tiles, collisions, 3, 3, 4, 3, T.ROOF_RED);

// Pokemon Center
placeBuilding(tiles, collisions, 10, 3, 3, 2, T.ROOF_RED);

// Pokemon Lab
placeBuilding(tiles, collisions, 3, 9, 4, 2, T.ROOF_BLUE);

// Poke Mart
placeBuilding(tiles, collisions, 10, 9, 3, 2, T.ROOF_BLUE);

// Pokemon Mansion entrance (north)
setTile(tiles, 7, 2, T.DOOR);
setTile(collisions, 7, 2, C.WARP);

// Water exits
// North → Route 21
setTile(tiles, 7, 0, T.WATER); setTile(collisions, 7, 0, C.WATER);
setTile(tiles, 8, 0, T.WATER); setTile(collisions, 8, 0, C.WATER);
// East → Route 20
setTile(tiles, w - 1, 7, T.WATER); setTile(collisions, w - 1, 7, C.WATER);
setTile(tiles, w - 1, 8, T.WATER); setTile(collisions, w - 1, 8, C.WATER);

export const cinnabarIsland: GameMap = {
  id: 'cinnabar-island',
  name: 'CINNABAR ISLAND',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 5, y: 5, targetMap: 'gym-cinnabar', targetX: 3, targetY: 7 },
    { x: 11, y: 4, targetMap: 'cinnabar-pokecenter', targetX: 2, targetY: 3 },
    { x: 5, y: 10, targetMap: 'cinnabar-lab', targetX: 3, targetY: 5 },
    { x: 11, y: 10, targetMap: 'cinnabar-mart', targetX: 2, targetY: 3 },
    { x: 7, y: 2, targetMap: 'pokemon-mansion-1f', targetX: 8, targetY: 14 },
  ],
  npcs: [
    {
      id: 'cinnabar-scientist', x: 8, y: 6, spriteId: 'scientist', facing: 'left',
      movement: 'stationary',
      dialogue: ['The POKEMON MANSION is in ruins now.', 'They say something terrible happened there...'],
    },
    {
      id: 'cinnabar-girl', x: 5, y: 8, spriteId: 'girl', facing: 'right',
      movement: 'wander',
      dialogue: ['CINNABAR ISLAND is volcanic!', 'BLAINE\'s FIRE-type POKeMON love the heat!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 6, y: 7, text: 'CINNABAR ISLAND\nThe Fiery Town of Burning Desire' },
    { x: 2, y: 4, text: 'CINNABAR ISLAND POKeMON GYM\nLEADER: BLAINE\nThe Hotheaded Quiz Master!' },
  ],
  connections: [
    { direction: 'north', mapId: 'route-21', offset: 0 },
    { direction: 'right', mapId: 'route-20', offset: 0 },
  ],
  music: 'cinnabar-island',
};
