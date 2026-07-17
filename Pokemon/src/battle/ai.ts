// === Gen 1 Trainer AI ===

import type { Pokemon, MoveData, TrainerData } from '../data/game-types.ts';
import type { BattleAction, BattleState, ActiveBattlePokemon } from './engine.ts';
import { isSpecialType, getEffectiveness } from '../data/types.ts';
import { rand } from '../utils/random.ts';

/**
 * Get move data from the data layer.
 */
function getMoveData(moveId: number): MoveData | null {
  try {
    const { MOVES } = require('../data/moves.ts') as { MOVES: Record<number, MoveData> };
    return MOVES[moveId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get species types from the data layer.
 */
function getSpeciesTypes(speciesId: number): readonly import('../data/types.ts').Type[] {
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[speciesId];
    if (species) return species.types;
  } catch {
    // Data not yet available
  }
  return ['Normal'] as const;
}

/**
 * Estimate damage a move would do (rough approximation for AI decision-making).
 */
function estimateDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: MoveData
): number {
  if (!move.power) return 0;

  const isSpecial = isSpecialType(move.type);
  const A = isSpecial ? attacker.special : attacker.attack;
  const D = isSpecial ? defender.special : defender.defense;

  // Simplified damage formula
  let damage = Math.floor(Math.floor(Math.floor(2 * attacker.level / 5 + 2) * move.power * A / Math.max(1, D)) / 50) + 2;

  // STAB
  const attackerTypes = getSpeciesTypes(attacker.speciesId);
  if (attackerTypes.includes(move.type as any)) {
    damage = Math.floor(damage * 3 / 2);
  }

  // Type effectiveness
  const defenderTypes = getSpeciesTypes(defender.speciesId);
  const effectiveness = getEffectiveness(move.type, defenderTypes as unknown as import('../data/types.ts').Type[]);
  damage = Math.floor(damage * effectiveness);

  return damage;
}

/**
 * Choose an AI action for a trainer's active Pokemon.
 */
export function chooseAiAction(state: BattleState): BattleAction {
  const ai = state.enemy.trainerData?.ai ?? 'basic';
  const active = state.enemy.pokemon;
  const playerActive = state.player.pokemon;

  // Gym Leaders/Elite Four: use healing items when HP < 25%
  if ((ai === 'gym-leader' || ai === 'elite') && state.enemy.isTrainer) {
    const hpPercent = active.pokemon.hp / active.pokemon.maxHp;
    if (hpPercent < 0.25 && hpPercent > 0) {
      // Use Full Restore (item id 14) if available
      // In Gen 1, gym leaders have fixed item usage, simplified here
      return { type: 'item', itemId: 14 };
    }
  }

  // Score each available move
  const moveScores: { index: number; score: number }[] = [];

  for (let i = 0; i < active.pokemon.moves.length; i++) {
    const pm = active.pokemon.moves[i]!;
    if (pm.pp <= 0) continue;

    // Skip disabled moves
    if (active.disabledMove === pm.moveId) continue;

    const moveData = getMoveData(pm.moveId);
    if (!moveData) continue;

    let score: number;

    if (moveData.power && moveData.power > 0) {
      // Damaging move: score based on estimated damage
      score = estimateDamage(active.pokemon, playerActive.pokemon, moveData);

      // Weight by effectiveness
      const defenderTypes = getSpeciesTypes(playerActive.pokemon.speciesId);
      const eff = getEffectiveness(moveData.type, defenderTypes as unknown as import('../data/types.ts').Type[]);
      if (eff >= 2) score *= 2;
      else if (eff < 1 && eff > 0) score *= 0.5;
      else if (eff === 0) score = 0;

      // OHKO moves: high weight if target is slower
      if (moveData.effect === 'ohko') {
        if (active.pokemon.speed > playerActive.pokemon.speed) {
          score = playerActive.pokemon.hp * 1.5;
        } else {
          score = 0; // Always miss if target is faster
        }
      }

      // Prefer finishing moves when player HP is low
      if (playerActive.pokemon.hp < score) {
        score *= 1.5;
      }
    } else {
      // Status move scoring
      score = scoreStatusMove(moveData, active, playerActive, ai);
    }

    // Add randomness (+-20%)
    const randomFactor = 0.8 + rand() * 0.4;
    score *= randomFactor;

    moveScores.push({ index: i, score });
  }

  // If no valid moves, use Struggle (index 0 as fallback)
  if (moveScores.length === 0) {
    return { type: 'fight', moveIndex: 0 };
  }

  // Smart/Gym Leader/Elite AI: pick highest scoring move
  // Basic AI: still weighted toward best but more random
  if (ai === 'basic') {
    // Basic AI: pick randomly among top 2 moves
    moveScores.sort((a, b) => b.score - a.score);
    const topMoves = moveScores.slice(0, Math.min(2, moveScores.length));
    const chosen = topMoves[Math.floor(rand() * topMoves.length)]!;
    return { type: 'fight', moveIndex: chosen.index };
  }

  // Smart/Gym Leader/Elite: pick the best
  moveScores.sort((a, b) => b.score - a.score);
  return { type: 'fight', moveIndex: moveScores[0]!.index };
}

/**
 * Score a status/non-damaging move for AI decision making.
 */
function scoreStatusMove(
  move: MoveData,
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  ai: string
): number {
  const effect = move.effect;

  // Don't use status moves if target already has a status
  if (['burn', 'freeze', 'paralyze', 'poison', 'bad-poison', 'sleep'].includes(effect)) {
    if (defender.pokemon.status !== 'none') return 0;
    // Status moves have base value
    if (effect === 'sleep') return 80;
    if (effect === 'paralyze') return 70;
    if (effect === 'bad-poison') return 65;
    if (effect === 'burn') return 60;
    if (effect === 'poison') return 50;
    if (effect === 'freeze') return 75;
  }

  // Stat-boosting moves (self)
  if (effect.includes('up')) {
    // Diminishing returns on repeated boosts
    const isAttackBuff = effect.includes('atk');
    const isDefenseBuff = effect.includes('def');
    const isSpeedBuff = effect.includes('spd');
    const isSpecialBuff = effect.includes('spc');

    let currentStage = 0;
    if (isAttackBuff) currentStage = attacker.statStages.attack;
    else if (isDefenseBuff) currentStage = attacker.statStages.defense;
    else if (isSpeedBuff) currentStage = attacker.statStages.speed;
    else if (isSpecialBuff) currentStage = attacker.statStages.special;

    if (currentStage >= 4) return 5; // Diminishing returns
    if (ai === 'basic') return 30; // Basic AI undervalues setup
    return 50 - currentStage * 10;
  }

  // Stat-lowering moves (target)
  if (effect.includes('down')) {
    if (ai === 'basic') return 25;
    return 40;
  }

  // Recovery moves
  if (effect === 'recover-50' || effect === 'rest') {
    const hpPercent = attacker.pokemon.hp / attacker.pokemon.maxHp;
    if (hpPercent < 0.4) return 80;
    if (hpPercent < 0.6) return 40;
    return 5;
  }

  // Splash
  if (effect === 'splash') return 0;

  // Default low score for other status moves
  return 20;
}

/**
 * Choose whether the AI should switch Pokemon.
 * Returns -1 if no switch, or the party index to switch to.
 */
export function shouldAiSwitch(state: BattleState): number {
  const ai = state.enemy.trainerData?.ai ?? 'basic';

  // Basic AI never switches voluntarily
  if (ai === 'basic') return -1;

  // Smart AI: switch if current Pokemon is at a type disadvantage
  // and has a better option available
  const active = state.enemy.pokemon.pokemon;
  const playerTypes = getSpeciesTypes(state.player.pokemon.pokemon.speciesId);

  // Check if current Pokemon's moves are effective
  let bestDamage = 0;
  for (const pm of active.moves) {
    const moveData = getMoveData(pm.moveId);
    if (moveData?.power) {
      const dmg = estimateDamage(active, state.player.pokemon.pokemon, moveData);
      if (dmg > bestDamage) bestDamage = dmg;
    }
  }

  // If we can do reasonable damage, don't switch
  if (bestDamage > state.player.pokemon.pokemon.hp * 0.3) return -1;

  // Look for a better Pokemon
  let bestIndex = -1;
  let bestScore = bestDamage;

  for (let i = 0; i < state.enemy.party.length; i++) {
    const candidate = state.enemy.party[i]!;
    if (candidate.hp <= 0) continue;
    if (candidate === active) continue;

    // Estimate the best damage this candidate could do
    let candidateBest = 0;
    for (const pm of candidate.moves) {
      const moveData = getMoveData(pm.moveId);
      if (moveData?.power) {
        const dmg = estimateDamage(candidate, state.player.pokemon.pokemon, moveData);
        if (dmg > candidateBest) candidateBest = dmg;
      }
    }

    if (candidateBest > bestScore * 1.5) {
      bestScore = candidateBest;
      bestIndex = i;
    }
  }

  return bestIndex;
}
