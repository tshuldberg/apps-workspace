// === Gen 1 Evolution Logic ===

import type { Pokemon, EvolutionData } from '../data/game-types.ts';

export interface EvolutionResult {
  evolves: boolean;
  newSpeciesId: number;
  oldSpeciesName: string;
  newSpeciesName: string;
}

const NO_EVOLUTION: EvolutionResult = { evolves: false, newSpeciesId: 0, oldSpeciesName: '', newSpeciesName: '' };

/**
 * Get species data for a given ID.
 */
function getSpecies(speciesId: number): import('../data/game-types.ts').PokemonSpecies | null {
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    return POKEMON[speciesId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a Pokemon should evolve after leveling up.
 */
export function checkLevelEvolution(pokemon: Pokemon): EvolutionResult {
  const species = getSpecies(pokemon.speciesId);
  if (!species?.evolution) return NO_EVOLUTION;

  const evo = species.evolution;
  if (evo.method === 'level' && pokemon.level >= evo.level) {
    const newSpecies = getSpecies(evo.into);
    return {
      evolves: true,
      newSpeciesId: evo.into,
      oldSpeciesName: species.name,
      newSpeciesName: newSpecies?.name ?? `Species #${evo.into}`,
    };
  }

  return NO_EVOLUTION;
}

/**
 * Check if a Pokemon can evolve with a given evolution stone.
 */
export function checkStoneEvolution(pokemon: Pokemon, stoneName: string): EvolutionResult {
  const species = getSpecies(pokemon.speciesId);
  if (!species?.evolution) return NO_EVOLUTION;

  const evo = species.evolution;
  if (evo.method === 'stone' && evo.stone === stoneName) {
    const newSpecies = getSpecies(evo.into);
    return {
      evolves: true,
      newSpeciesId: evo.into,
      oldSpeciesName: species.name,
      newSpeciesName: newSpecies?.name ?? `Species #${evo.into}`,
    };
  }

  return NO_EVOLUTION;
}

/**
 * Check if a Pokemon evolves via trade.
 */
export function checkTradeEvolution(pokemon: Pokemon): EvolutionResult {
  const species = getSpecies(pokemon.speciesId);
  if (!species?.evolution) return NO_EVOLUTION;

  const evo = species.evolution;
  if (evo.method === 'trade') {
    const newSpecies = getSpecies(evo.into);
    return {
      evolves: true,
      newSpeciesId: evo.into,
      oldSpeciesName: species.name,
      newSpeciesName: newSpecies?.name ?? `Species #${evo.into}`,
    };
  }

  return NO_EVOLUTION;
}

/**
 * Apply evolution: update the Pokemon's species ID and recalculate stats.
 * Preserves DVs, stat exp, nickname (unless it matched old species name), moves, etc.
 */
export function applyEvolution(pokemon: Pokemon, newSpeciesId: number): void {
  const oldSpecies = getSpecies(pokemon.speciesId);
  const newSpecies = getSpecies(newSpeciesId);

  // If nickname matches old species name, update to new species name
  if (oldSpecies && pokemon.nickname === oldSpecies.name && newSpecies) {
    pokemon.nickname = newSpecies.name;
  }

  pokemon.speciesId = newSpeciesId;

  // Recalculate stats with new base stats
  const { recalcStats } = require('./stats.ts') as typeof import('./stats.ts');
  recalcStats(pokemon);
}
