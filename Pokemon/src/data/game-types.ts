// === Shared game type definitions used across all systems ===

import type { Type } from './types.ts';

// === Growth Rates ===
export type GrowthRate = 'fast' | 'medium-fast' | 'medium-slow' | 'slow';

// === Direction ===
export type Direction = 'up' | 'down' | 'left' | 'right';

// === Move Effects ===
export type MoveEffect =
  | 'none'
  | 'burn' | 'freeze' | 'paralyze' | 'poison' | 'bad-poison' | 'sleep' | 'confusion'
  | 'flinch'
  | 'atk-up-1' | 'atk-up-2' | 'def-up-1' | 'def-up-2'
  | 'spd-up-2' | 'spc-up-1' | 'spc-up-2'
  | 'acc-down-1' | 'eva-up-1'
  | 'atk-down-1' | 'def-down-1' | 'spd-down-1' | 'spc-down-1' | 'def-down-2'
  | 'recoil-25' | 'recoil-33'
  | 'drain-50'
  | 'multi-hit-2' | 'multi-hit-2-5'
  | 'charge' | 'recharge' | 'semi-invulnerable'
  | 'binding'
  | 'ohko'
  | 'fixed-20' | 'fixed-40' | 'level-damage' | 'psywave'
  | 'self-destruct'
  | 'recover-50' | 'rest'
  | 'transform' | 'mimic' | 'metronome' | 'mirror-move' | 'disable'
  | 'substitute' | 'bide' | 'counter'
  | 'conversion' | 'haze' | 'mist' | 'focus-energy'
  | 'reflect' | 'light-screen'
  | 'leech-seed' | 'dream-eater' | 'swift'
  | 'pay-day' | 'tri-attack' | 'thrash' | 'rage'
  | 'super-fang' | 'splash' | 'teleport';

// === Status Conditions ===
export type StatusCondition = 'none' | 'burn' | 'freeze' | 'paralyze' | 'poison' | 'bad-poison' | 'sleep';
export type VolatileStatus = 'confusion' | 'flinch' | 'bound' | 'seeded' | 'charging' | 'recharging'
  | 'semi-invulnerable' | 'biding' | 'raging' | 'thrashing' | 'mist' | 'focus-energy'
  | 'reflect' | 'light-screen' | 'substitute' | 'disabled' | 'transformed';

// === Pokemon Species Definition ===
export interface PokemonSpecies {
  id: number;
  name: string;
  types: readonly [Type] | readonly [Type, Type];
  baseStats: BaseStats;
  catchRate: number;
  baseExp: number;
  growthRate: GrowthRate;
  learnset: readonly LearnsetEntry[];
  tmMoves: readonly number[];
  hmMoves: readonly number[];
  evolution: EvolutionData | null;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  special: number;
  speed: number;
}

export interface LearnsetEntry {
  level: number;
  moveId: number;
}

export type EvolutionData =
  | { method: 'level'; level: number; into: number }
  | { method: 'stone'; stone: string; into: number }
  | { method: 'trade'; into: number };

// === Move Definition ===
export interface MoveData {
  id: number;
  name: string;
  type: Type;
  power: number | null;
  accuracy: number | null;
  pp: number;
  effect: MoveEffect;
  effectChance: number;
  priority: number;
  highCrit: boolean;
}

// === Item Definition ===
export type ItemCategory = 'pokeball' | 'medicine' | 'battle' | 'evolution-stone' | 'tm' | 'hm' | 'key' | 'misc';

export interface ItemData {
  id: number;
  name: string;
  category: ItemCategory;
  price: number;
  description: string;
  effect?: string;
}

// === Trainer Definition ===
export interface TrainerData {
  id: string;
  className: string;
  name: string;
  pokemon: TrainerPokemon[];
  reward: number;
  ai: 'basic' | 'smart' | 'gym-leader' | 'elite';
}

export interface TrainerPokemon {
  speciesId: number;
  level: number;
  moves?: number[];
}

// === Live Pokemon Instance ===
export interface Pokemon {
  speciesId: number;
  nickname: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  special: number;
  speed: number;
  dvs: { attack: number; defense: number; speed: number; special: number };
  statExp: { hp: number; attack: number; defense: number; speed: number; special: number };
  moves: PokemonMove[];
  status: StatusCondition;
  statusTurns: number;
  originalTrainer: string;
}

export interface PokemonMove {
  moveId: number;
  pp: number;
  maxPp: number;
}

// === Map Types ===
export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: number[][];
  collisions: number[][];
  warps: Warp[];
  npcs: NpcData[];
  wildEncounters: WildEncounter[];
  trainerPlacements: TrainerPlacement[];
  itemBalls: ItemBall[];
  signs: SignData[];
  connections: MapConnection[];
  music: string;
}

export interface Warp {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
}

export interface NpcData {
  id: string;
  x: number;
  y: number;
  spriteId: string;
  facing: Direction;
  movement: 'stationary' | 'wander' | 'patrol';
  dialogue: string[];
  condition?: string;
}

export interface WildEncounter {
  speciesId: number;
  levelMin: number;
  levelMax: number;
  rate: number;
}

export interface TrainerPlacement {
  trainerId: string;
  x: number;
  y: number;
  facing: Direction;
  sightRange: number;
  flag: string;
}

export interface ItemBall {
  x: number;
  y: number;
  itemId: number;
  quantity: number;
  flag: string;
}

export interface SignData {
  x: number;
  y: number;
  text: string;
}

export interface MapConnection {
  direction: Direction;
  mapId: string;
  offset: number;
}

// === Save Data ===
export interface SaveData {
  playerName: string;
  rivalName: string;
  party: Pokemon[];
  pcBoxes: (Pokemon | null)[][];
  bag: { itemId: number; quantity: number }[];
  money: number;
  badges: boolean[];
  eventFlags: Record<string, boolean>;
  currentMap: string;
  playerX: number;
  playerY: number;
  playerDirection: Direction;
  playTime: number;
  pokedexSeen: number[];
  pokedexCaught: number[];
  starterChoice: number;
}

// === Game State ===
export interface GameState {
  save: SaveData;
  currentMap: GameMap | null;
}
