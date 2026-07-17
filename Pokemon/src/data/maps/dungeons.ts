// === Dungeon maps: Pokemon Tower, Rock Tunnel, Rocket Hideout, etc. ===

import type { GameMap } from '../game-types.ts';
import { makeGrid, fillRect, fillRow, fillCol, setTile, T, C } from './map-helpers.ts';

// ========== Pokemon Tower (7 floors, simplified as 3 key floors) ==========

function makePokemonTowerFloor(
  floor: number, id: string, name: string,
  exitDown: { map: string; x: number; y: number },
  exitUp: { map: string; x: number; y: number } | null,
): GameMap {
  const w = 10, h = 10;
  const tiles = makeGrid(w, h, T.FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.BUILDING_WALL); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.BUILDING_WALL); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 0, 1, h, T.BUILDING_WALL); fillRect(collisions, 0, 0, 1, h, C.SOLID);
  fillRect(tiles, w - 1, 0, 1, h, T.BUILDING_WALL); fillRect(collisions, w - 1, 0, 1, h, C.SOLID);
  // Interior walls vary per floor
  fillRect(tiles, 4, 3, 2, 3, T.COUNTER); fillRect(collisions, 4, 3, 2, 3, C.SOLID);
  // Stairs down
  setTile(tiles, 1, 1, T.STAIRS_DOWN); setTile(collisions, 1, 1, C.WARP);
  const warps = [{ x: 1, y: 1, targetMap: exitDown.map, targetX: exitDown.x, targetY: exitDown.y }];
  // Stairs up (if not top floor)
  if (exitUp) {
    setTile(tiles, 8, 1, T.STAIRS_UP); setTile(collisions, 8, 1, C.WARP);
    warps.push({ x: 8, y: 1, targetMap: exitUp.map, targetX: exitUp.x, targetY: exitUp.y });
  }
  return {
    id, name, width: w, height: h, tiles, collisions, warps,
    npcs: [], wildEncounters: [
      { speciesId: 92, levelMin: 20 + floor, levelMax: 24 + floor, rate: 100 },   // Gastly
      { speciesId: 93, levelMin: 22 + floor, levelMax: 26 + floor, rate: 50 },    // Haunter
      { speciesId: 104, levelMin: 20 + floor, levelMax: 24 + floor, rate: 60 },   // Cubone
    ],
    trainerPlacements: [], itemBalls: [], signs: [], connections: [],
    music: 'pokemon-tower',
  };
}

// 1F (lobby — no encounters)
const pt1fW = 10, pt1fH = 10;
const pt1fT = makeGrid(pt1fW, pt1fH, T.FLOOR);
const pt1fC = makeGrid(pt1fW, pt1fH, C.WALKABLE);
fillRow(pt1fT, 0, 0, pt1fW, T.BUILDING_WALL); fillRow(pt1fC, 0, 0, pt1fW, C.SOLID);
fillRow(pt1fT, 0, pt1fH - 1, pt1fW, T.BUILDING_WALL); fillRow(pt1fC, 0, pt1fH - 1, pt1fW, C.SOLID);
fillRect(pt1fT, 0, 0, 1, pt1fH, T.BUILDING_WALL); fillRect(pt1fC, 0, 0, 1, pt1fH, C.SOLID);
fillRect(pt1fT, pt1fW - 1, 0, 1, pt1fH, T.BUILDING_WALL); fillRect(pt1fC, pt1fW - 1, 0, 1, pt1fH, C.SOLID);
setTile(pt1fT, 5, pt1fH - 1, T.DOOR); setTile(pt1fC, 5, pt1fH - 1, C.WARP);
setTile(pt1fT, 8, 1, T.STAIRS_UP); setTile(pt1fC, 8, 1, C.WARP);

export const pokemonTower1F: GameMap = {
  id: 'pokemon-tower-1f', name: 'POKeMON TOWER 1F',
  width: pt1fW, height: pt1fH, tiles: pt1fT, collisions: pt1fC,
  warps: [
    { x: 5, y: pt1fH - 1, targetMap: 'lavender-town', targetX: 12, targetY: 5 },
    { x: 8, y: 1, targetMap: 'pokemon-tower-3f', targetX: 1, targetY: 1 },
  ],
  npcs: [
    { id: 'pt-old-man', x: 3, y: 5, spriteId: 'old-man', facing: 'right', movement: 'stationary',
      dialogue: ['POKeMON are laid to rest here.', 'Please be respectful.'] },
  ],
  wildEncounters: [], trainerPlacements: [], itemBalls: [], signs: [], connections: [],
  music: 'pokemon-tower',
};

