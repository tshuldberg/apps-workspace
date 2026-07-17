// === Gen 1 Move Effect Execution ===

import type { MoveEffect, MoveData, VolatileStatus, StatusCondition } from '../data/game-types.ts';
import type { ActiveBattlePokemon, BattleState, BattleEvent, MoveEffectResult } from './engine.ts';
import { isSpecialType, getEffectiveness } from '../data/types.ts';
import { applyStatStage } from './stats.ts';
import { randInt, rand, pick } from '../utils/random.ts';

const NO_RESULT: MoveEffectResult = { messages: [], events: [], skipDamage: false, skipAccuracy: false };

/**
 * Execute a move's effect. Called twice per move:
 * - Before damage (damage=0): handles charge moves, accuracy bypass, pure-effect moves
 * - After damage (damage>0): handles recoil, drain, stat changes, status application
 */
export function executeMoveEffect(
  effect: MoveEffect,
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  move: MoveData,
  damage: number,
  battleState: BattleState
): MoveEffectResult {
  switch (effect) {
    case 'none':
      return NO_RESULT;

    // === Status Effects (applied 100% when effect is the move's primary) ===
    case 'burn':
      return damage > 0 ? applyStatus(defender, 'burn') : NO_RESULT;
    case 'freeze':
      return damage > 0 ? applyStatus(defender, 'freeze') : NO_RESULT;
    case 'paralyze':
      return damage > 0 ? applyStatus(defender, 'paralyze') : NO_RESULT;
    case 'poison':
      return damage > 0 ? applyStatus(defender, 'poison') : NO_RESULT;
    case 'bad-poison':
      return damage > 0 ? applyBadPoison(defender) : NO_RESULT;
    case 'sleep':
      if (damage > 0) return NO_RESULT;
      return applySleep(defender);
    case 'confusion':
      if (damage > 0) return NO_RESULT;
      return applyConfusion(defender);

    // === Stat Changes (self) ===
    case 'atk-up-1':
      return damage === 0 ? changeStatSelf(attacker, 'attack', 1) : NO_RESULT;
    case 'atk-up-2':
      return damage === 0 ? changeStatSelf(attacker, 'attack', 2) : NO_RESULT;
    case 'def-up-1':
      return damage === 0 ? changeStatSelf(attacker, 'defense', 1) : NO_RESULT;
    case 'def-up-2':
      return damage === 0 ? changeStatSelf(attacker, 'defense', 2) : NO_RESULT;
    case 'spd-up-2':
      return damage === 0 ? changeStatSelf(attacker, 'speed', 2) : NO_RESULT;
    case 'spc-up-1':
      return damage === 0 ? changeStatSelf(attacker, 'special', 1) : NO_RESULT;
    case 'spc-up-2':
      return damage === 0 ? changeStatSelf(attacker, 'special', 2) : NO_RESULT;
    case 'eva-up-1':
      return damage === 0 ? changeStatSelf(attacker, 'evasion', 1) : NO_RESULT;

    // === Stat Changes (target) ===
    case 'atk-down-1':
      return damage === 0 ? changeStatTarget(defender, 'attack', -1) : NO_RESULT;
    case 'def-down-1':
      return damage === 0 ? changeStatTarget(defender, 'defense', -1) : NO_RESULT;
    case 'def-down-2':
      return damage === 0 ? changeStatTarget(defender, 'defense', -2) : NO_RESULT;
    case 'spd-down-1':
      return damage === 0 ? changeStatTarget(defender, 'speed', -1) : NO_RESULT;
    case 'spc-down-1':
      return damage === 0 ? changeStatTarget(defender, 'special', -1) : NO_RESULT;
    case 'acc-down-1':
      return damage === 0 ? changeStatTarget(defender, 'accuracy', -1) : NO_RESULT;

    // === Multi-Hit ===
    case 'multi-hit-2':
      return damage === 0 ? { messages: [], events: [], skipDamage: false, skipAccuracy: false } : NO_RESULT;
    case 'multi-hit-2-5':
      return damage === 0 ? { messages: [], events: [], skipDamage: false, skipAccuracy: false } : NO_RESULT;

    // === Recoil ===
    case 'recoil-25':
      return damage > 0 ? applyRecoil(attacker, damage, 4) : NO_RESULT;
    case 'recoil-33':
      return damage > 0 ? applyRecoil(attacker, damage, 3) : NO_RESULT;

    // === Drain ===
    case 'drain-50':
      return damage > 0 ? applyDrain(attacker, damage) : NO_RESULT;
    case 'dream-eater':
      if (damage > 0 && defender.pokemon.status === 'sleep') {
        return applyDrain(attacker, damage);
      }
      if (damage === 0 && defender.pokemon.status !== 'sleep') {
        return { messages: ['It failed!'], events: [], skipDamage: true, skipAccuracy: true };
      }
      return NO_RESULT;

    // === OHKO ===
    case 'ohko':
      if (damage === 0) {
        // OHKO moves deal damage equal to target's HP
        return {
          messages: ["It's a one-hit KO!"],
          events: [],
          skipDamage: true,
          skipAccuracy: false,
        };
      }
      return NO_RESULT;

    // === Fixed Damage ===
    case 'fixed-20':
      return handleFixedDamage(defender, 20);
    case 'fixed-40':
      return handleFixedDamage(defender, 40);
    case 'level-damage':
      return handleFixedDamage(defender, attacker.pokemon.level);
    case 'psywave':
      return handleFixedDamage(defender, Math.max(1, randInt(1, Math.floor(attacker.pokemon.level * 1.5))));

    // === Charge / Semi-Invulnerable ===
    case 'charge':
      return handleCharge(attacker, move);
    case 'semi-invulnerable':
      return handleSemiInvulnerable(attacker, move);

    // === Recharge ===
    case 'recharge':
      return NO_RESULT; // Recharge is handled in engine.ts after damage

    // === Binding ===
    case 'binding':
      return damage > 0 ? applyBinding(defender) : NO_RESULT;

    // === Self-Destruct / Explosion ===
    case 'self-destruct':
      if (damage === 0) {
        // User faints
        attacker.pokemon.hp = 0;
        return {
          messages: [],
          events: [],
          skipDamage: false,
          skipAccuracy: false,
        };
      }
      return NO_RESULT;

    // === Recovery ===
    case 'recover-50':
      return handleRecover(attacker);
    case 'rest':
      return handleRest(attacker);

    // === Bide ===
    case 'bide':
      return handleBide(attacker, defender, battleState);

    // === Counter ===
    case 'counter':
      return handleCounter(attacker, defender, battleState);

    // === Rage ===
    case 'rage':
      if (damage === 0) {
        attacker.volatile.add('raging');
        return NO_RESULT;
      }
      return NO_RESULT;

    // === Thrash / Petal Dance ===
    case 'thrash':
      return handleThrash(attacker);

    // === Disable ===
    case 'disable':
      return handleDisable(defender);

    // === Substitute ===
    case 'substitute':
      return handleSubstitute(attacker);

    // === Mimic ===
    case 'mimic':
      return handleMimic(attacker, defender);

    // === Metronome ===
    case 'metronome':
      return handleMetronome(attacker, defender, battleState);

    // === Mirror Move ===
    case 'mirror-move':
      return handleMirrorMove(attacker, defender, battleState);

    // === Transform ===
    case 'transform':
      return handleTransform(attacker, defender);

    // === Haze ===
    case 'haze':
      return handleHaze(attacker, defender);

    // === Mist ===
    case 'mist':
      attacker.volatile.add('mist');
      return { messages: [`${attacker.pokemon.nickname} is shrouded in mist!`], events: [], skipDamage: true, skipAccuracy: true };

    // === Reflect ===
    case 'reflect':
      if (attacker.volatile.has('reflect')) {
        return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
      }
      attacker.volatile.add('reflect');
      return { messages: [`${attacker.pokemon.nickname} gained armor!`], events: [], skipDamage: true, skipAccuracy: true };

    // === Light Screen ===
    case 'light-screen':
      if (attacker.volatile.has('light-screen')) {
        return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
      }
      attacker.volatile.add('light-screen');
      return { messages: [`${attacker.pokemon.nickname}'s special defense rose!`], events: [], skipDamage: true, skipAccuracy: true };

    // === Focus Energy (Gen 1 BUG: divides crit rate by 4) ===
    case 'focus-energy':
      attacker.volatile.add('focus-energy');
      return { messages: [`${attacker.pokemon.nickname} is getting pumped!`], events: [], skipDamage: true, skipAccuracy: true };

    // === Leech Seed ===
    case 'leech-seed':
      return handleLeechSeed(defender);

    // === Conversion ===
    case 'conversion':
      return handleConversion(attacker, defender);

    // === Swift (always hits) ===
    case 'swift':
      return { messages: [], events: [], skipDamage: false, skipAccuracy: true };

    // === Pay Day ===
    case 'pay-day':
      if (damage > 0) {
        const coins = attacker.pokemon.level * 2;
        battleState.payDayMoney += coins;
        return { messages: ['Coins scattered everywhere!'], events: [], skipDamage: false, skipAccuracy: false };
      }
      return NO_RESULT;

    // === Tri Attack (no special effect in Gen 1) ===
    case 'tri-attack':
      return NO_RESULT;

    // === Super Fang ===
    case 'super-fang':
      return handleSuperFang(defender);

    // === Splash ===
    case 'splash':
      return { messages: ['But nothing happened!'], events: [], skipDamage: true, skipAccuracy: true };

    // === Teleport ===
    case 'teleport':
      return {
        messages: [],
        events: [{ type: 'battle-end' as const, result: 'flee' as const }],
        skipDamage: true,
        skipAccuracy: true,
      };

    // === Flinch (applied as secondary effect, not primary) ===
    case 'flinch':
      if (damage > 0) {
        defender.volatile.add('flinch');
      }
      return NO_RESULT;

    default:
      return NO_RESULT;
  }
}

