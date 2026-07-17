// === Gen 1 Catch Mechanics ===

import type { Pokemon, StatusCondition } from '../data/game-types.ts';
import { randInt } from '../utils/random.ts';

export interface CatchResult {
  caught: boolean;
  wobbles: number; // 0-3 for animation
}

/**
 * Get the catch rate for a species.
 */
function getSpeciesCatchRate(speciesId: number): number {
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[speciesId];
    if (species) return species.catchRate;
  } catch {
    // Data not yet available
  }
  return 45; // Default catch rate
}

/**
 * Gen 1 catch algorithm.
 *
 * 1. Master Ball (id=4): always succeeds
 * 2. Generate R1 (0-255). If R1 < statusThreshold: catch
 *    - statusThreshold: 12 for sleep/freeze, 25 for other status, 0 for none
 * 3. ballFactor: Poke Ball=255, Great Ball=200, Ultra Ball=150, Safari Ball=150
 * 4. If R1 - statusThreshold >= species catchRate: fail (0 wobbles)
 * 5. hpFactor = floor(maxHP * 255 / ballDivisor)
 *    - ballDivisor: 8 for Great Ball, 12 for others
 * 6. hpFactor = max(1, floor(hpFactor / max(1, floor(currentHP / 4))))
 * 7. Generate R2 (0-255). If R2 <= hpFactor: catch. Else: fail.
 * 8. Calculate wobbles (0-3) for animation
 */
export function attemptCatch(
  target: Pokemon,
  ballId: number,
  catchRateOverride?: number
): CatchResult {
  // Master Ball (id=4): always succeeds
  if (ballId === 4) {
    return { caught: true, wobbles: 3 };
  }

  const catchRate = catchRateOverride ?? getSpeciesCatchRate(target.speciesId);
  const status = target.status;

  // Status threshold
  let statusThreshold = 0;
  if (status === 'sleep' || status === 'freeze') {
    statusThreshold = 12;
  } else if (status !== 'none') {
    statusThreshold = 25;
  }

  // Ball factor and divisor
  let ballFactor: number;
  let ballDivisor: number;

  switch (ballId) {
    case 2: // Great Ball
      ballFactor = 200;
      ballDivisor = 8;
      break;
    case 3: // Ultra Ball
      ballFactor = 150;
      ballDivisor = 12;
      break;
    case 5: // Safari Ball
      ballFactor = 150;
      ballDivisor = 12;
      break;
    default: // Poke Ball (id=1) and others
      ballFactor = 255;
      ballDivisor = 12;
      break;
  }

  // Step 2: Generate R1
  const R1 = randInt(0, 255);

  // If R1 < statusThreshold: catch immediately
  if (R1 < statusThreshold) {
    return { caught: true, wobbles: 3 };
  }

  // Step 4: If R1 - statusThreshold >= catchRate: fail
  if (R1 - statusThreshold >= catchRate) {
    // Calculate wobbles based on how close
    const wobbles = calculateWobbles(catchRate, ballFactor, target.maxHp, target.hp, ballDivisor);
    return { caught: false, wobbles };
  }

  // Step 5-6: HP factor check
  let hpFactor = Math.floor(target.maxHp * 255 / ballDivisor);
  hpFactor = Math.max(1, Math.floor(hpFactor / Math.max(1, Math.floor(target.hp / 4))));

  // Clamp to 255
  if (hpFactor > 255) hpFactor = 255;

  // Step 7: Generate R2
  const R2 = randInt(0, 255);

  if (R2 <= hpFactor) {
    return { caught: true, wobbles: 3 };
  }

  // Failed - calculate wobbles
  const wobbles = calculateWobbles(catchRate, ballFactor, target.maxHp, target.hp, ballDivisor);
  return { caught: false, wobbles };
}

/**
 * Calculate the number of wobbles (0-3) for the catch animation.
 * Based on a catch probability factor.
 */
function calculateWobbles(
  catchRate: number,
  ballFactor: number,
  maxHp: number,
  currentHp: number,
  ballDivisor: number
): number {
  // Approximate wobble calculation based on catch difficulty
  // f = floor(catchRate * 100 / ballFactor)
  // wobbles based on random checks against f
  const f = Math.max(1, Math.floor(catchRate * 100 / ballFactor));
  const hpRatio = currentHp / Math.max(1, maxHp);

  // More wobbles when closer to catching
  // Each wobble has independent probability based on catch difficulty
  let wobbles = 0;
  for (let i = 0; i < 3; i++) {
    const check = randInt(0, 255);
    // Higher f and lower HP = more likely to pass each wobble check
    const threshold = Math.floor(f * (1 - hpRatio * 0.5));
    if (check < threshold) {
      wobbles++;
    } else {
      break;
    }
  }

  return wobbles;
}