export const pokemonTower3F = makePokemonTowerFloor(3,
  'pokemon-tower-3f', 'POKeMON TOWER 3F',
  { map: 'pokemon-tower-1f', x: 8, y: 1 },
  { map: 'pokemon-tower-5f', x: 1, y: 1 },
);
// Add channeler trainers
pokemonTower3F.trainerPlacements = [
  { trainerId: 'channeler-2', x: 3, y: 5, facing: 'right', sightRange: 3, flag: 'pt-3f-channeler-1' },
  { trainerId: 'channeler-3', x: 7, y: 7, facing: 'left', sightRange: 3, flag: 'pt-3f-channeler-2' },
];

export const pokemonTower5F = makePokemonTowerFloor(5,
  'pokemon-tower-5f', 'POKeMON TOWER 5F',
  { map: 'pokemon-tower-3f', x: 8, y: 1 },
  { map: 'pokemon-tower-7f', x: 1, y: 1 },
);
pokemonTower5F.trainerPlacements = [
  { trainerId: 'channeler-4', x: 2, y: 4, facing: 'down', sightRange: 3, flag: 'pt-5f-channeler' },
  { trainerId: 'rocket-grunt-9', x: 7, y: 5, facing: 'left', sightRange: 3, flag: 'pt-5f-rocket' },
];
// Ghost blocks stairs (event-driven)
pokemonTower5F.npcs = [
  { id: 'ghost-marowak', x: 8, y: 2, spriteId: 'ghost', facing: 'down', movement: 'stationary',
    dialogue: ['The GHOST won\'t let you pass!', 'It\'s the restless spirit of a MAROWAK!'],
    condition: 'before-silph-scope' },
];

// 7F — Mr. Fuji at top
export const pokemonTower7F = makePokemonTowerFloor(7,
  'pokemon-tower-7f', 'POKeMON TOWER 7F',
  { map: 'pokemon-tower-5f', x: 8, y: 1 },
  null,
);
pokemonTower7F.trainerPlacements = [
  { trainerId: 'rocket-grunt-10', x: 3, y: 3, facing: 'right', sightRange: 3, flag: 'pt-7f-rocket-1' },
  { trainerId: 'rocket-grunt-11', x: 7, y: 5, facing: 'left', sightRange: 3, flag: 'pt-7f-rocket-2' },
];
pokemonTower7F.npcs = [
  { id: 'mr-fuji', x: 5, y: 2, spriteId: 'old-man', facing: 'down', movement: 'stationary',
    dialogue: [
      'MR. FUJI: Thank you for rescuing me!',
      'TEAM ROCKET is terrible, using POKeMON for their evil deeds!',
      'Here, take this POKE FLUTE! It can wake sleeping POKeMON.',
    ] },
];

// ========== Rock Tunnel (2 floors) ==========

function makeRockTunnelFloor(id: string, name: string, warps: GameMap['warps']): GameMap {
  const w = 15, h = 15;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.CAVE_WALL); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL); fillCol(collisions, w - 1, 0, h, C.SOLID);
  // Interior walls
  fillRect(tiles, 5, 3, 3, 4, T.CAVE_WALL); fillRect(collisions, 5, 3, 3, 4, C.SOLID);
  fillRect(tiles, 10, 5, 3, 3, T.CAVE_WALL); fillRect(collisions, 10, 5, 3, 3, C.SOLID);
  fillRect(tiles, 2, 9, 4, 3, T.CAVE_WALL); fillRect(collisions, 2, 9, 4, 3, C.SOLID);
  fillRect(tiles, 8, 10, 3, 2, T.CAVE_WALL); fillRect(collisions, 8, 10, 3, 2, C.SOLID);
  // Set warp tiles
  for (const warp of warps) {
    setTile(tiles, warp.x, warp.y, warp.y <= 2 ? T.STAIRS_UP : T.STAIRS_DOWN);
    setTile(collisions, warp.x, warp.y, C.WARP);
  }
  return {
    id, name, width: w, height: h, tiles, collisions, warps,
    npcs: [],
    wildEncounters: [
      { speciesId: 41, levelMin: 15, levelMax: 22, rate: 100 },   // Zubat
      { speciesId: 74, levelMin: 15, levelMax: 19, rate: 70 },    // Geodude
      { speciesId: 66, levelMin: 15, levelMax: 20, rate: 50 },    // Machop
      { speciesId: 95, levelMin: 13, levelMax: 17, rate: 30 },    // Onix
    ],
    trainerPlacements: [],
    itemBalls: [],
    signs: [], connections: [],
    music: 'rock-tunnel',
  };
}

export const rockTunnel1F = makeRockTunnelFloor('rock-tunnel-1f', 'ROCK TUNNEL 1F', [
  { x: 1, y: 1, targetMap: 'route-10', targetX: 5, targetY: 7 },
  { x: 13, y: 13, targetMap: 'rock-tunnel-b1f', targetX: 13, targetY: 1 },
]);
rockTunnel1F.trainerPlacements = [
  { trainerId: 'hiker-7', x: 3, y: 3, facing: 'right', sightRange: 3, flag: 'rt-1f-hiker-1' },
  { trainerId: 'hiker-8', x: 9, y: 7, facing: 'down', sightRange: 3, flag: 'rt-1f-hiker-2' },
  { trainerId: 'pokemaniac-2', x: 7, y: 12, facing: 'up', sightRange: 3, flag: 'rt-1f-maniac' },
];