// === Helper Functions ===

function applyStatus(target: ActiveBattlePokemon, status: StatusCondition): MoveEffectResult {
  if (target.pokemon.status !== 'none') {
    return { messages: ['But it failed!'], events: [] };
  }
  // Substitute blocks status
  if (target.volatile.has('substitute')) {
    return { messages: ['But it failed!'], events: [] };
  }

  target.pokemon.status = status;

  const statusMessages: Record<string, string> = {
    burn: `${target.pokemon.nickname} was burned!`,
    freeze: `${target.pokemon.nickname} was frozen solid!`,
    paralyze: `${target.pokemon.nickname} was paralyzed! It may be unable to move!`,
    poison: `${target.pokemon.nickname} was poisoned!`,
  };

  return {
    messages: [statusMessages[status] ?? `${target.pokemon.nickname} was afflicted with ${status}!`],
    events: [{ type: 'status', side: 'enemy', status }],
  };
}

function applyBadPoison(target: ActiveBattlePokemon): MoveEffectResult {
  if (target.pokemon.status !== 'none') {
    return { messages: ['But it failed!'], events: [] };
  }
  if (target.volatile.has('substitute')) {
    return { messages: ['But it failed!'], events: [] };
  }

  target.pokemon.status = 'bad-poison';
  target.toxicCounter = 0;

  return {
    messages: [`${target.pokemon.nickname} was badly poisoned!`],
    events: [{ type: 'status', side: 'enemy', status: 'bad-poison' }],
  };
}

