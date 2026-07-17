// === Gen 1 Experience & Leveling System ===

import type { Pokemon, PokemonMove } from '../data/game-types.ts';
import { MAX_LEVEL } from '../constants.ts';
import { expForLevel, recalcStats } from './stats.ts';

export interface ExpGainResult {
  expGained: number;
  leveledUp: boolean;
  newLevel: number;
  newMoves: number[]; // move IDs learned on level up
  /** True if the Pokemon tried to learn a move but already has 4 */
  moveOverflowed: boolean;
}

/**
 * Calculate EXP gained from defeating a Pokemon.
 * EXP = floor(a * b * L / (7 * s))
 *   a = 1.5 for trainer battles, 1.0 for wild
 *   b = base experience yield of defeated Pokemon
 *   L = level of defeated Pokemon
 *   s = number of Pokemon that participated in the battle
 */
export function calculateExpGain(
  defeatedSpeciesId: number,
  defeatedLevel: number,
  isTrainerBattle: boolean,
  participantCount: number
): number {
  let baseExp = 64; // default
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[defeatedSpeciesId];
    if (species) baseExp = species.baseExp;
  } catch {
    // Data not yet available
  }

  const a = isTrainerBattle ? 1.5 : 1.0;
  const s = Math.max(1, participantCount);

  return Math.floor(a * baseExp * defeatedLevel / (7 * s));
}

/**
 * Award EXP to a Pokemon and handle level ups.
 * Returns information about what happened (levels gained, new moves).
 */
export function awardExp(pokemon: Pokemon, expAmount: number): ExpGainResult {
  if (pokemon.level >= MAX_LEVEL) {
    return { expGained: 0, leveledUp: false, newLevel: pokemon.level, newMoves: [], moveOverflowed: false };
  }

  let growthRate: import('../data/game-types.ts').GrowthRate = 'medium-fast';
  let learnset: readonly { level: number; moveId: number }[] = [];

  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[pokemon.speciesId];
    if (species) {
      growthRate = species.growthRate;
      learnset = species.learnset;
    }
  } catch {
    // Data not yet available
  }

  pokemon.exp += expAmount;

  const startLevel = pokemon.level;
  const newMoves: number[] = [];
  let moveOverflowed = false;

  // Check for level ups
  while (pokemon.level < MAX_LEVEL) {
    const nextLevelExp = expForLevel(pokemon.level + 1, growthRate);
    if (pokemon.exp < nextLevelExp) break;

    pokemon.level++;
    recalcStats(pokemon);

    // Check for new moves at this level
    for (const entry of learnset) {
      if (entry.level === pokemon.level) {
        // Check if the Pokemon already knows this move
        const alreadyKnows = pokemon.moves.some(m => m.moveId === entry.moveId);
        if (!alreadyKnows) {
          if (pokemon.moves.length < 4) {
            // Learn the move automatically
            let pp = 10;
            try {
              const { MOVES } = require('../data/moves.ts') as { MOVES: Record<number, import('../data/game-types.ts').MoveData> };
              const moveData = MOVES[entry.moveId];
              if (moveData) pp = moveData.pp;
            } catch {
              // Data not yet available
            }
            pokemon.moves.push({ moveId: entry.moveId, pp, maxPp: pp });
            newMoves.push(entry.moveId);
          } else {
            // Has 4 moves already — needs player prompt to replace
            newMoves.push(entry.moveId);
            moveOverflowed = true;
          }
        }
      }
    }
  }

  // Cap exp at max level threshold
  const maxExp = expForLevel(MAX_LEVEL, growthRate);
  if (pokemon.exp > maxExp) {
    pokemon.exp = maxExp;
  }

  return {
    expGained: expAmount,
    leveledUp: pokemon.level > startLevel,
    newLevel: pokemon.level,
    newMoves,
    moveOverflowed,
  };
}

/**
 * Add stat experience from a defeated Pokemon.
 * In Gen 1, stat experience gained equals the defeated Pokemon's base stats.
 */
export function addStatExp(pokemon: Pokemon, defeatedSpeciesId: number): void {
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[defeatedSpeciesId];
    if (!species) return;

    const cap = 65535;
    pokemon.statExp.hp = Math.min(cap, pokemon.statExp.hp + species.baseStats.hp);
    pokemon.statExp.attack = Math.min(cap, pokemon.statExp.attack + species.baseStats.attack);
    pokemon.statExp.defense = Math.min(cap, pokemon.statExp.defense + species.baseStats.defense);
    pokemon.statExp.speed = Math.min(cap, pokemon.statExp.speed + species.baseStats.speed);
    pokemon.statExp.special = Math.min(cap, pokemon.statExp.special + species.baseStats.special);
  } catch {
    // Data not yet available
  }
}
