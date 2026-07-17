// === Gen 1 Damage Calculation ===

import type { Pokemon, MoveData, VolatileStatus } from '../data/game-types.ts';
import type { StatStages } from './engine.ts';
import { isSpecialType, getEffectiveness } from '../data/types.ts';
import { applyStatStage } from './stats.ts';
import { randInt } from '../utils/random.ts';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
  effectiveness: number; // 0, 0.25, 0.5, 1, 2, 4
  typeMessage: 'immune' | 'not-very-effective' | 'normal' | 'super-effective' | null;
}

/**
 * Determine if a critical hit occurs.
 * Normal: floor(baseSpeed / 2) out of 256
 * High-crit moves: floor(baseSpeed * 4) out of 256, capped at 255
 * Focus Energy BUG: divides crit rate by 4 instead of multiplying
 */
export function checkCritical(
  baseSpeed: number,
  highCrit: boolean,
  hasFocusEnergy: boolean
): boolean {
  let threshold: number;
  if (highCrit) {
    threshold = Math.min(255, Math.floor(baseSpeed * 4));
  } else {
    threshold = Math.floor(baseSpeed / 2);
  }

  // Gen 1 Focus Energy bug: divides by 4 instead of multiplying
  if (hasFocusEnergy) {
    threshold = Math.floor(threshold / 4);
  }

  // Clamp to valid range
  threshold = Math.min(255, Math.max(0, threshold));
  return randInt(0, 255) < threshold;
}

function effectivenessMessage(eff: number): DamageResult['typeMessage'] {
  if (eff === 0) return 'immune';
  if (eff < 1) return 'not-very-effective';
  if (eff > 1) return 'super-effective';
  return 'normal';
}

/**
 * Get the types of a Pokemon by looking up its species.
 * Falls back to ['Normal'] if species data not found.
 */
function getPokemonTypes(pokemon: Pokemon): readonly import('../data/types.ts').Type[] {
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[pokemon.speciesId];
    if (species) return species.types;
  } catch {
    // Data not yet available
  }
  return ['Normal'] as const;
}

/**
 * Get base stats of a Pokemon by looking up its species.
 */
function getBaseStats(pokemon: Pokemon): import('../data/game-types.ts').BaseStats {
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[pokemon.speciesId];
    if (species) return species.baseStats;
  } catch {
    // Data not yet available
  }
  return { hp: 50, attack: 50, defense: 50, special: 50, speed: 50 };
}

/**
 * Full Gen 1 damage calculation.
 *
 * 1. Determine A (attack stat) and D (defense stat) based on move type (physical vs special).
 *    - Critical hit: use unmodified base stats (ignore stat stages).
 *    - Non-crit: apply stat stages, then Reflect/Light Screen doubles D.
 * 2. If A >= 256 or D >= 256: A = floor(A/4) % 256; D = floor(D/4) % 256; if A==0 then A=1.
 * 3. damage = floor(floor(floor(2*Level*CritMult/5+2) * Power * A / D) / 50) + 2
 * 4. STAB: if move type matches attacker's type(s), damage = floor(damage * 3 / 2)
 * 5. Type effectiveness: multiply per defender type
 * 6. Random factor: if damage > 0, damage = max(1, floor(damage * randInt(217,255) / 255))
 */
export interface DamageCalcOptions {
  attackerTypes?: readonly import('../data/types.ts').Type[];
  defenderTypes?: readonly import('../data/types.ts').Type[];
  baseSpeed?: number;
}

export function calculateDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: MoveData,
  attackerStages: StatStages,
  defenderStages: StatStages,
  defenderVolatile: Set<VolatileStatus>,
  options?: DamageCalcOptions
): DamageResult {
  const attackerTypes = options?.attackerTypes ?? getPokemonTypes(attacker);
  const defenderTypes = options?.defenderTypes ?? getPokemonTypes(defender);
  const attackerBaseStats = options?.baseSpeed !== undefined
    ? { ...getBaseStats(attacker), speed: options.baseSpeed }
    : getBaseStats(attacker);

  // Check for critical hit
  const isCritical = checkCritical(
    attackerBaseStats.speed,
    move.highCrit,
    false // focus energy is handled by the caller passing the volatile set
  );

  const isSpecial = isSpecialType(move.type);

  // Determine A and D
  let A: number;
  let D: number;

  if (isCritical) {
    // Critical hits use unmodified stats (no stat stages)
    A = isSpecial ? attacker.special : attacker.attack;
    D = isSpecial ? defender.special : defender.defense;
  } else {
    // Apply stat stages
    if (isSpecial) {
      A = applyStatStage(attacker.special, attackerStages.special);
      D = applyStatStage(defender.special, defenderStages.special);
    } else {
      A = applyStatStage(attacker.attack, attackerStages.attack);
      D = applyStatStage(defender.defense, defenderStages.defense);
    }

    // Reflect doubles physical defense, Light Screen doubles special defense
    if (!isSpecial && defenderVolatile.has('reflect')) {
      D *= 2;
    }
    if (isSpecial && defenderVolatile.has('light-screen')) {
      D *= 2;
    }
  }

  // Overflow handling: if A >= 256 or D >= 256
  if (A >= 256 || D >= 256) {
    A = Math.floor(A / 4) % 256;
    D = Math.floor(D / 4) % 256;
    if (A === 0) A = 1;
  }
  if (D === 0) D = 1;

  const power = move.power ?? 0;
  if (power === 0) {
    // Status moves or moves with no power
    const eff = getEffectiveness(move.type, defenderTypes as unknown as import('../data/types.ts').Type[]);
    return { damage: 0, isCritical: false, effectiveness: eff, typeMessage: effectivenessMessage(eff) };
  }

  const level = attacker.level;
  const critMult = isCritical ? 2 : 1;

  // Core damage formula
  let damage = Math.floor(Math.floor(Math.floor(2 * level * critMult / 5 + 2) * power * A / D) / 50) + 2;

  // STAB (Same Type Attack Bonus)
  const hasSTAB = attackerTypes.includes(move.type as any);
  if (hasSTAB) {
    damage = Math.floor(damage * 3 / 2);
  }

  // Type effectiveness
  const effectiveness = getEffectiveness(move.type, defenderTypes as unknown as import('../data/types.ts').Type[]);

  if (effectiveness === 0) {
    return { damage: 0, isCritical, effectiveness: 0, typeMessage: 'immune' };
  }

  // Apply effectiveness as integer multiplications to stay faithful to Gen 1
  // effectiveness can be 0.25, 0.5, 1, 2, or 4
  if (effectiveness === 0.25) {
    damage = Math.floor(Math.floor(damage * 5) / 20);
  } else if (effectiveness === 0.5) {
    damage = Math.floor(Math.floor(damage * 5) / 10);
  } else if (effectiveness === 2) {
    damage = Math.floor(damage * 2);
  } else if (effectiveness === 4) {
    damage = Math.floor(damage * 4);
  }

  // Random factor: multiply by random value 217-255, divide by 255
  if (damage > 0) {
    damage = Math.max(1, Math.floor(damage * randInt(217, 255) / 255));
  }

  return {
    damage,
    isCritical,
    effectiveness,
    typeMessage: effectivenessMessage(effectiveness),
  };
}