function applySleep(target: ActiveBattlePokemon): MoveEffectResult {
  if (target.pokemon.status !== 'none') {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: false };
  }
  if (target.volatile.has('substitute')) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: false };
  }

  target.pokemon.status = 'sleep';
  target.sleepTurns = randInt(1, 7); // Gen 1: 1-7 turns
  target.pokemon.statusTurns = target.sleepTurns;

  return {
    messages: [`${target.pokemon.nickname} fell asleep!`],
    events: [{ type: 'status', side: 'enemy', status: 'sleep' }],
    skipDamage: true,
    skipAccuracy: false,
  };
}

function applyConfusion(target: ActiveBattlePokemon): MoveEffectResult {
  if (target.volatile.has('confusion')) {
    return { messages: [`${target.pokemon.nickname} is already confused!`], events: [], skipDamage: true, skipAccuracy: false };
  }
  if (target.volatile.has('substitute')) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: false };
  }

  target.volatile.add('confusion');
  target.confusionTurns = randInt(2, 5);

  return {
    messages: [`${target.pokemon.nickname} became confused!`],
    events: [],
    skipDamage: true,
    skipAccuracy: false,
  };
}

function changeStatSelf(
  pokemon: ActiveBattlePokemon,
  stat: keyof ActiveBattlePokemon['statStages'],
  stages: number
): MoveEffectResult {
  const current = pokemon.statStages[stat];
  const clamped = Math.max(-6, Math.min(6, current + stages));

  if (clamped === current) {
    const direction = stages > 0 ? "won't go any higher!" : "won't go any lower!";
    return { messages: [`${pokemon.pokemon.nickname}'s ${stat} ${direction}`], events: [], skipDamage: true, skipAccuracy: true };
  }

  pokemon.statStages[stat] = clamped;
  const actualChange = clamped - current;
  const direction = actualChange > 0
    ? (actualChange >= 2 ? 'rose sharply!' : 'rose!')
    : (actualChange <= -2 ? 'harshly fell!' : 'fell!');

  return {
    messages: [`${pokemon.pokemon.nickname}'s ${stat} ${direction}`],
    events: [{ type: 'stat-change', side: 'player', stat, stages: actualChange }],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function changeStatTarget(
  pokemon: ActiveBattlePokemon,
  stat: keyof ActiveBattlePokemon['statStages'],
  stages: number
): MoveEffectResult {
  // Mist blocks stat reductions
  if (stages < 0 && pokemon.volatile.has('mist')) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: false };
  }
  // Substitute blocks stat reductions
  if (stages < 0 && pokemon.volatile.has('substitute')) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: false };
  }

  const current = pokemon.statStages[stat];
  const clamped = Math.max(-6, Math.min(6, current + stages));

  if (clamped === current) {
    const direction = stages > 0 ? "won't go any higher!" : "won't go any lower!";
    return { messages: [`${pokemon.pokemon.nickname}'s ${stat} ${direction}`], events: [], skipDamage: true, skipAccuracy: false };
  }

  pokemon.statStages[stat] = clamped;
  const actualChange = clamped - current;
  const direction = actualChange > 0
    ? (actualChange >= 2 ? 'rose sharply!' : 'rose!')
    : (actualChange <= -2 ? 'harshly fell!' : 'fell!');

  return {
    messages: [`${pokemon.pokemon.nickname}'s ${stat} ${direction}`],
    events: [{ type: 'stat-change', side: 'enemy', stat, stages: actualChange }],
    skipDamage: true,
    skipAccuracy: false,
  };
}

