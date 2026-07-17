import type { GameMap, Pokemon, WildEncounter } from '../data/game-types.ts';
import { COLLISION } from './map-engine.ts';
import { randInt, weightedPick } from '../utils/random.ts';
import { createPokemon } from '../battle/stats.ts';

const ENCOUNTER_THRESHOLD = 21; // out of 256, ~8.2% per step

/** Check for a wild encounter after stepping on a triggering tile */
export function checkEncounter(
  map: GameMap,
  tileCollision: number,
  _stepCount: number,
  repelSteps: number,
  leadPokemonLevel: number,
): Pokemon | null {
  // Only trigger in tall grass, cave floors, or water (while surfing)
  const isTrigger =
    tileCollision === COLLISION.TALL_GRASS ||
    tileCollision === 18 || // cave-floor tile (collision map stores the collision type, but some caves use tile-id based)
    tileCollision === COLLISION.WATER;

  if (!isTrigger) return null;

  // Filter encounters for this terrain type
  const encounters = map.wildEncounters;
  if (encounters.length === 0) return null;

  // Random check
  if (randInt(0, 255) >= ENCOUNTER_THRESHOLD) return null;

  // Pick a Pokemon from the encounter table using weighted selection
  const weights = encounters.map(e => e.rate);
  const index = weightedPick(weights);
  const encounter = encounters[index];
  if (!encounter) return null;

  // Generate level in range
  const level = randInt(encounter.levelMin, encounter.levelMax);

  // Repel check: skip if active and lead Pokemon out-levels the encounter
  if (repelSteps > 0 && leadPokemonLevel > level) return null;

  return createWildPokemon(encounter.speciesId, level);
}

/** Check for a fishing encounter */
export function checkFishingEncounter(
  rod: 'old' | 'good' | 'super',
  map: GameMap,
): Pokemon | null {
  switch (rod) {
    case 'old':
      // Old Rod: always Magikarp level 5
      return createWildPokemon(129, 5); // Magikarp = species 129

    case 'good': {
      // Good Rod: limited pool, 50% encounter rate
      if (randInt(0, 1) === 0) return null;
      // Use lower-level encounters from the map's water table, or default to Poliwag/Goldeen
      const goodPool: WildEncounter[] = map.wildEncounters.length > 0
        ? map.wildEncounters.filter(e => e.levelMax <= 25)
        : [{ speciesId: 60, levelMin: 10, levelMax: 15, rate: 50 },  // Poliwag
           { speciesId: 118, levelMin: 10, levelMax: 15, rate: 50 }]; // Goldeen
      if (goodPool.length === 0) return createWildPokemon(60, randInt(10, 15));
      const weights = goodPool.map(e => e.rate);
      const idx = weightedPick(weights);
      const enc = goodPool[idx];
      if (!enc) return null;
      return createWildPokemon(enc.speciesId, randInt(enc.levelMin, enc.levelMax));
    }

    case 'super': {
      // Super Rod: full water encounter table
      const waterEncounters = map.wildEncounters;
      if (waterEncounters.length === 0) return null;
      const weights = waterEncounters.map(e => e.rate);
      const idx = weightedPick(weights);
      const enc = waterEncounters[idx];
      if (!enc) return null;
      return createWildPokemon(enc.speciesId, randInt(enc.levelMin, enc.levelMax));
    }
  }
}

/** Create a wild Pokemon with proper stats from the species data */
function createWildPokemon(speciesId: number, level: number): Pokemon {
  const pokemon = createPokemon(speciesId, level);
  pokemon.originalTrainer = 'WILD';
  return pokemon;
}
