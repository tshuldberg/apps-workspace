// === Gen 1 Stat Calculation System ===

import type { GrowthRate, Pokemon, PokemonMove } from '../data/game-types.ts';
import { STAT_STAGE_MULTIPLIERS, MAX_DV } from '../constants.ts';
import { randInt } from '../utils/random.ts';

/**
 * HP DV is derived from the least significant bits of the other four DVs.
 * HP_DV = (AtkDV % 2) * 8 + (DefDV % 2) * 4 + (SpdDV % 2) * 2 + (SpcDV % 2)
 */
export function getHpDV(atkDV: number, defDV: number, spdDV: number, spcDV: number): number {
  return (atkDV % 2) * 8 + (defDV % 2) * 4 + (spdDV % 2) * 2 + (spcDV % 2) * 1;
}

/**
 * Gen 1 HP formula:
 * floor(((Base + IV) * 2 + floor(ceil(sqrt(StatExp)) / 4)) * Level / 100) + Level + 10
 */
export function calcHp(base: number, dv: number, statExp: number, level: number): number {
  const evBonus = Math.floor(Math.ceil(Math.sqrt(statExp)) / 4);
  return Math.floor(((base + dv) * 2 + evBonus) * level / 100) + level + 10;
}

/**
 * Gen 1 stat formula (Attack, Defense, Speed, Special):
 * floor(((Base + IV) * 2 + floor(ceil(sqrt(StatExp)) / 4)) * Level / 100) + 5
 */
export function calcStat(base: number, dv: number, statExp: number, level: number): number {
  const evBonus = Math.floor(Math.ceil(Math.sqrt(statExp)) / 4);
  return Math.floor(((base + dv) * 2 + evBonus) * level / 100) + 5;
}

/**
 * Apply stat stage modifier using STAT_STAGE_MULTIPLIERS lookup table.
 * Stage ranges from -6 to +6, stored in array index 0-12 (index 6 = stage 0).
 */
export function applyStatStage(stat: number, stage: number): number {
  const index = stage + 6;
  const clamped = Math.max(0, Math.min(12, index));
  const [num, den] = STAT_STAGE_MULTIPLIERS[clamped]!;
  return Math.floor(stat * num / den);
}

/** Generate random DVs (0-15 each for Attack, Defense, Speed, Special). */
export function generateRandomDVs(): { attack: number; defense: number; speed: number; special: number } {
  return {
    attack: randInt(0, MAX_DV),
    defense: randInt(0, MAX_DV),
    speed: randInt(0, MAX_DV),
    special: randInt(0, MAX_DV),
  };
}

/**
 * Create a new Pokemon instance from species data + level.
 * Generates random DVs, sets stat exp to 0, calculates all stats,
 * picks moves from learnset (last 4 moves at or below the given level).
 */
export function createPokemon(speciesId: number, level: number, nickname?: string): Pokemon {
  // Imports from data layer (created by data-architect agent in parallel)
  const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
  const species = POKEMON[speciesId];
  if (!species) throw new Error(`Unknown species ID: ${speciesId}`);

  const dvs = generateRandomDVs();
  const hpDV = getHpDV(dvs.attack, dvs.defense, dvs.speed, dvs.special);
  const statExp = { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 };

  const maxHp = calcHp(species.baseStats.hp, hpDV, 0, level);
  const attack = calcStat(species.baseStats.attack, dvs.attack, 0, level);
  const defense = calcStat(species.baseStats.defense, dvs.defense, 0, level);
  const speed = calcStat(species.baseStats.speed, dvs.speed, 0, level);
  const special = calcStat(species.baseStats.special, dvs.special, 0, level);

  // Pick moves: last 4 moves in learnset at or below the given level
  const availableMoves = species.learnset
    .filter(e => e.level <= level)
    .map(e => e.moveId);
  const selectedMoveIds = availableMoves.slice(-4);

  const { MOVES } = require('../data/moves.ts') as { MOVES: Record<number, import('../data/game-types.ts').MoveData> };
  const moves: PokemonMove[] = selectedMoveIds.map(moveId => {
    const moveData = MOVES[moveId];
    const pp = moveData?.pp ?? 10;
    return { moveId, pp, maxPp: pp };
  });

  const exp = expForLevel(level, species.growthRate);

  return {
    speciesId,
    nickname: nickname ?? species.name,
    level,
    exp,
    hp: maxHp,
    maxHp,
    attack,
    defense,
    special,
    speed,
    dvs,
    statExp,
    moves,
    status: 'none',
    statusTurns: 0,
    originalTrainer: 'PLAYER',
  };
}

/** Recalculate all stats for a Pokemon (call after level up or stat exp change). */
export function recalcStats(pokemon: Pokemon): void {
  const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
  const species = POKEMON[pokemon.speciesId];
  if (!species) return;

  const hpDV = getHpDV(pokemon.dvs.attack, pokemon.dvs.defense, pokemon.dvs.speed, pokemon.dvs.special);
  const oldMaxHp = pokemon.maxHp;

  pokemon.maxHp = calcHp(species.baseStats.hp, hpDV, pokemon.statExp.hp, pokemon.level);
  pokemon.attack = calcStat(species.baseStats.attack, pokemon.dvs.attack, pokemon.statExp.attack, pokemon.level);
  pokemon.defense = calcStat(species.baseStats.defense, pokemon.dvs.defense, pokemon.statExp.defense, pokemon.level);
  pokemon.speed = calcStat(species.baseStats.speed, pokemon.dvs.speed, pokemon.statExp.speed, pokemon.level);
  pokemon.special = calcStat(species.baseStats.special, pokemon.dvs.special, pokemon.statExp.special, pokemon.level);

  // Adjust current HP by the difference in max HP (so leveling up heals the gained amount)
  pokemon.hp = Math.min(pokemon.hp + (pokemon.maxHp - oldMaxHp), pokemon.maxHp);
}

/**
 * Experience required to reach a given level for a growth rate.
 * Fast:        floor(4 * n^3 / 5)
 * Medium Fast: n^3
 * Medium Slow: floor(6/5 * n^3 - 15 * n^2 + 100 * n - 140)
 * Slow:        floor(5 * n^3 / 4)
 */
export function expForLevel(level: number, growthRate: GrowthRate): number {
  const n = level;
  switch (growthRate) {
    case 'fast':
      return Math.floor(4 * n * n * n / 5);
    case 'medium-fast':
      return n * n * n;
    case 'medium-slow':
      return Math.floor(6 / 5 * n * n * n - 15 * n * n + 100 * n - 140);
    case 'slow':
      return Math.floor(5 * n * n * n / 4);
  }
}