export const rockTunnelB1F = makeRockTunnelFloor('rock-tunnel-b1f', 'ROCK TUNNEL B1F', [
  { x: 13, y: 1, targetMap: 'rock-tunnel-1f', targetX: 13, targetY: 13 },
  { x: 1, y: 13, targetMap: 'route-10', targetX: 5, targetY: 7 },
]);
rockTunnelB1F.trainerPlacements = [
  { trainerId: 'hiker-9', x: 4, y: 5, facing: 'right', sightRange: 3, flag: 'rt-b1-hiker' },
  { trainerId: 'pokemaniac-3', x: 10, y: 8, facing: 'left', sightRange: 3, flag: 'rt-b1-maniac' },
  { trainerId: 'blackbelt-6', x: 7, y: 12, facing: 'up', sightRange: 3, flag: 'rt-b1-blackbelt' },
];

// ========== Rocket Hideout (4 floors, simplified to 2 key floors) ==========

function makeRocketHideoutFloor(id: string, name: string, w: number, h: number): GameMap {
  const tiles = makeGrid(w, h, T.FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.BUILDING_WALL); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.BUILDING_WALL); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillRect(tiles, 0, 0, 1, h, T.BUILDING_WALL); fillRect(collisions, 0, 0, 1, h, C.SOLID);
  fillRect(tiles, w - 1, 0, 1, h, T.BUILDING_WALL); fillRect(collisions, w - 1, 0, 1, h, C.SOLID);
  return { id, name, width: w, height: h, tiles, collisions,
    warps: [], npcs: [], wildEncounters: [], trainerPlacements: [],
    itemBalls: [], signs: [], connections: [], music: 'rocket-hideout' };
}

export const rocketHideoutB1F = makeRocketHideoutFloor('rocket-hideout-b1f', 'ROCKET HIDEOUT B1F', 15, 15);
// Interior walls
fillRect(rocketHideoutB1F.tiles, 5, 3, 5, 2, T.BUILDING_WALL);
fillRect(rocketHideoutB1F.collisions, 5, 3, 5, 2, C.SOLID);
fillRect(rocketHideoutB1F.tiles, 3, 8, 3, 4, T.BUILDING_WALL);
fillRect(rocketHideoutB1F.collisions, 3, 8, 3, 4, C.SOLID);
// Entrance from Game Corner
setTile(rocketHideoutB1F.tiles, 12, 1, T.STAIRS_UP);
setTile(rocketHideoutB1F.collisions, 12, 1, C.WARP);
// Down to B4F
setTile(rocketHideoutB1F.tiles, 1, 13, T.STAIRS_DOWN);
setTile(rocketHideoutB1F.collisions, 1, 13, C.WARP);
rocketHideoutB1F.warps = [
  { x: 12, y: 1, targetMap: 'celadon-game-corner', targetX: 8, targetY: 3 },
  { x: 1, y: 13, targetMap: 'rocket-hideout-b4f', targetX: 1, targetY: 1 },
];
rocketHideoutB1F.trainerPlacements = [
  { trainerId: 'rocket-grunt-12', x: 8, y: 5, facing: 'down', sightRange: 3, flag: 'rh-b1-rocket-1' },
  { trainerId: 'rocket-grunt-13', x: 3, y: 6, facing: 'right', sightRange: 3, flag: 'rh-b1-rocket-2' },
  { trainerId: 'rocket-grunt-14', x: 10, y: 10, facing: 'up', sightRange: 3, flag: 'rh-b1-rocket-3' },
];
rocketHideoutB1F.itemBalls = [
  { x: 13, y: 8, itemId: 29, quantity: 1, flag: 'rh-b1-escape-rope' },
  { x: 1, y: 3, itemId: 26, quantity: 1, flag: 'rh-b1-hyper-potion' },
];

