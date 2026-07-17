// === Professor Oak's Laboratory ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, setTile, T, C } from './map-helpers.ts';

const w = 5, h = 5;
const tiles = makeGrid(w, h, T.FLOOR);
const collisions = makeGrid(w, h, C.WALKABLE);

// Top row: shelves/books
fillRow(tiles, 0, 0, w, T.SHELF);
fillRow(collisions, 0, 0, w, C.SOLID);

// Oak's desk area (row 1, left side)
setTile(tiles, 0, 1, T.SHELF);
setTile(collisions, 0, 1, C.SOLID);
setTile(tiles, 1, 1, T.SHELF);
setTile(collisions, 1, 1, C.SOLID);

// Starter Pokemon table (row 2, center) — 3 pokeballs
setTile(tiles, 1, 2, T.COUNTER);
setTile(collisions, 1, 2, C.SOLID);
setTile(tiles, 2, 2, T.COUNTER);
setTile(collisions, 2, 2, C.SOLID);
setTile(tiles, 3, 2, T.COUNTER);
setTile(collisions, 3, 2, C.SOLID);

// PC terminal
setTile(tiles, 4, 1, T.PC_TERMINAL);
setTile(collisions, 4, 1, C.SOLID);

// Door at bottom center
setTile(tiles, 2, 4, T.DOOR);
setTile(collisions, 2, 4, C.WARP);

export const oakLab: GameMap = {
  id: 'oak-lab',
  name: 'OAK\'S LAB',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 2, y: 4, targetMap: 'pallet-town', targetX: 5, targetY: 7 },
  ],
  npcs: [
    {
      id: 'prof-oak', x: 2, y: 1, spriteId: 'oak', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'OAK: Hello there! Welcome to the world of POKeMON!',
        'My name is OAK!',
        'People call me the POKeMON PROF!',
      ],
    },
    {
      id: 'rival-lab', x: 3, y: 3, spriteId: 'rival', facing: 'up',
      movement: 'stationary',
      dialogue: ['RIVAL: Heh, I don\'t need to be greedy like you!', 'Go ahead and choose first!'],
      condition: 'before-starter',
    },
    {
      id: 'oak-aide-1', x: 0, y: 3, spriteId: 'scientist', facing: 'right',
      movement: 'stationary',
      dialogue: ['Prof. OAK is the authority on POKeMON!', 'Many trainers hold him in high regard.'],
    },
    {
      id: 'oak-aide-2', x: 4, y: 3, spriteId: 'scientist', facing: 'left',
      movement: 'stationary',
      dialogue: ['There are 3 POKeMON here.', 'Haha! The PROF\'s pokeballs are on the table.'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [
    // Starter pokeballs (special event items)
    { x: 1, y: 2, itemId: 0, quantity: 1, flag: 'starter-bulbasaur' },
    { x: 2, y: 2, itemId: 0, quantity: 1, flag: 'starter-charmander' },
    { x: 3, y: 2, itemId: 0, quantity: 1, flag: 'starter-squirtle' },
  ],
  signs: [],
  connections: [],
  music: 'oak-lab',
};
