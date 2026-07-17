// === Gen 1 Battle Engine Core ===

import type { Pokemon, MoveData, TrainerData, VolatileStatus, StatusCondition } from '../data/game-types.ts';
import { ACCURACY_STAGE_MULTIPLIERS } from '../constants.ts';
import { randInt, rand } from '../utils/random.ts';
import { calculateDamage } from './damage.ts';
import { executeMoveEffect } from './move-effects.ts';
import { chooseAiAction } from './ai.ts';

// === Types ===

export interface StatStages {
  attack: number;
  defense: number;
  speed: number;
  special: number;
  accuracy: number;
  evasion: number;
}

export interface ActiveBattlePokemon {
  pokemon: Pokemon;
  statStages: StatStages;
  volatile: Set<VolatileStatus>;
  substituteHp: number;
  bindingTurns: number;
  confusionTurns: number;
  sleepTurns: number;
  disabledMove: number | null;
  disabledTurns: number;
  lastMoveUsed: number | null;
  bideDamage: number;
  bideTurns: number;
  toxicCounter: number;
}

export interface BattleSide {
  pokemon: ActiveBattlePokemon;
  party: Pokemon[];
  isTrainer: boolean;
  trainerData?: TrainerData;
}

export interface BattleState {
  player: BattleSide;
  enemy: BattleSide;
  isWild: boolean;
  turnCount: number;
  lastMoveUsed: { side: 'player' | 'enemy'; moveId: number } | null;
  payDayMoney: number;
  battleLog: string[];
}

export type BattleAction =
  | { type: 'fight'; moveIndex: number }
  | { type: 'switch'; partyIndex: number }
  | { type: 'item'; itemId: number; targetIndex?: number }
  | { type: 'run' }
  | { type: 'catch'; ballId: number };

export type BattleEvent =
  | { type: 'message'; text: string }
  | { type: 'damage'; side: 'player' | 'enemy'; amount: number; remaining: number }
  | { type: 'heal'; side: 'player' | 'enemy'; amount: number }
  | { type: 'status'; side: 'player' | 'enemy'; status: StatusCondition }
  | { type: 'stat-change'; side: 'player' | 'enemy'; stat: string; stages: number }
  | { type: 'faint'; side: 'player' | 'enemy' }
  | { type: 'switch'; side: 'player' | 'enemy'; pokemonIndex: number }
  | { type: 'catch-attempt'; wobbles: number; caught: boolean }
  | { type: 'exp-gain'; amount: number; levelUp: boolean; newLevel?: number; newMoves?: number[] }
  | { type: 'miss' }
  | { type: 'critical' }
  | { type: 'effectiveness'; level: 'immune' | 'not-very-effective' | 'super-effective' }
  | { type: 'battle-end'; result: 'win' | 'lose' | 'flee' | 'caught' };

export interface MoveEffectResult {
  messages: string[];
  events: BattleEvent[];
  skipDamage?: boolean;
  skipAccuracy?: boolean;
}

// === Factory Functions ===

