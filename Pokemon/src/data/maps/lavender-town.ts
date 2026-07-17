// === Lavender Town — Pokemon Tower ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

const w = 16, h = 14;
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
fillRect(tiles, 7, 1, 2, 12, T.PATH);
fillRect(collisions, 7, 1, 2, 12, C.WALKABLE);
fillRect(tiles, 1, 7, 14, 2, T.PATH);
fillRect(collisions, 1, 7, 14, 2, C.WALKABLE);

// Pokemon Tower — large building, north-east
placeBuilding(tiles, collisions, 10, 1, 5, 4, T.ROOF_RED);

// Pokemon Center
placeBuilding(tiles, collisions, 2, 3, 4, 3, T.ROOF_RED);

// Mr. Fuji's house
placeBuilding(tiles, collisions, 2, 10, 3, 2, T.ROOF_BLUE);

// Volunteer House
placeBuilding(tiles, collisions, 11, 10, 3, 2, T.ROOF_GREEN);

// Flowers (graveyard theme)
setTile(tiles, 9, 3, T.FLOWERS);
setTile(tiles, 6, 5, T.FLOWERS);
setTile(tiles, 10, 9, T.FLOWERS);

// Exits
setTile(tiles, 0, 7, T.PATH); setTile(collisions, 0, 7, C.WALKABLE);
setTile(tiles, 0, 8, T.PATH); setTile(collisions, 0, 8, C.WALKABLE);
setTile(tiles, 7, 0, T.PATH); setTile(collisions, 7, 0, C.WALKABLE);
setTile(tiles, 8, 0, T.PATH); setTile(collisions, 8, 0, C.WALKABLE);
setTile(tiles, 7, h - 1, T.PATH); setTile(collisions, 7, h - 1, C.WALKABLE);
setTile(tiles, 8, h - 1, T.PATH); setTile(collisions, 8, h - 1, C.WALKABLE);

export const lavenderTown: GameMap = {
  id: 'lavender-town',
  name: 'LAVENDER TOWN',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 12, y: 4, targetMap: 'pokemon-tower-1f', targetX: 5, targetY: 9 },
    { x: 4, y: 5, targetMap: 'lavender-pokecenter', targetX: 2, targetY: 3 },
    { x: 3, y: 11, targetMap: 'lavender-fuji-house', targetX: 3, targetY: 2 },
    { x: 12, y: 11, targetMap: 'lavender-volunteer-house', targetX: 3, targetY: 2 },
  ],
  npcs: [
    {
      id: 'lavender-girl', x: 5, y: 7, spriteId: 'girl', facing: 'right',
      movement: 'stationary',
      dialogue: ['Can you hear the eerie sound?', 'They say the ghost of a POKeMON haunts that tower...'],
    },
    {
      id: 'lavender-old-man', x: 10, y: 8, spriteId: 'old-man', facing: 'up',
      movement: 'stationary',
      dialogue: ['Mr. FUJI has been gone for so long...', 'He went to the POKeMON TOWER to pray.'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 6, y: 7, text: 'LAVENDER TOWN\nThe Noble Purple Town' },
    { x: 9, y: 2, text: 'POKeMON TOWER\nA final resting place for POKeMON.' },
  ],
  connections: [
    { direction: 'left', mapId: 'route-8', offset: 0 },
    { direction: 'north', mapId: 'route-10', offset: 0 },
    { direction: 'south', mapId: 'route-12', offset: 0 },
  ],
  music: 'lavender-town',
};