export const rocketHideoutB4F = makeRocketHideoutFloor('rocket-hideout-b4f', 'ROCKET HIDEOUT B4F', 12, 12);
fillRect(rocketHideoutB4F.tiles, 4, 3, 4, 2, T.BUILDING_WALL);
fillRect(rocketHideoutB4F.collisions, 4, 3, 4, 2, C.SOLID);
setTile(rocketHideoutB4F.tiles, 1, 1, T.STAIRS_UP);
setTile(rocketHideoutB4F.collisions, 1, 1, C.WARP);
rocketHideoutB4F.warps = [
  { x: 1, y: 1, targetMap: 'rocket-hideout-b1f', targetX: 1, targetY: 13 },
];
rocketHideoutB4F.npcs = [
  { id: 'giovanni-rh', x: 6, y: 1, spriteId: 'giovanni', facing: 'down', movement: 'stationary',
    dialogue: [
      'GIOVANNI: So! You came all the way here to see me?',
      'I am the LEADER of TEAM ROCKET!',
      'POKEMON are merely tools for my purposes!',
    ] },
];
rocketHideoutB4F.trainerPlacements = [
  { trainerId: 'rocket-grunt-15', x: 5, y: 7, facing: 'up', sightRange: 3, flag: 'rh-b4-rocket-1' },
  { trainerId: 'rocket-grunt-16', x: 9, y: 5, facing: 'left', sightRange: 3, flag: 'rh-b4-rocket-2' },
];
rocketHideoutB4F.itemBalls = [
  { x: 10, y: 10, itemId: 38, quantity: 1, flag: 'rh-silph-scope' },  // Silph Scope
  { x: 1, y: 10, itemId: 22, quantity: 1, flag: 'rh-b4-tm' },
];

// ========== Diglett's Cave ==========
const dcW = 8, dcH = 30;
const dcT = makeGrid(dcW, dcH, T.CAVE_FLOOR);
const dcC = makeGrid(dcW, dcH, C.WALKABLE);
fillCol(dcT, 0, 0, dcH, T.CAVE_WALL); fillCol(dcC, 0, 0, dcH, C.SOLID);
fillCol(dcT, dcW - 1, 0, dcH, T.CAVE_WALL); fillCol(dcC, dcW - 1, 0, dcH, C.SOLID);
fillRow(dcT, 0, 0, dcW, T.CAVE_WALL); fillRow(dcC, 0, 0, dcW, C.SOLID);
fillRow(dcT, 0, dcH - 1, dcW, T.CAVE_WALL); fillRow(dcC, 0, dcH - 1, dcW, C.SOLID);
// Winding walls
fillRect(dcT, 3, 5, 3, 2, T.CAVE_WALL); fillRect(dcC, 3, 5, 3, 2, C.SOLID);
fillRect(dcT, 1, 12, 4, 2, T.CAVE_WALL); fillRect(dcC, 1, 12, 4, 2, C.SOLID);
fillRect(dcT, 4, 18, 3, 2, T.CAVE_WALL); fillRect(dcC, 4, 18, 3, 2, C.SOLID);
fillRect(dcT, 1, 24, 3, 2, T.CAVE_WALL); fillRect(dcC, 1, 24, 3, 2, C.SOLID);
setTile(dcT, 1, 1, T.STAIRS_UP); setTile(dcC, 1, 1, C.WARP);
setTile(dcT, 6, dcH - 2, T.STAIRS_UP); setTile(dcC, 6, dcH - 2, C.WARP);

export const diglettsCave: GameMap = {
  id: 'digletts-cave', name: 'DIGLETT\'S CAVE',
  width: dcW, height: dcH, tiles: dcT, collisions: dcC,
  warps: [
    { x: 1, y: 1, targetMap: 'route-11', targetX: 23, targetY: 7 },
    { x: 6, y: dcH - 2, targetMap: 'route-2', targetX: 7, targetY: 22 },
  ],
  npcs: [],
  wildEncounters: [
    { speciesId: 50, levelMin: 15, levelMax: 22, rate: 180 },  // Diglett
    { speciesId: 51, levelMin: 29, levelMax: 31, rate: 30 },   // Dugtrio
  ],
  trainerPlacements: [], itemBalls: [], signs: [], connections: [],
  music: 'digletts-cave',
};

// ========== Victory Road (3 floors, simplified to 2) ==========

function makeVictoryRoadFloor(id: string, name: string): GameMap {
  const w = 15, h = 15;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.CAVE_WALL); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL); fillCol(collisions, w - 1, 0, h, C.SOLID);
  // Interior walls
  fillRect(tiles, 5, 3, 4, 3, T.CAVE_WALL); fillRect(collisions, 5, 3, 4, 3, C.SOLID);
  fillRect(tiles, 2, 8, 3, 4, T.CAVE_WALL); fillRect(collisions, 2, 8, 3, 4, C.SOLID);
  fillRect(tiles, 10, 7, 3, 4, T.CAVE_WALL); fillRect(collisions, 10, 7, 3, 4, C.SOLID);
  // Boulders (Strength puzzles)
  setTile(tiles, 4, 7, T.BOULDER); setTile(collisions, 4, 7, C.BOULDER);
  setTile(tiles, 8, 10, T.BOULDER); setTile(collisions, 8, 10, C.BOULDER);
  setTile(tiles, 12, 3, T.BOULDER); setTile(collisions, 12, 3, C.BOULDER);
  return {
    id, name, width: w, height: h, tiles, collisions,
    warps: [], npcs: [],
    wildEncounters: [
      { speciesId: 41, levelMin: 22, levelMax: 26, rate: 50 },
      { speciesId: 74, levelMin: 24, levelMax: 28, rate: 50 },
      { speciesId: 95, levelMin: 36, levelMax: 40, rate: 30 },   // Onix
      { speciesId: 66, levelMin: 24, levelMax: 28, rate: 50 },   // Machop
      { speciesId: 67, levelMin: 36, levelMax: 40, rate: 20 },   // Machoke
    ],
    trainerPlacements: [], itemBalls: [], signs: [], connections: [],
    music: 'victory-road',
  };
}

