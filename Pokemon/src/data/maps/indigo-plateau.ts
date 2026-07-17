// === Indigo Plateau — Pokemon League / Elite Four ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, placeBuilding, T, C } from './map-helpers.ts';

// === Indigo Plateau exterior ===
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

// Grand entrance path
fillRect(tiles, 6, 2, 4, 11, T.PATH);
fillRect(collisions, 6, 2, 4, 11, C.WALKABLE);

// Pokemon League building (large)
placeBuilding(tiles, collisions, 4, 1, 8, 4, T.ROOF_RED);

// Pokemon Center
placeBuilding(tiles, collisions, 2, 8, 3, 2, T.ROOF_RED);

// Poke Mart
placeBuilding(tiles, collisions, 11, 8, 3, 2, T.ROOF_BLUE);

// Flowers
setTile(tiles, 3, 6, T.FLOWERS);
setTile(tiles, 12, 6, T.FLOWERS);

// South exit to Route 23
setTile(tiles, 7, h - 1, T.PATH);
setTile(collisions, 7, h - 1, C.WALKABLE);
setTile(tiles, 8, h - 1, T.PATH);
setTile(collisions, 8, h - 1, C.WALKABLE);

export const indigoPlateauExterior: GameMap = {
  id: 'indigo-plateau',
  name: 'INDIGO PLATEAU',
  width: w, height: h,
  tiles, collisions,
  warps: [
    { x: 8, y: 4, targetMap: 'elite-four-lobby', targetX: 4, targetY: 7 },
    { x: 3, y: 9, targetMap: 'indigo-pokecenter', targetX: 2, targetY: 3 },
    { x: 12, y: 9, targetMap: 'indigo-mart', targetX: 2, targetY: 3 },
  ],
  npcs: [
    {
      id: 'indigo-guard', x: 7, y: 5, spriteId: 'officer', facing: 'down',
      movement: 'stationary',
      dialogue: ['This is the POKeMON LEAGUE!', 'Only trainers with all 8 badges may enter!'],
    },
  ],
  wildEncounters: [],
  trainerPlacements: [],
  itemBalls: [],
  signs: [
    { x: 5, y: 7, text: 'INDIGO PLATEAU\nPOKeMON LEAGUE Headquarters' },
  ],
  connections: [
    { direction: 'south', mapId: 'route-23', offset: 0 },
  ],
  music: 'indigo-plateau',
};

// === Elite Four rooms + Champion ===

function makeEliteRoom(
  id: string, name: string, leaderName: string, spriteId: string,
  dialogue: string[], exitMap: string, exitX: number, exitY: number,
  nextMap: string, nextX: number, nextY: number,
  trainerPlacements: GameMap['trainerPlacements'],
): GameMap {
  const rw = 7, rh = 8;
  const t = makeGrid(rw, rh, T.FLOOR);
  const c = makeGrid(rw, rh, C.WALKABLE);

  fillRow(t, 0, 0, rw, T.BUILDING_WALL);
  fillRow(c, 0, 0, rw, C.SOLID);
  fillRect(t, 0, 0, 1, rh, T.BUILDING_WALL);
  fillRect(c, 0, 0, 1, rh, C.SOLID);
  fillRect(t, rw - 1, 0, 1, rh, T.BUILDING_WALL);
  fillRect(c, rw - 1, 0, 1, rh, C.SOLID);

  // Entrance door
  setTile(t, 3, rh - 1, T.DOOR);
  setTile(c, 3, rh - 1, C.WARP);
  // Exit door (to next room, after defeating leader)
  setTile(t, 3, 0, T.DOOR);
  setTile(c, 3, 0, C.WARP);

  // Carpet path
  fillRect(t, 3, 1, 1, rh - 1, T.CARPET);

  return {
    id, name,
    width: rw, height: rh,
    tiles: t, collisions: c,
    warps: [
      { x: 3, y: rh - 1, targetMap: exitMap, targetX: exitX, targetY: exitY },
      { x: 3, y: 0, targetMap: nextMap, targetX: nextX, targetY: nextY },
    ],
    npcs: [
      {
        id: `${id}-leader`, x: 3, y: 1, spriteId, facing: 'down',
        movement: 'stationary', dialogue,
      },
    ],
    wildEncounters: [], trainerPlacements, itemBalls: [],
    signs: [], connections: [],
    music: 'elite-four',
  };
}

// Elite Four Lobby
const lobbyW = 9, lobbyH = 8;
const lobbyT = makeGrid(lobbyW, lobbyH, T.FLOOR);
const lobbyC = makeGrid(lobbyW, lobbyH, C.WALKABLE);
fillRow(lobbyT, 0, 0, lobbyW, T.BUILDING_WALL);
fillRow(lobbyC, 0, 0, lobbyW, C.SOLID);
fillRect(lobbyT, 0, 0, 1, lobbyH, T.BUILDING_WALL);
fillRect(lobbyC, 0, 0, 1, lobbyH, C.SOLID);
fillRect(lobbyT, lobbyW - 1, 0, 1, lobbyH, T.BUILDING_WALL);
fillRect(lobbyC, lobbyW - 1, 0, 1, lobbyH, C.SOLID);
fillRect(lobbyT, 3, 2, 3, 1, T.COUNTER);
fillRect(lobbyC, 3, 2, 3, 1, C.SOLID);
setTile(lobbyT, 4, lobbyH - 1, T.DOOR);
setTile(lobbyC, 4, lobbyH - 1, C.WARP);
setTile(lobbyT, 4, 0, T.DOOR);
setTile(lobbyC, 4, 0, C.WARP);
fillRect(lobbyT, 4, 3, 1, lobbyH - 3, T.CARPET);