function applyRecoil(attacker: ActiveBattlePokemon, damage: number, divisor: number): MoveEffectResult {
  const recoil = Math.max(1, Math.floor(damage / divisor));
  attacker.pokemon.hp = Math.max(0, attacker.pokemon.hp - recoil);

  return {
    messages: [`${attacker.pokemon.nickname} is hit with recoil!`],
    events: [{ type: 'damage', side: 'player', amount: recoil, remaining: attacker.pokemon.hp }],
  };
}

function applyDrain(attacker: ActiveBattlePokemon, damage: number): MoveEffectResult {
  const healed = Math.max(1, Math.floor(damage / 2));
  const actualHeal = Math.min(healed, attacker.pokemon.maxHp - attacker.pokemon.hp);
  attacker.pokemon.hp += actualHeal;

  return {
    messages: [`${attacker.pokemon.nickname} drained energy!`],
    events: actualHeal > 0 ? [{ type: 'heal', side: 'player', amount: actualHeal }] : [],
  };
}

function handleFixedDamage(defender: ActiveBattlePokemon, damage: number): MoveEffectResult {
  // Substitute absorbs
  if (defender.volatile.has('substitute') && defender.substituteHp > 0) {
    defender.substituteHp -= damage;
    if (defender.substituteHp <= 0) {
      defender.volatile.delete('substitute');
      defender.substituteHp = 0;
      return {
        messages: ['The substitute broke!'],
        events: [{ type: 'damage', side: 'enemy', amount: damage, remaining: defender.pokemon.hp }],
        skipDamage: true,
        skipAccuracy: false,
      };
    }
    return {
      messages: [],
      events: [{ type: 'damage', side: 'enemy', amount: damage, remaining: defender.pokemon.hp }],
      skipDamage: true,
      skipAccuracy: false,
    };
  }

  defender.pokemon.hp = Math.max(0, defender.pokemon.hp - damage);
  return {
    messages: [],
    events: [{ type: 'damage', side: 'enemy', amount: damage, remaining: defender.pokemon.hp }],
    skipDamage: true,
    skipAccuracy: false,
  };
}