export const victoryRoad1F = makeVictoryRoadFloor('victory-road-1f', 'VICTORY ROAD 1F');
setTile(victoryRoad1F.tiles, 1, 14, T.STAIRS_UP); setTile(victoryRoad1F.collisions, 1, 14, C.WARP);
setTile(victoryRoad1F.tiles, 13, 1, T.STAIRS_UP); setTile(victoryRoad1F.collisions, 13, 1, C.WARP);
victoryRoad1F.warps = [
  { x: 1, y: 14, targetMap: 'route-23', targetX: 5, targetY: 2 },
  { x: 13, y: 1, targetMap: 'victory-road-2f', targetX: 13, targetY: 13 },
];
victoryRoad1F.trainerPlacements = [
  { trainerId: 'cooltrainer-m-2', x: 8, y: 3, facing: 'down', sightRange: 4, flag: 'vr-1f-cool-1' },
  { trainerId: 'cooltrainer-f-3', x: 3, y: 7, facing: 'right', sightRange: 4, flag: 'vr-1f-cool-2' },
  { trainerId: 'blackbelt-7', x: 10, y: 12, facing: 'up', sightRange: 3, flag: 'vr-1f-blackbelt' },
];
victoryRoad1F.itemBalls = [
  { x: 7, y: 1, itemId: 22, quantity: 1, flag: 'vr-1f-tm' },
  { x: 1, y: 8, itemId: 20, quantity: 1, flag: 'vr-1f-rare-candy' },
];

export const victoryRoad2F = makeVictoryRoadFloor('victory-road-2f', 'VICTORY ROAD 2F');
setTile(victoryRoad2F.tiles, 13, 13, T.STAIRS_DOWN); setTile(victoryRoad2F.collisions, 13, 13, C.WARP);
setTile(victoryRoad2F.tiles, 1, 1, T.STAIRS_UP); setTile(victoryRoad2F.collisions, 1, 1, C.WARP);
victoryRoad2F.warps = [
  { x: 13, y: 13, targetMap: 'victory-road-1f', targetX: 13, targetY: 1 },
  { x: 1, y: 1, targetMap: 'indigo-plateau', targetX: 7, targetY: 13 },
];
victoryRoad2F.trainerPlacements = [
  { trainerId: 'cooltrainer-m-3', x: 5, y: 5, facing: 'right', sightRange: 4, flag: 'vr-2f-cool-1' },
  { trainerId: 'cooltrainer-f-4', x: 10, y: 7, facing: 'left', sightRange: 4, flag: 'vr-2f-cool-2' },
  { trainerId: 'juggler-3', x: 3, y: 12, facing: 'right', sightRange: 3, flag: 'vr-2f-juggler' },
];
// Moltres is found in Victory Road (original game)
victoryRoad2F.itemBalls = [
  { x: 7, y: 13, itemId: 26, quantity: 1, flag: 'vr-2f-full-restore' },
];

// ========== Seafoam Islands (simplified to 2 floors) ==========

function makeSeafoamFloor(id: string, name: string): GameMap {
  const w = 15, h = 15;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.CAVE_WALL); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 5, 4, 5, 3, T.CAVE_WALL); fillRect(collisions, 5, 4, 5, 3, C.SOLID);
  fillRect(tiles, 2, 9, 4, 3, T.CAVE_WALL); fillRect(collisions, 2, 9, 4, 3, C.SOLID);
  // Water
  fillRect(tiles, 9, 8, 4, 5, T.WATER); fillRect(collisions, 9, 8, 4, 5, C.WATER);
  // Boulders
  setTile(tiles, 7, 8, T.BOULDER); setTile(collisions, 7, 8, C.BOULDER);
  return {
    id, name, width: w, height: h, tiles, collisions,
    warps: [], npcs: [],
    wildEncounters: [
      { speciesId: 41, levelMin: 21, levelMax: 26, rate: 40 },
      { speciesId: 42, levelMin: 26, levelMax: 30, rate: 20 },   // Golbat
      { speciesId: 86, levelMin: 28, levelMax: 32, rate: 50 },   // Seel
      { speciesId: 87, levelMin: 32, levelMax: 38, rate: 20 },   // Dewgong
      { speciesId: 90, levelMin: 28, levelMax: 32, rate: 30 },   // Shellder
    ],
    trainerPlacements: [], itemBalls: [], signs: [], connections: [],
    music: 'seafoam-islands',
  };
}