export const eliteFourLobby: GameMap = {
  id: 'elite-four-lobby',
  name: 'POKeMON LEAGUE',
  width: lobbyW, height: lobbyH,
  tiles: lobbyT, collisions: lobbyC,
  warps: [
    { x: 4, y: lobbyH - 1, targetMap: 'indigo-plateau', targetX: 8, targetY: 4 },
    { x: 4, y: 0, targetMap: 'elite-four-lorelei', targetX: 3, targetY: 7 },
  ],
  npcs: [
    {
      id: 'league-guard', x: 4, y: 2, spriteId: 'officer', facing: 'down',
      movement: 'stationary',
      dialogue: ['The ELITE FOUR awaits beyond this door.', 'Once you enter, there is no turning back!'],
    },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [],
  music: 'indigo-plateau',
};

export const eliteFourLorelei = makeEliteRoom(
  'elite-four-lorelei', 'LORELEI\'S ROOM', 'LORELEI', 'lorelei',
  [
    'LORELEI: Welcome to the POKeMON LEAGUE!',
    'I am LORELEI of the ELITE FOUR!',
    'No one can best my icy POKeMON! Prepare for battle!',
  ],
  'elite-four-lobby', 4, 1,
  'elite-four-bruno', 3, 7,
  [],
);

export const eliteFourBruno = makeEliteRoom(
  'elite-four-bruno', 'BRUNO\'S ROOM', 'BRUNO', 'bruno',
  [
    'BRUNO: I am BRUNO of the ELITE FOUR!',
    'Through rigorous training, people and POKeMON can become stronger!',
    'I\'ve weight-trained with my FIGHTING POKeMON!',
    'We will grind you down with our superior power!',
  ],
  'elite-four-lorelei', 3, 1,
  'elite-four-agatha', 3, 7,
  [],
);

export const eliteFourAgatha = makeEliteRoom(
  'elite-four-agatha', 'AGATHA\'S ROOM', 'AGATHA', 'agatha',
  [
    'AGATHA: I am AGATHA of the ELITE FOUR!',
    'OAK and I were once rivals. He chose to study POKeMON.',
    'Bah! He\'s a Pokemon fool! But you... You\'re a trainer, right?',
    'I\'ll show you how a real trainer battles!',
  ],
  'elite-four-bruno', 3, 1,
  'elite-four-lance', 3, 7,
  [],
);

export const eliteFourLance = makeEliteRoom(
  'elite-four-lance', 'LANCE\'S ROOM', 'LANCE', 'lance',
  [
    'LANCE: I am LANCE, the Dragon Master!',
    'I\'ve been waiting for you! I knew you could make it this far!',
    'You are indeed a worthy opponent!',
    'Let me test you with my Dragon-type POKeMON!',
  ],
  'elite-four-agatha', 3, 1,
  'champion-room', 3, 7,
  [],
);

// Champion Room
export const championRoom = makeEliteRoom(
  'champion-room', 'CHAMPION\'S ROOM', 'CHAMPION', 'rival',
  [
    'RIVAL: Hey! I was looking forward to seeing you here!',
    'My rival should be strong to keep me otherwise sharp!',
    'While working on my POKeDEX, I looked all over for powerful POKeMON!',
    'Not only that, I assembled teams that would beat any type!',
    'And now... I am the POKeMON LEAGUE CHAMPION!',
    'Do you know what that means? I\'ll tell you!',
    'I am the most powerful trainer in the world!',
  ],
  'elite-four-lance', 3, 1,
  'hall-of-fame', 3, 7,
  [],
);

// Hall of Fame
const hofW = 7, hofH = 6;
const hofT = makeGrid(hofW, hofH, T.FLOOR);
const hofC = makeGrid(hofW, hofH, C.WALKABLE);
fillRow(hofT, 0, 0, hofW, T.BUILDING_WALL);
fillRow(hofC, 0, 0, hofW, C.SOLID);
fillRect(hofT, 0, 0, 1, hofH, T.BUILDING_WALL);
fillRect(hofC, 0, 0, 1, hofH, C.SOLID);
fillRect(hofT, hofW - 1, 0, 1, hofH, T.BUILDING_WALL);
fillRect(hofC, hofW - 1, 0, 1, hofH, C.SOLID);
fillRect(hofT, 3, 1, 1, 5, T.CARPET);
// PC terminal for recording
setTile(hofT, 3, 1, T.PC_TERMINAL);
setTile(hofC, 3, 1, C.SOLID);
setTile(hofT, 3, hofH - 1, T.DOOR);
setTile(hofC, 3, hofH - 1, C.WARP);

export const hallOfFame: GameMap = {
  id: 'hall-of-fame',
  name: 'HALL OF FAME',
  width: hofW, height: hofH,
  tiles: hofT, collisions: hofC,
  warps: [
    { x: 3, y: hofH - 1, targetMap: 'champion-room', targetX: 3, targetY: 1 },
  ],
  npcs: [
    {
      id: 'oak-hof', x: 3, y: 2, spriteId: 'oak', facing: 'down',
      movement: 'stationary',
      dialogue: [
        'OAK: Congratulations! You\'ve beaten the ELITE FOUR!',
        'Your POKeMON are the best in the world!',
        'Come, let me record your team in the HALL OF FAME!',
      ],
    },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [],
  signs: [], connections: [],
  music: 'hall-of-fame',
};

// Indigo Plateau interiors
import { makePokemonCenter, makePokeMart } from './map-helpers.ts';

export const indigoPokecenter: GameMap = makePokemonCenter(
  'indigo-pokecenter', 'indigo-plateau', 3, 10,
);

export const indigoMart: GameMap = makePokeMart(
  'indigo-mart', 'indigo-plateau', 12, 10,
);