export function createDefaultStages(): StatStages {
  return { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
}

export function createActivePokemon(pokemon: Pokemon): ActiveBattlePokemon {
  return {
    pokemon,
    statStages: createDefaultStages(),
    volatile: new Set(),
    substituteHp: 0,
    bindingTurns: 0,
    confusionTurns: 0,
    sleepTurns: 0,
    disabledMove: null,
    disabledTurns: 0,
    lastMoveUsed: null,
    bideDamage: 0,
    bideTurns: 0,
    toxicCounter: 0,
  };
}

export function initBattleState(
  playerParty: Pokemon[],
  enemyParty: Pokemon[],
  isWild: boolean,
  trainerData?: TrainerData
): BattleState {
  return {
    player: {
      pokemon: createActivePokemon(playerParty[0]!),
      party: playerParty,
      isTrainer: true,
      trainerData: undefined,
    },
    enemy: {
      pokemon: createActivePokemon(enemyParty[0]!),
      party: enemyParty,
      isTrainer: !isWild,
      trainerData,
    },
    isWild,
    turnCount: 0,
    lastMoveUsed: null,
    payDayMoney: 0,
    battleLog: [],
  };
}

// === Move Data Helper ===

function getMoveData(moveId: number): MoveData | null {
  try {
    const { MOVES } = require('../data/moves.ts') as { MOVES: Record<number, MoveData> };
    return MOVES[moveId] ?? null;
  } catch {
    return null;
  }
}

// === Accuracy Check ===

function accuracyCheck(
  move: MoveData,
  attackerStages: StatStages,
  defenderStages: StatStages
): boolean {
  // Moves with null accuracy always hit
  if (move.accuracy === null) return true;

  // Swift always hits
  if (move.effect === 'swift') return true;

  // Apply accuracy and evasion stages
  const accStageIndex = Math.max(0, Math.min(12, attackerStages.accuracy + 6));
  const evaStageIndex = Math.max(0, Math.min(12, defenderStages.evasion + 6));
  const [accNum, accDen] = ACCURACY_STAGE_MULTIPLIERS[accStageIndex]!;
  const [evaNum, evaDen] = ACCURACY_STAGE_MULTIPLIERS[evaStageIndex]!;

  // Modified accuracy = baseAccuracy * (accStage / evaStage)
  // In Gen 1: accuracy stages multiply, evasion stages divide
  let modifiedAccuracy = Math.floor(move.accuracy * accNum / accDen);
  // Evasion inverts: higher evasion stage means harder to hit
  modifiedAccuracy = Math.floor(modifiedAccuracy * evaDen / evaNum);

  // Clamp to 1-255 (Gen 1 uses 1/256 miss glitch: 100% accuracy moves can miss)
  modifiedAccuracy = Math.max(1, Math.min(255, modifiedAccuracy));

  return randInt(0, 255) < modifiedAccuracy;
}

// === Flee Check ===

function canFlee(playerSpeed: number, enemySpeed: number, fleeAttempts: number): boolean {
  // In wild battles, flee chance based on speed comparison
  if (playerSpeed >= enemySpeed) return true;

  const odds = Math.floor(playerSpeed * 128 / Math.max(1, enemySpeed)) + 30 * fleeAttempts;
  return randInt(0, 255) < odds;
}

// === Turn Resolution ===

export function resolveTurn(
  state: BattleState,
  playerAction: BattleAction,
  enemyAction: BattleAction
): BattleEvent[] {
  state.turnCount++;
  const events: BattleEvent[] = [];

  // Determine action order
  const order = determineOrder(state, playerAction, enemyAction);

  for (const { action, side } of order) {
    const actorSide = side === 'player' ? state.player : state.enemy;
    const opponentSide = side === 'player' ? state.enemy : state.player;
    const opponentSideName = side === 'player' ? 'enemy' : 'player';

    // Skip if fainted
    if (actorSide.pokemon.pokemon.hp <= 0) continue;

    const actionEvents = executeAction(state, action, actorSide, opponentSide, side, opponentSideName as 'player' | 'enemy');
    events.push(...actionEvents);

    // Check for faint after each action
    if (opponentSide.pokemon.pokemon.hp <= 0) {
      events.push({ type: 'faint', side: opponentSideName as 'player' | 'enemy' });

      // Check for battle end
      const endEvent = checkBattleEnd(state, opponentSideName as 'player' | 'enemy');
      if (endEvent) {
        events.push(endEvent);
        return events;
      }
    }

    if (actorSide.pokemon.pokemon.hp <= 0) {
      events.push({ type: 'faint', side });

      const endEvent = checkBattleEnd(state, side);
      if (endEvent) {
        events.push(endEvent);
        return events;
      }
    }
  }

  // End-of-turn effects
  const endTurnEvents = applyEndOfTurnEffects(state);
  events.push(...endTurnEvents);

  // Check faints from end-of-turn damage
  for (const sideName of ['player', 'enemy'] as const) {
    const s = sideName === 'player' ? state.player : state.enemy;
    if (s.pokemon.pokemon.hp <= 0) {
      events.push({ type: 'faint', side: sideName });
      const endEvent = checkBattleEnd(state, sideName);
      if (endEvent) {
        events.push(endEvent);
        return events;
      }
    }
  }

  return events;
}

// === Action Order ===

interface OrderEntry {
  action: BattleAction;
  side: 'player' | 'enemy';
}

function determineOrder(
  state: BattleState,
  playerAction: BattleAction,
  enemyAction: BattleAction
): OrderEntry[] {
  // Switches and items always go first (before attacks)
  const playerPriority = getActionPriority(playerAction, state.player);
  const enemyPriority = getActionPriority(enemyAction, state.enemy);

  if (playerPriority !== enemyPriority) {
    if (playerPriority > enemyPriority) {
      return [
        { action: playerAction, side: 'player' },
        { action: enemyAction, side: 'enemy' },
      ];
    } else {
      return [
        { action: enemyAction, side: 'enemy' },
        { action: playerAction, side: 'player' },
      ];
    }
  }

  // Both are fight actions: compare move priority, then speed
  if (playerAction.type === 'fight' && enemyAction.type === 'fight') {
    const playerMove = state.player.pokemon.pokemon.moves[playerAction.moveIndex];
    const enemyMove = state.enemy.pokemon.pokemon.moves[enemyAction.moveIndex];
    const pMoveData = playerMove ? getMoveData(playerMove.moveId) : null;
    const eMoveData = enemyMove ? getMoveData(enemyMove.moveId) : null;

    const pPriority = pMoveData?.priority ?? 0;
    const ePriority = eMoveData?.priority ?? 0;

    if (pPriority !== ePriority) {
      if (pPriority > ePriority) {
        return [
          { action: playerAction, side: 'player' },
          { action: enemyAction, side: 'enemy' },
        ];
      } else {
        return [
          { action: enemyAction, side: 'enemy' },
          { action: playerAction, side: 'player' },
        ];
      }
    }
  }

  // Speed comparison (with speed tie randomization)
  const playerSpeed = state.player.pokemon.pokemon.speed;
  const enemySpeed = state.enemy.pokemon.pokemon.speed;

  if (playerSpeed > enemySpeed || (playerSpeed === enemySpeed && rand() < 0.5)) {
    return [
      { action: playerAction, side: 'player' },
      { action: enemyAction, side: 'enemy' },
    ];
  } else {
    return [
      { action: enemyAction, side: 'enemy' },
      { action: playerAction, side: 'player' },
    ];
  }
}

function getActionPriority(action: BattleAction, side: BattleSide): number {
  switch (action.type) {
    case 'switch': return 6;
    case 'item': return 5;
    case 'catch': return 5;
    case 'run': return 5;
    case 'fight': return 0;
  }
}

// === Execute Action ===

function executeAction(
  state: BattleState,
  action: BattleAction,
  actorSide: BattleSide,
  opponentSide: BattleSide,
  sideName: 'player' | 'enemy',
  opponentSideName: 'player' | 'enemy'
): BattleEvent[] {
  const events: BattleEvent[] = [];

  switch (action.type) {
    case 'fight':
      return executeFightAction(state, actorSide, opponentSide, action.moveIndex, sideName, opponentSideName);

    case 'switch': {
      const newPokemon = actorSide.party[action.partyIndex]!;
      actorSide.pokemon = createActivePokemon(newPokemon);
      events.push({ type: 'switch', side: sideName, pokemonIndex: action.partyIndex });
      events.push({ type: 'message', text: `Go! ${newPokemon.nickname}!` });
      return events;
    }

    case 'item': {
      events.push({ type: 'message', text: `${sideName === 'player' ? 'You' : 'Enemy'} used an item!` });
      // Item effects handled by the game state manager
      return events;
    }

    case 'catch': {
      const { attemptCatch } = require('./catch.ts') as typeof import('./catch.ts');
      const result = attemptCatch(opponentSide.pokemon.pokemon, action.ballId);
      events.push({ type: 'catch-attempt', wobbles: result.wobbles, caught: result.caught });
      if (result.caught) {
        events.push({ type: 'message', text: `Gotcha! ${opponentSide.pokemon.pokemon.nickname} was caught!` });
        events.push({ type: 'battle-end', result: 'caught' });
      } else {
        events.push({ type: 'message', text: 'Oh no! The Pokemon broke free!' });
      }
      return events;
    }

    case 'run': {
      if (state.isWild) {
        if (canFlee(actorSide.pokemon.pokemon.speed, opponentSide.pokemon.pokemon.speed, state.turnCount)) {
          events.push({ type: 'message', text: 'Got away safely!' });
          events.push({ type: 'battle-end', result: 'flee' });
        } else {
          events.push({ type: 'message', text: "Can't escape!" });
        }
      } else {
        events.push({ type: 'message', text: "No! There's no running from a trainer battle!" });
      }
      return events;
    }
  }
}

// === Fight Action ===

function executeFightAction(
  state: BattleState,
  attacker: BattleSide,
  defender: BattleSide,
  moveIndex: number,
  attackerSide: 'player' | 'enemy',
  defenderSide: 'player' | 'enemy'
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const active = attacker.pokemon;
  const target = defender.pokemon;

  // Check if locked into a move (Thrash, Rage, Binding, Bide)
  const lockedMove = getLockedMove(active);
  const moveSlot = lockedMove !== null
    ? active.pokemon.moves.find(m => m.moveId === lockedMove)
    : active.pokemon.moves[moveIndex];

  if (!moveSlot) {
    events.push({ type: 'message', text: `${active.pokemon.nickname} has no moves!` });
    return events;
  }

  const moveData = getMoveData(moveSlot.moveId);
  if (!moveData) {
    events.push({ type: 'message', text: `${active.pokemon.nickname} used an unknown move!` });
    return events;
  }

  // Check disabled
  if (active.disabledMove === moveSlot.moveId) {
    events.push({ type: 'message', text: `${moveData.name} is disabled!` });
    return events;
  }

  // Check PP
  if (moveSlot.pp <= 0 && lockedMove === null) {
    // Use Struggle when no PP remaining
    return executeStruggle(state, attacker, defender, attackerSide, defenderSide);
  }

  // Deduct PP
  if (lockedMove === null) {
    moveSlot.pp--;
  }

  events.push({ type: 'message', text: `${active.pokemon.nickname} used ${moveData.name}!` });
  active.lastMoveUsed = moveSlot.moveId;
  state.lastMoveUsed = { side: attackerSide, moveId: moveSlot.moveId };

  // Check paralysis (25% chance to not move)
  if (active.pokemon.status === 'paralyze' && rand() < 0.25) {
    events.push({ type: 'message', text: `${active.pokemon.nickname} is fully paralyzed!` });
    return events;
  }

  // Check sleep
  if (active.pokemon.status === 'sleep') {
    if (active.sleepTurns <= 0) {
      active.pokemon.status = 'none';
      active.pokemon.statusTurns = 0;
      events.push({ type: 'message', text: `${active.pokemon.nickname} woke up!` });
    } else {
      active.sleepTurns--;
      events.push({ type: 'message', text: `${active.pokemon.nickname} is fast asleep!` });
      return events;
    }
  }

  // Check freeze (20% chance to thaw in Gen 1 — actually 0% in Gen 1, only Fire moves thaw)
  if (active.pokemon.status === 'freeze') {
    // In Gen 1, frozen Pokemon cannot move at all (no natural thaw)
    // They can only be thawed by a Fire-type move hitting them
    events.push({ type: 'message', text: `${active.pokemon.nickname} is frozen solid!` });
    return events;
  }

  // Check confusion
  if (active.volatile.has('confusion')) {
    if (active.confusionTurns <= 0) {
      active.volatile.delete('confusion');
      events.push({ type: 'message', text: `${active.pokemon.nickname} snapped out of confusion!` });
    } else {
      active.confusionTurns--;
      events.push({ type: 'message', text: `${active.pokemon.nickname} is confused!` });
      // 50% chance to hit self
      if (rand() < 0.5) {
        // Self-damage: 40 power typeless attack against self
        const selfDamage = Math.max(1, Math.floor(
          Math.floor(Math.floor(2 * active.pokemon.level / 5 + 2) * 40 * active.pokemon.attack / Math.max(1, active.pokemon.defense)) / 50
        ) + 2);
        active.pokemon.hp = Math.max(0, active.pokemon.hp - selfDamage);
        events.push({ type: 'message', text: 'It hurt itself in its confusion!' });
        events.push({ type: 'damage', side: attackerSide, amount: selfDamage, remaining: active.pokemon.hp });
        return events;
      }
    }
  }

  // Check flinch
  if (active.volatile.has('flinch')) {
    active.volatile.delete('flinch');
    events.push({ type: 'message', text: `${active.pokemon.nickname} flinched!` });
    return events;
  }

  // Check recharge (Hyper Beam)
  if (active.volatile.has('recharging')) {
    active.volatile.delete('recharging');
    events.push({ type: 'message', text: `${active.pokemon.nickname} must recharge!` });
    return events;
  }

  // Execute move effect (handles charge moves, bide, etc.)
  const effectResult = executeMoveEffect(
    moveData.effect,
    active,
    target,
    moveData,
    0, // pre-damage
    state
  );

  if (effectResult.skipDamage && effectResult.skipAccuracy) {
    // Pure effect move (like Splash, Teleport, Haze, etc.)
    events.push(...effectResult.events);
    for (const msg of effectResult.messages) {
      events.push({ type: 'message', text: msg });
    }
    return events;
  }

  // Accuracy check (unless move always hits)
  if (!effectResult.skipAccuracy) {
    // OHKO moves have special accuracy
    if (moveData.effect === 'ohko') {
      if (target.pokemon.speed > active.pokemon.speed) {
        events.push({ type: 'miss' });
        events.push({ type: 'message', text: "It failed!" });
        return events;
      }
      if (randInt(0, 255) >= 76) { // ~30% hit rate
        events.push({ type: 'miss' });
        events.push({ type: 'message', text: `${active.pokemon.nickname}'s attack missed!` });
        return events;
      }
    } else if (moveData.effect !== 'swift' && !accuracyCheck(moveData, active.statStages, target.statStages)) {
      // Check if target is semi-invulnerable (Fly/Dig)
      events.push({ type: 'miss' });
      events.push({ type: 'message', text: `${active.pokemon.nickname}'s attack missed!` });
      return events;
    }

    // Semi-invulnerable check (Fly/Dig) — only Swift can hit
    if (target.volatile.has('semi-invulnerable') && moveData.effect !== 'swift') {
      events.push({ type: 'miss' });
      return events;
    }
  }

  // Calculate damage for damaging moves
  if (moveData.power && moveData.power > 0 && !effectResult.skipDamage) {
    const damageResult = calculateDamage(
      active.pokemon,
      target.pokemon,
      moveData,
      active.statStages,
      target.statStages,
      target.volatile
    );

    if (damageResult.isCritical) {
      events.push({ type: 'critical' });
      events.push({ type: 'message', text: 'A critical hit!' });
    }

    if (damageResult.effectiveness !== 1) {
      if (damageResult.typeMessage === 'immune') {
        events.push({ type: 'effectiveness', level: 'immune' });
        events.push({ type: 'message', text: "It doesn't affect the opposing Pokemon..." });
        return events;
      } else if (damageResult.typeMessage === 'super-effective') {
        events.push({ type: 'effectiveness', level: 'super-effective' });
        events.push({ type: 'message', text: "It's super effective!" });
      } else if (damageResult.typeMessage === 'not-very-effective') {
        events.push({ type: 'effectiveness', level: 'not-very-effective' });
        events.push({ type: 'message', text: "It's not very effective..." });
      }
    }

    // Apply damage to substitute or Pokemon
    let actualDamage = damageResult.damage;
    if (target.volatile.has('substitute') && target.substituteHp > 0) {
      target.substituteHp -= actualDamage;
      if (target.substituteHp <= 0) {
        target.volatile.delete('substitute');
        target.substituteHp = 0;
        events.push({ type: 'message', text: "The substitute broke!" });
      }
      events.push({ type: 'damage', side: defenderSide, amount: actualDamage, remaining: target.pokemon.hp });
    } else {
      target.pokemon.hp = Math.max(0, target.pokemon.hp - actualDamage);
      events.push({ type: 'damage', side: defenderSide, amount: actualDamage, remaining: target.pokemon.hp });

      // Track damage for Bide/Counter
      if (target.volatile.has('biding')) {
        target.bideDamage += actualDamage;
      }
    }

    // Execute post-damage effects (recoil, drain, stat changes by chance, etc.)
    const postEffectResult = executeMoveEffect(
      moveData.effect,
      active,
      target,
      moveData,
      actualDamage,
      state
    );
    events.push(...postEffectResult.events);
    for (const msg of postEffectResult.messages) {
      events.push({ type: 'message', text: msg });
    }

    // Recharge for Hyper Beam (but not if the target fainted in Gen 1)
    if (moveData.effect === 'recharge' && target.pokemon.hp > 0) {
      active.volatile.add('recharging');
    }
  } else {
    // Non-damaging move or effect-only move
    events.push(...effectResult.events);
    for (const msg of effectResult.messages) {
      events.push({ type: 'message', text: msg });
    }
  }

  // Secondary effect chance (e.g., 10% chance to burn)
  if (moveData.effectChance > 0 && moveData.effectChance < 100) {
    if (randInt(1, 100) <= moveData.effectChance) {
      const secondaryResult = applySecondaryEffect(moveData, active, target, attackerSide, defenderSide);
      events.push(...secondaryResult);
    }
  }

  return events;
}

// === Struggle (no PP left) ===

function executeStruggle(
  state: BattleState,
  attacker: BattleSide,
  defender: BattleSide,
  attackerSide: 'player' | 'enemy',
  defenderSide: 'player' | 'enemy'
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const active = attacker.pokemon;
  const target = defender.pokemon;

  events.push({ type: 'message', text: `${active.pokemon.nickname} has no moves left!` });
  events.push({ type: 'message', text: `${active.pokemon.nickname} used Struggle!` });

  // Struggle: 50 power Normal-type move with 25% recoil
  const struggleMove: MoveData = {
    id: 165,
    name: 'Struggle',
    type: 'Normal',
    power: 50,
    accuracy: null, // always hits
    pp: 0,
    effect: 'recoil-25',
    effectChance: 100,
    priority: 0,
    highCrit: false,
  };

  const damageResult = calculateDamage(
    active.pokemon, target.pokemon, struggleMove,
    active.statStages, target.statStages, target.volatile
  );

  target.pokemon.hp = Math.max(0, target.pokemon.hp - damageResult.damage);
  events.push({ type: 'damage', side: defenderSide, amount: damageResult.damage, remaining: target.pokemon.hp });

  // 25% recoil
  const recoil = Math.max(1, Math.floor(damageResult.damage / 4));
  active.pokemon.hp = Math.max(0, active.pokemon.hp - recoil);
  events.push({ type: 'message', text: `${active.pokemon.nickname} is hit with recoil!` });
  events.push({ type: 'damage', side: attackerSide, amount: recoil, remaining: active.pokemon.hp });

  return events;
}

// === Locked Move Check ===

function getLockedMove(active: ActiveBattlePokemon): number | null {
  if (active.volatile.has('raging') && active.lastMoveUsed !== null) {
    return active.lastMoveUsed;
  }
  if (active.volatile.has('thrashing') && active.lastMoveUsed !== null) {
    return active.lastMoveUsed;
  }
  if (active.volatile.has('biding')) {
    return active.lastMoveUsed;
  }
  if (active.volatile.has('charging') && active.lastMoveUsed !== null) {
    return active.lastMoveUsed;
  }
  return null;
}

// === Secondary Effects ===

function applySecondaryEffect(
  move: MoveData,
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  attackerSide: 'player' | 'enemy',
  defenderSide: 'player' | 'enemy'
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = move.effect;

  // Status effects
  if (effect === 'burn' && defender.pokemon.status === 'none') {
    defender.pokemon.status = 'burn';
    events.push({ type: 'status', side: defenderSide, status: 'burn' });
    events.push({ type: 'message', text: `${defender.pokemon.nickname} was burned!` });
  } else if (effect === 'freeze' && defender.pokemon.status === 'none') {
    defender.pokemon.status = 'freeze';
    events.push({ type: 'status', side: defenderSide, status: 'freeze' });
    events.push({ type: 'message', text: `${defender.pokemon.nickname} was frozen solid!` });
  } else if (effect === 'paralyze' && defender.pokemon.status === 'none') {
    defender.pokemon.status = 'paralyze';
    events.push({ type: 'status', side: defenderSide, status: 'paralyze' });
    events.push({ type: 'message', text: `${defender.pokemon.nickname} was paralyzed!` });
  } else if (effect === 'poison' && defender.pokemon.status === 'none') {
    defender.pokemon.status = 'poison';
    events.push({ type: 'status', side: defenderSide, status: 'poison' });
    events.push({ type: 'message', text: `${defender.pokemon.nickname} was poisoned!` });
  } else if (effect === 'confusion' && !defender.volatile.has('confusion')) {
    defender.volatile.add('confusion');
    defender.confusionTurns = randInt(2, 5);
    events.push({ type: 'message', text: `${defender.pokemon.nickname} became confused!` });
  } else if (effect === 'flinch') {
    defender.volatile.add('flinch');
  }

  // Stat changes
  if (effect === 'atk-down-1') {
    defender.statStages.attack = Math.max(-6, defender.statStages.attack - 1);
    events.push({ type: 'stat-change', side: defenderSide, stat: 'attack', stages: -1 });
  } else if (effect === 'def-down-1') {
    defender.statStages.defense = Math.max(-6, defender.statStages.defense - 1);
    events.push({ type: 'stat-change', side: defenderSide, stat: 'defense', stages: -1 });
  } else if (effect === 'spd-down-1') {
    defender.statStages.speed = Math.max(-6, defender.statStages.speed - 1);
    events.push({ type: 'stat-change', side: defenderSide, stat: 'speed', stages: -1 });
  } else if (effect === 'spc-down-1') {
    defender.statStages.special = Math.max(-6, defender.statStages.special - 1);
    events.push({ type: 'stat-change', side: defenderSide, stat: 'special', stages: -1 });
  }

  return events;
}

// === End of Turn Effects ===

function applyEndOfTurnEffects(state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const sideName of ['player', 'enemy'] as const) {
    const side = sideName === 'player' ? state.player : state.enemy;
    const opponentSideName = sideName === 'player' ? 'enemy' : 'player';
    const opponent = sideName === 'player' ? state.enemy : state.player;
    const active = side.pokemon;

    if (active.pokemon.hp <= 0) continue;

    // Poison damage: 1/16 max HP
    if (active.pokemon.status === 'poison') {
      const damage = Math.max(1, Math.floor(active.pokemon.maxHp / 16));
      active.pokemon.hp = Math.max(0, active.pokemon.hp - damage);
      events.push({ type: 'message', text: `${active.pokemon.nickname} is hurt by poison!` });
      events.push({ type: 'damage', side: sideName, amount: damage, remaining: active.pokemon.hp });
    }

    // Toxic damage: increases each turn (1/16, 2/16, 3/16, etc.)
    if (active.pokemon.status === 'bad-poison') {
      active.toxicCounter++;
      const damage = Math.max(1, Math.floor(active.pokemon.maxHp * active.toxicCounter / 16));
      active.pokemon.hp = Math.max(0, active.pokemon.hp - damage);
      events.push({ type: 'message', text: `${active.pokemon.nickname} is hurt by poison!` });
      events.push({ type: 'damage', side: sideName, amount: damage, remaining: active.pokemon.hp });
    }

    // Burn damage: 1/16 max HP (also halves attack, applied in damage calc)
    if (active.pokemon.status === 'burn') {
      const damage = Math.max(1, Math.floor(active.pokemon.maxHp / 16));
      active.pokemon.hp = Math.max(0, active.pokemon.hp - damage);
      events.push({ type: 'message', text: `${active.pokemon.nickname} is hurt by its burn!` });
      events.push({ type: 'damage', side: sideName, amount: damage, remaining: active.pokemon.hp });
    }

    // Leech Seed: drain 1/16 max HP, heal opponent
    if (active.volatile.has('seeded') && active.pokemon.hp > 0) {
      const drain = Math.max(1, Math.floor(active.pokemon.maxHp / 16));
      active.pokemon.hp = Math.max(0, active.pokemon.hp - drain);
      events.push({ type: 'message', text: `${active.pokemon.nickname}'s health is sapped by Leech Seed!` });
      events.push({ type: 'damage', side: sideName, amount: drain, remaining: active.pokemon.hp });

      // Heal opponent
      if (opponent.pokemon.pokemon.hp > 0) {
        const healed = Math.min(drain, opponent.pokemon.pokemon.maxHp - opponent.pokemon.pokemon.hp);
        opponent.pokemon.pokemon.hp += healed;
        if (healed > 0) {
          events.push({ type: 'heal', side: opponentSideName as 'player' | 'enemy', amount: healed });
        }
      }
    }

    // Binding damage: 1/16 max HP per turn
    if (active.volatile.has('bound') && active.bindingTurns > 0) {
      active.bindingTurns--;
      const damage = Math.max(1, Math.floor(active.pokemon.maxHp / 16));
      active.pokemon.hp = Math.max(0, active.pokemon.hp - damage);
      events.push({ type: 'message', text: `${active.pokemon.nickname} is hurt by being bound!` });
      events.push({ type: 'damage', side: sideName, amount: damage, remaining: active.pokemon.hp });

      if (active.bindingTurns <= 0) {
        active.volatile.delete('bound');
        events.push({ type: 'message', text: `${active.pokemon.nickname} was freed from the binding!` });
      }
    }

    // Disabled move countdown
    if (active.disabledMove !== null) {
      active.disabledTurns--;
      if (active.disabledTurns <= 0) {
        active.disabledMove = null;
        events.push({ type: 'message', text: `${active.pokemon.nickname}'s move is no longer disabled!` });
      }
    }

    // Clear flinch at end of turn
    active.volatile.delete('flinch');
  }

  return events;
}

// === Battle End Check ===

function checkBattleEnd(state: BattleState, faintedSide: 'player' | 'enemy'): BattleEvent | null {
  const side = faintedSide === 'player' ? state.player : state.enemy;

  // Check if all Pokemon on the fainted side are knocked out
  const allFainted = side.party.every(p => p.hp <= 0);
  if (allFainted) {
    return {
      type: 'battle-end',
      result: faintedSide === 'player' ? 'lose' : 'win',
    };
  }

  return null;
}