export const seafoamIslands1F = makeSeafoamFloor('seafoam-islands-1f', 'SEAFOAM ISLANDS 1F');
setTile(seafoamIslands1F.tiles, 5, 1, T.STAIRS_UP); setTile(seafoamIslands1F.collisions, 5, 1, C.WARP);
setTile(seafoamIslands1F.tiles, 13, 13, T.STAIRS_DOWN); setTile(seafoamIslands1F.collisions, 13, 13, C.WARP);
seafoamIslands1F.warps = [
  { x: 5, y: 1, targetMap: 'route-20', targetX: 15, targetY: 5 },
  { x: 13, y: 13, targetMap: 'seafoam-islands-b1f', targetX: 13, targetY: 1 },
];

export const seafoamIslandsB1F = makeSeafoamFloor('seafoam-islands-b1f', 'SEAFOAM ISLANDS B1F');
setTile(seafoamIslandsB1F.tiles, 13, 1, T.STAIRS_UP); setTile(seafoamIslandsB1F.collisions, 13, 1, C.WARP);
seafoamIslandsB1F.warps = [
  { x: 13, y: 1, targetMap: 'seafoam-islands-1f', targetX: 13, targetY: 13 },
];
// Articuno
seafoamIslandsB1F.npcs = [
  { id: 'articuno', x: 7, y: 7, spriteId: 'articuno', facing: 'down', movement: 'stationary',
    dialogue: ['Gyaaao!'], condition: 'before-articuno-caught' },
];

// ========== Power Plant ==========
const ppW = 15, ppH = 15;
const ppT = makeGrid(ppW, ppH, T.FLOOR);
const ppC = makeGrid(ppW, ppH, C.WALKABLE);
fillRow(ppT, 0, 0, ppW, T.BUILDING_WALL); fillRow(ppC, 0, 0, ppW, C.SOLID);
fillRow(ppT, 0, ppH - 1, ppW, T.BUILDING_WALL); fillRow(ppC, 0, ppH - 1, ppW, C.SOLID);
fillRect(ppT, 0, 0, 1, ppH, T.BUILDING_WALL); fillRect(ppC, 0, 0, 1, ppH, C.SOLID);
fillRect(ppT, ppW - 1, 0, 1, ppH, T.BUILDING_WALL); fillRect(ppC, ppW - 1, 0, 1, ppH, C.SOLID);
fillRect(ppT, 5, 3, 5, 3, T.BUILDING_WALL); fillRect(ppC, 5, 3, 5, 3, C.SOLID);
fillRect(ppT, 2, 9, 4, 3, T.BUILDING_WALL); fillRect(ppC, 2, 9, 4, 3, C.SOLID);
fillRect(ppT, 9, 8, 4, 3, T.BUILDING_WALL); fillRect(ppC, 9, 8, 4, 3, C.SOLID);
setTile(ppT, 1, ppH - 1, T.DOOR); setTile(ppC, 1, ppH - 1, C.WARP);

export const powerPlant: GameMap = {
  id: 'power-plant', name: 'POWER PLANT',
  width: ppW, height: ppH, tiles: ppT, collisions: ppC,
  warps: [
    { x: 1, y: ppH - 1, targetMap: 'route-10', targetX: 8, targetY: 5 },
  ],
  npcs: [
    { id: 'zapdos', x: 7, y: 1, spriteId: 'zapdos', facing: 'down', movement: 'stationary',
      dialogue: ['Gyaaao!'], condition: 'before-zapdos-caught' },
  ],
  wildEncounters: [
    { speciesId: 100, levelMin: 21, levelMax: 28, rate: 80 },  // Voltorb
    { speciesId: 101, levelMin: 30, levelMax: 36, rate: 30 },  // Electrode
    { speciesId: 81, levelMin: 21, levelMax: 28, rate: 80 },   // Magnemite
    { speciesId: 82, levelMin: 30, levelMax: 36, rate: 30 },   // Magneton
    { speciesId: 125, levelMin: 33, levelMax: 36, rate: 10 },  // Electabuzz
  ],
  trainerPlacements: [],
  itemBalls: [
    { x: 13, y: 3, itemId: 22, quantity: 1, flag: 'pp-tm-thunder' },
    { x: 3, y: 7, itemId: 20, quantity: 1, flag: 'pp-rare-candy' },
    { x: 11, y: 12, itemId: 26, quantity: 1, flag: 'pp-max-elixir' },
  ],
  signs: [], connections: [],
  music: 'power-plant',
};

// ========== Safari Zone (4 areas, simplified to 2) ==========