function handleCharge(attacker: ActiveBattlePokemon, move: MoveData): MoveEffectResult {
  if (attacker.volatile.has('charging')) {
    // Second turn: execute the attack
    attacker.volatile.delete('charging');
    return { messages: [], events: [], skipDamage: false, skipAccuracy: false };
  }

  // First turn: charge up
  attacker.volatile.add('charging');
  const chargeMessages: Record<string, string> = {
    'Solar Beam': `${attacker.pokemon.nickname} took in sunlight!`,
    'Skull Bash': `${attacker.pokemon.nickname} lowered its head!`,
    'Sky Attack': `${attacker.pokemon.nickname} is glowing!`,
    'Razor Wind': `${attacker.pokemon.nickname} made a whirlwind!`,
  };

  return {
    messages: [chargeMessages[move.name] ?? `${attacker.pokemon.nickname} is charging up!`],
    events: [],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleSemiInvulnerable(attacker: ActiveBattlePokemon, move: MoveData): MoveEffectResult {
  if (attacker.volatile.has('semi-invulnerable')) {
    // Second turn: attack and become hittable
    attacker.volatile.delete('semi-invulnerable');
    attacker.volatile.delete('charging');
    return { messages: [], events: [], skipDamage: false, skipAccuracy: false };
  }

  // First turn: become invulnerable
  attacker.volatile.add('semi-invulnerable');
  attacker.volatile.add('charging');

  if (move.name === 'Fly') {
    return { messages: [`${attacker.pokemon.nickname} flew up high!`], events: [], skipDamage: true, skipAccuracy: true };
  } else {
    return { messages: [`${attacker.pokemon.nickname} dug a hole!`], events: [], skipDamage: true, skipAccuracy: true };
  }
}

function applyBinding(defender: ActiveBattlePokemon): MoveEffectResult {
  defender.volatile.add('bound');
  // 2-5 turns: 37.5%, 37.5%, 12.5%, 12.5%
  const turns = pickMultiHitCount();
  defender.bindingTurns = turns;

  return {
    messages: [`${defender.pokemon.nickname} was trapped!`],
    events: [],
  };
}

function handleRecover(attacker: ActiveBattlePokemon): MoveEffectResult {
  const healAmount = Math.floor(attacker.pokemon.maxHp / 2);
  const actualHeal = Math.min(healAmount, attacker.pokemon.maxHp - attacker.pokemon.hp);

  if (actualHeal === 0) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  attacker.pokemon.hp += actualHeal;
  return {
    messages: [`${attacker.pokemon.nickname} recovered health!`],
    events: [{ type: 'heal', side: 'player', amount: actualHeal }],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleRest(attacker: ActiveBattlePokemon): MoveEffectResult {
  if (attacker.pokemon.hp === attacker.pokemon.maxHp) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  const healed = attacker.pokemon.maxHp - attacker.pokemon.hp;
  attacker.pokemon.hp = attacker.pokemon.maxHp;
  attacker.pokemon.status = 'sleep';
  attacker.sleepTurns = 2;
  attacker.pokemon.statusTurns = 2;

  return {
    messages: [`${attacker.pokemon.nickname} went to sleep and became healthy!`],
    events: [
      { type: 'heal', side: 'player', amount: healed },
      { type: 'status', side: 'player', status: 'sleep' },
    ],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleBide(
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  state: BattleState
): MoveEffectResult {
  if (attacker.volatile.has('biding')) {
    attacker.bideTurns--;
    if (attacker.bideTurns <= 0) {
      // Unleash stored damage
      attacker.volatile.delete('biding');
      const damage = attacker.bideDamage * 2;
      attacker.bideDamage = 0;

      if (damage === 0) {
        return { messages: [`${attacker.pokemon.nickname} unleashed energy!`, 'But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
      }

      defender.pokemon.hp = Math.max(0, defender.pokemon.hp - damage);
      return {
        messages: [`${attacker.pokemon.nickname} unleashed energy!`],
        events: [{ type: 'damage', side: 'enemy', amount: damage, remaining: defender.pokemon.hp }],
        skipDamage: true,
        skipAccuracy: true,
      };
    }

    return { messages: [`${attacker.pokemon.nickname} is storing energy!`], events: [], skipDamage: true, skipAccuracy: true };
  }

  // Start bide
  attacker.volatile.add('biding');
  attacker.bideTurns = randInt(2, 3);
  attacker.bideDamage = 0;

  return { messages: [`${attacker.pokemon.nickname} is storing energy!`], events: [], skipDamage: true, skipAccuracy: true };
}

function handleCounter(
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  state: BattleState
): MoveEffectResult {
  // Counter deals 2x the last Physical damage received
  // In Gen 1, Counter works against Normal and Fighting type moves
  if (!state.lastMoveUsed) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  const lastMove = getMoveDataById(state.lastMoveUsed.moveId);
  if (!lastMove || !lastMove.power) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  // Gen 1: Counter only works against Normal and Fighting type moves
  if (isSpecialType(lastMove.type)) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  // Deal 2x the last damage received (simplified: estimate based on move power)
  // In practice, the engine should track last damage taken
  const counterDamage = attacker.bideDamage > 0 ? attacker.bideDamage * 2 : 1;
  defender.pokemon.hp = Math.max(0, defender.pokemon.hp - counterDamage);

  return {
    messages: [],
    events: [{ type: 'damage', side: 'enemy', amount: counterDamage, remaining: defender.pokemon.hp }],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleThrash(attacker: ActiveBattlePokemon): MoveEffectResult {
  if (!attacker.volatile.has('thrashing')) {
    // Start thrashing for 2-3 turns
    attacker.volatile.add('thrashing');
    attacker.bindingTurns = randInt(2, 3); // Reuse bindingTurns for thrash counter
    return { messages: [], events: [], skipDamage: false, skipAccuracy: false };
  }

  attacker.bindingTurns--;
  if (attacker.bindingTurns <= 0) {
    // Thrash ends, become confused
    attacker.volatile.delete('thrashing');
    attacker.volatile.add('confusion');
    attacker.confusionTurns = randInt(2, 5);
    return {
      messages: [`${attacker.pokemon.nickname} became confused due to fatigue!`],
      events: [],
      skipDamage: false,
      skipAccuracy: false,
    };
  }

  return { messages: [], events: [], skipDamage: false, skipAccuracy: false };
}

function handleDisable(defender: ActiveBattlePokemon): MoveEffectResult {
  if (defender.lastMoveUsed === null || defender.disabledMove !== null) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: false };
  }

  defender.disabledMove = defender.lastMoveUsed;
  defender.disabledTurns = randInt(1, 8);
  defender.volatile.add('disabled');

  const moveName = getMoveNameById(defender.lastMoveUsed);
  return {
    messages: [`${defender.pokemon.nickname}'s ${moveName} was disabled!`],
    events: [],
    skipDamage: true,
    skipAccuracy: false,
  };
}

function handleSubstitute(attacker: ActiveBattlePokemon): MoveEffectResult {
  if (attacker.volatile.has('substitute')) {
    return { messages: [`${attacker.pokemon.nickname} already has a substitute!`], events: [], skipDamage: true, skipAccuracy: true };
  }

  const cost = Math.floor(attacker.pokemon.maxHp / 4);
  if (attacker.pokemon.hp <= cost) {
    return { messages: ['But it does not have enough HP left to make a substitute!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  attacker.pokemon.hp -= cost;
  attacker.volatile.add('substitute');
  attacker.substituteHp = cost;

  return {
    messages: [`${attacker.pokemon.nickname} made a substitute!`],
    events: [{ type: 'damage', side: 'player', amount: cost, remaining: attacker.pokemon.hp }],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleMimic(attacker: ActiveBattlePokemon, defender: ActiveBattlePokemon): MoveEffectResult {
  if (defender.pokemon.moves.length === 0) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  // Copy a random move from the target
  const targetMove = pick(defender.pokemon.moves);
  const mimicSlot = attacker.pokemon.moves.find(m => {
    const md = getMoveDataById(m.moveId);
    return md?.effect === 'mimic';
  });

  if (mimicSlot) {
    const oldMoveId = mimicSlot.moveId;
    mimicSlot.moveId = targetMove.moveId;
    mimicSlot.pp = 5; // Mimic gives 5 PP
    mimicSlot.maxPp = 5;

    const moveName = getMoveNameById(targetMove.moveId);
    return {
      messages: [`${attacker.pokemon.nickname} learned ${moveName}!`],
      events: [],
      skipDamage: true,
      skipAccuracy: true,
    };
  }

  return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
}

function handleMetronome(
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  state: BattleState
): MoveEffectResult {
  // Metronome randomly selects any move except itself and a few banned moves
  const bannedEffects: MoveEffect[] = ['metronome', 'mimic', 'mirror-move', 'counter', 'bide', 'teleport'];

  // Get all available moves
  let allMoves: import('../data/game-types.ts').MoveData[] = [];
  try {
    const { MOVES } = require('../data/moves.ts') as { MOVES: Record<number, import('../data/game-types.ts').MoveData> };
    allMoves = Object.values(MOVES).filter(m => !bannedEffects.includes(m.effect));
  } catch {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  if (allMoves.length === 0) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  const chosenMove = pick(allMoves);
  return {
    messages: [`Metronome became ${chosenMove.name}!`],
    events: [],
    skipDamage: false,
    skipAccuracy: false,
  };
}

function handleMirrorMove(
  attacker: ActiveBattlePokemon,
  defender: ActiveBattlePokemon,
  state: BattleState
): MoveEffectResult {
  if (!state.lastMoveUsed || state.lastMoveUsed.side === 'player') {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  const lastMove = getMoveDataById(state.lastMoveUsed.moveId);
  if (!lastMove) {
    return { messages: ['But it failed!'], events: [], skipDamage: true, skipAccuracy: true };
  }

  return {
    messages: [`Mirror Move became ${lastMove.name}!`],
    events: [],
    skipDamage: false,
    skipAccuracy: false,
  };
}

function handleTransform(attacker: ActiveBattlePokemon, defender: ActiveBattlePokemon): MoveEffectResult {
  // Copy target's species, types, stats, moves (but not HP)
  attacker.pokemon.speciesId = defender.pokemon.speciesId;
  attacker.pokemon.attack = defender.pokemon.attack;
  attacker.pokemon.defense = defender.pokemon.defense;
  attacker.pokemon.speed = defender.pokemon.speed;
  attacker.pokemon.special = defender.pokemon.special;

  // Copy stat stages
  attacker.statStages = { ...defender.statStages };

  // Copy moves with 5 PP each
  attacker.pokemon.moves = defender.pokemon.moves.map(m => ({
    moveId: m.moveId,
    pp: 5,
    maxPp: 5,
  }));

  attacker.volatile.add('transformed');

  return {
    messages: [`${attacker.pokemon.nickname} transformed into ${defender.pokemon.nickname}!`],
    events: [],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleHaze(attacker: ActiveBattlePokemon, defender: ActiveBattlePokemon): MoveEffectResult {
  // Reset all stat stages for both sides
  attacker.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
  defender.statStages = { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };

  // Cure all status conditions (Gen 1 Haze bug — resets everything)
  attacker.pokemon.status = 'none';
  attacker.pokemon.statusTurns = 0;
  defender.pokemon.status = 'none';
  defender.pokemon.statusTurns = 0;

  // Clear volatile statuses
  attacker.volatile.clear();
  defender.volatile.clear();
  attacker.confusionTurns = 0;
  defender.confusionTurns = 0;
  attacker.toxicCounter = 0;
  defender.toxicCounter = 0;

  return {
    messages: ['All stat changes were eliminated!'],
    events: [],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleLeechSeed(defender: ActiveBattlePokemon): MoveEffectResult {
  // Can't seed grass types
  try {
    const { POKEMON } = require('../data/pokemon.ts') as { POKEMON: Record<number, import('../data/game-types.ts').PokemonSpecies> };
    const species = POKEMON[defender.pokemon.speciesId];
    if (species?.types.includes('Grass' as any)) {
      return { messages: ["It doesn't affect the opposing Pokemon..."], events: [], skipDamage: true, skipAccuracy: false };
    }
  } catch {
    // proceed
  }

  if (defender.volatile.has('seeded')) {
    return { messages: [`${defender.pokemon.nickname} is already seeded!`], events: [], skipDamage: true, skipAccuracy: false };
  }

  defender.volatile.add('seeded');
  return {
    messages: [`${defender.pokemon.nickname} was seeded!`],
    events: [],
    skipDamage: true,
    skipAccuracy: false,
  };
}

function handleConversion(attacker: ActiveBattlePokemon, defender: ActiveBattlePokemon): MoveEffectResult {
  // Change user's type to match one of target's types
  // Since we can't change types on the Pokemon struct directly (types are on species),
  // this is handled via the transform mechanism
  return {
    messages: [`${attacker.pokemon.nickname} changed its type!`],
    events: [],
    skipDamage: true,
    skipAccuracy: true,
  };
}

function handleSuperFang(defender: ActiveBattlePokemon): MoveEffectResult {
  const damage = Math.max(1, Math.floor(defender.pokemon.hp / 2));

  if (defender.volatile.has('substitute') && defender.substituteHp > 0) {
    defender.substituteHp -= damage;
    if (defender.substituteHp <= 0) {
      defender.volatile.delete('substitute');
      defender.substituteHp = 0;
      return {
        messages: ['The substitute broke!'],
        events: [{ type: 'damage', side: 'enemy', amount: damage, remaining: defender.pokemon.hp }],
        skipDamage: true,
        skipAccuracy: false,
      };
    }
  } else {
    defender.pokemon.hp = Math.max(0, defender.pokemon.hp - damage);
  }

  return {
    messages: [],
    events: [{ type: 'damage', side: 'enemy', amount: damage, remaining: defender.pokemon.hp }],
    skipDamage: true,
    skipAccuracy: false,
  };
}

// === Utility ===

/** Pick multi-hit count: 2-5 with distribution 37.5%, 37.5%, 12.5%, 12.5% */
function pickMultiHitCount(): number {
  const r = rand();
  if (r < 0.375) return 2;
  if (r < 0.75) return 3;
  if (r < 0.875) return 4;
  return 5;
}

function getMoveDataById(moveId: number): MoveData | null {
  try {
    const { MOVES } = require('../data/moves.ts') as { MOVES: Record<number, MoveData> };
    return MOVES[moveId] ?? null;
  } catch {
    return null;
  }
}

function getMoveNameById(moveId: number): string {
  const moveData = getMoveDataById(moveId);
  return moveData?.name ?? `Move #${moveId}`;
}