function makeSafariArea(id: string, name: string, encounters: GameMap['wildEncounters']): GameMap {
  const w = 20, h = 20;
  const tiles = makeGrid(w, h, T.GRASS);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.FENCE); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.FENCE); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.FENCE); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.FENCE); fillCol(collisions, w - 1, 0, h, C.SOLID);
  // Scattered tall grass
  fillRect(tiles, 3, 3, 5, 4, T.TALL_GRASS); fillRect(collisions, 3, 3, 5, 4, C.TALL_GRASS);
  fillRect(tiles, 12, 5, 5, 4, T.TALL_GRASS); fillRect(collisions, 12, 5, 5, 4, C.TALL_GRASS);
  fillRect(tiles, 4, 11, 6, 4, T.TALL_GRASS); fillRect(collisions, 4, 11, 6, 4, C.TALL_GRASS);
  fillRect(tiles, 13, 12, 5, 4, T.TALL_GRASS); fillRect(collisions, 13, 12, 5, 4, C.TALL_GRASS);
  // Water
  fillRect(tiles, 1, 16, 4, 3, T.WATER); fillRect(collisions, 1, 16, 4, 3, C.WATER);
  // Paths
  fillRect(tiles, 9, 1, 2, 18, T.PATH); fillRect(collisions, 9, 1, 2, 18, C.WALKABLE);
  fillRect(tiles, 1, 9, 18, 2, T.PATH); fillRect(collisions, 1, 9, 18, 2, C.WALKABLE);
  return {
    id, name, width: w, height: h, tiles, collisions,
    warps: [], npcs: [], wildEncounters: encounters,
    trainerPlacements: [], itemBalls: [], signs: [], connections: [],
    music: 'safari-zone',
  };
}

export const safariZone1 = makeSafariArea('safari-zone-1', 'SAFARI ZONE AREA 1', [
  { speciesId: 29, levelMin: 22, levelMax: 28, rate: 50 },   // Nidoran-F
  { speciesId: 32, levelMin: 22, levelMax: 28, rate: 50 },   // Nidoran-M
  { speciesId: 111, levelMin: 25, levelMax: 28, rate: 30 },  // Rhyhorn
  { speciesId: 102, levelMin: 23, levelMax: 27, rate: 40 },  // Exeggcute
  { speciesId: 115, levelMin: 25, levelMax: 28, rate: 10 },  // Kangaskhan
  { speciesId: 127, levelMin: 23, levelMax: 28, rate: 10 },  // Pinsir
  { speciesId: 128, levelMin: 25, levelMax: 28, rate: 10 },  // Tauros
  { speciesId: 113, levelMin: 26, levelMax: 28, rate: 5 },   // Chansey
]);
setTile(safariZone1.tiles, 10, safariZone1.height - 1, T.DOOR);
setTile(safariZone1.collisions, 10, safariZone1.height - 1, C.WARP);
setTile(safariZone1.tiles, 10, 0, T.DOOR);
setTile(safariZone1.collisions, 10, 0, C.WARP);
safariZone1.warps = [
  { x: 10, y: safariZone1.height - 1, targetMap: 'fuchsia-city', targetX: 10, targetY: 3 },
  { x: 10, y: 0, targetMap: 'safari-zone-2', targetX: 10, targetY: 19 },
];
safariZone1.itemBalls = [
  { x: 15, y: 3, itemId: 17, quantity: 1, flag: 'sz1-max-potion' },
  { x: 3, y: 14, itemId: 20, quantity: 1, flag: 'sz1-nugget' },
];

export const safariZone2 = makeSafariArea('safari-zone-2', 'SAFARI ZONE AREA 2', [
  { speciesId: 102, levelMin: 24, levelMax: 30, rate: 40 },
  { speciesId: 111, levelMin: 26, levelMax: 30, rate: 30 },
  { speciesId: 115, levelMin: 25, levelMax: 30, rate: 15 },
  { speciesId: 128, levelMin: 28, levelMax: 30, rate: 10 },
  { speciesId: 113, levelMin: 26, levelMax: 30, rate: 5 },
  { speciesId: 123, levelMin: 25, levelMax: 30, rate: 15 },  // Scyther
  { speciesId: 48, levelMin: 22, levelMax: 26, rate: 40 },
]);
setTile(safariZone2.tiles, 10, safariZone2.height - 1, T.DOOR);
setTile(safariZone2.collisions, 10, safariZone2.height - 1, C.WARP);
safariZone2.warps = [
  { x: 10, y: safariZone2.height - 1, targetMap: 'safari-zone-1', targetX: 10, targetY: 1 },
];
safariZone2.itemBalls = [
  { x: 5, y: 5, itemId: 39, quantity: 1, flag: 'sz2-gold-teeth' },  // Gold Teeth (for Warden)
  { x: 17, y: 15, itemId: 26, quantity: 1, flag: 'sz2-max-revive' },
];
// Secret house with HM03 Surf
safariZone2.npcs = [
  { id: 'safari-hm-man', x: 15, y: 3, spriteId: 'old-man', facing: 'down', movement: 'stationary',
    dialogue: ['You made it all the way here! Bravo!', 'Take this HM03 for SURF!'] },
];

// ========== Cerulean Cave (post-game, Mewtwo) ==========

function makeCeruleanCaveFloor(id: string, name: string): GameMap {
  const w = 15, h = 15;
  const tiles = makeGrid(w, h, T.CAVE_FLOOR);
  const collisions = makeGrid(w, h, C.WALKABLE);
  fillRow(tiles, 0, 0, w, T.CAVE_WALL); fillRow(collisions, 0, 0, w, C.SOLID);
  fillRow(tiles, 0, h - 1, w, T.CAVE_WALL); fillRow(collisions, 0, h - 1, w, C.SOLID);
  fillCol(tiles, 0, 0, h, T.CAVE_WALL); fillCol(collisions, 0, 0, h, C.SOLID);
  fillCol(tiles, w - 1, 0, h, T.CAVE_WALL); fillCol(collisions, w - 1, 0, h, C.SOLID);
  fillRect(tiles, 5, 4, 4, 3, T.CAVE_WALL); fillRect(collisions, 5, 4, 4, 3, C.SOLID);
  fillRect(tiles, 2, 9, 3, 3, T.CAVE_WALL); fillRect(collisions, 2, 9, 3, 3, C.SOLID);
  fillRect(tiles, 10, 8, 3, 4, T.CAVE_WALL); fillRect(collisions, 10, 8, 3, 4, C.SOLID);
  // Water
  fillRect(tiles, 6, 9, 4, 4, T.WATER); fillRect(collisions, 6, 9, 4, 4, C.WATER);
  return {
    id, name, width: w, height: h, tiles, collisions,
    warps: [], npcs: [],
    wildEncounters: [
      { speciesId: 42, levelMin: 46, levelMax: 54, rate: 40 },   // Golbat
      { speciesId: 64, levelMin: 46, levelMax: 54, rate: 30 },   // Kadabra
      { speciesId: 97, levelMin: 46, levelMax: 54, rate: 30 },   // Hypno
      { speciesId: 82, levelMin: 46, levelMax: 54, rate: 20 },   // Magneton
      { speciesId: 132, levelMin: 46, levelMax: 54, rate: 15 },  // Ditto
      { speciesId: 101, levelMin: 46, levelMax: 54, rate: 10 },  // Electrode
      { speciesId: 113, levelMin: 46, levelMax: 54, rate: 5 },   // Chansey
    ],
    trainerPlacements: [], itemBalls: [], signs: [], connections: [],
    music: 'cerulean-cave',
  };
}

export const ceruleanCave1F = makeCeruleanCaveFloor('cerulean-cave-1f', 'CERULEAN CAVE 1F');
setTile(ceruleanCave1F.tiles, 7, ceruleanCave1F.height - 2, T.STAIRS_UP);
setTile(ceruleanCave1F.collisions, 7, ceruleanCave1F.height - 2, C.WARP);
setTile(ceruleanCave1F.tiles, 1, 1, T.STAIRS_DOWN);
setTile(ceruleanCave1F.collisions, 1, 1, C.WARP);
ceruleanCave1F.warps = [
  { x: 7, y: ceruleanCave1F.height - 2, targetMap: 'cerulean-city', targetX: 3, targetY: 2 },
  { x: 1, y: 1, targetMap: 'cerulean-cave-b1f', targetX: 1, targetY: 1 },
];
ceruleanCave1F.itemBalls = [
  { x: 13, y: 3, itemId: 26, quantity: 1, flag: 'cc-1f-max-revive' },
  { x: 3, y: 7, itemId: 30, quantity: 1, flag: 'cc-1f-pp-up' },
];

export const ceruleanCaveB1F = makeCeruleanCaveFloor('cerulean-cave-b1f', 'CERULEAN CAVE B1F');
setTile(ceruleanCaveB1F.tiles, 1, 1, T.STAIRS_UP);
setTile(ceruleanCaveB1F.collisions, 1, 1, C.WARP);
ceruleanCaveB1F.warps = [
  { x: 1, y: 1, targetMap: 'cerulean-cave-1f', targetX: 1, targetY: 1 },
];
ceruleanCaveB1F.npcs = [
  { id: 'mewtwo', x: 7, y: 2, spriteId: 'mewtwo', facing: 'down', movement: 'stationary',
    dialogue: ['...!'], condition: 'before-mewtwo-caught' },
];
ceruleanCaveB1F.itemBalls = [
  { x: 12, y: 12, itemId: 26, quantity: 1, flag: 'cc-b1-ultra-ball' },
  { x: 3, y: 12, itemId: 26, quantity: 1, flag: 'cc-b1-full-restore' },
];
