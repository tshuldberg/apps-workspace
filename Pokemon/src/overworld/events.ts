import type { Direction, GameMap, Pokemon, NpcData, ItemBall, SignData } from '../data/game-types.ts';
import type { MapEngine } from './map-engine.ts';
import { COLLISION } from './map-engine.ts';
import type { NpcManager, NpcInstance, TrainerInstance } from './npc.ts';
import type { Player } from './player.ts';

// Badge indices for HM requirements
const HM_BADGE_REQUIREMENTS: Record<string, number> = {
  cut: 1,       // Cascade Badge
  fly: 2,       // Thunder Badge
  surf: 4,      // Soul Badge
  strength: 3,  // Rainbow Badge
  flash: 0,     // Boulder Badge
};

export type InteractionResult =
  | { type: 'dialogue'; text: string[]; npc?: NpcInstance }
  | { type: 'item'; itemId: number; quantity: number; flag: string }
  | { type: 'heal' }
  | { type: 'shop'; inventory: { itemId: number; price: number }[] }
  | { type: 'pc' }
  | { type: 'battle'; trainerId: string; trainer: TrainerInstance }
  | { type: 'sign'; text: string };

const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export class EventSystem {
  private flags: Record<string, boolean>;
  private badges: boolean[];
  private party: Pokemon[];

  constructor(flags: Record<string, boolean>, badges: boolean[], party: Pokemon[]) {
    this.flags = flags;
    this.badges = badges;
    this.party = party;
  }

  getFlag(key: string): boolean {
    return !!this.flags[key];
  }

  setFlag(key: string, value = true): void {
    this.flags[key] = value;
  }

  getFlags(): Record<string, boolean> {
    return this.flags;
  }

  interact(
    playerX: number,
    playerY: number,
    facing: Direction,
    mapEngine: MapEngine,
    npcManager: NpcManager,
  ): InteractionResult | null {
    const delta = DIRECTION_DELTA[facing];
    const targetX = playerX + delta.dx;
    const targetY = playerY + delta.dy;
    const map = mapEngine.map;
    if (!map) return null;

    // Priority 1: NPC interaction
    const npc = npcManager.getNpcAt(targetX, targetY);
    if (npc) {
      // Face the player
      npc.facing = this.oppositeDirection(facing);
      return { type: 'dialogue', text: npc.data.dialogue, npc };
    }

    // Priority 2: Trainer interaction (standing next to a trainer)
    const trainer = npcManager.getTrainerAt(targetX, targetY);
    if (trainer && !trainer.defeated) {
      return { type: 'battle', trainerId: trainer.data.trainerId, trainer };
    }
    if (trainer && trainer.defeated) {
      // Defeated trainers have post-battle dialogue
      return { type: 'dialogue', text: ['...'] };
    }

    // Priority 3: Sign
    const sign = this.findSign(map, targetX, targetY);
    if (sign) {
      return { type: 'sign', text: sign.text };
    }

    // Priority 4: Item ball
    const item = this.findItem(map, targetX, targetY);
    if (item && !this.getFlag(item.flag)) {
      return { type: 'item', itemId: item.itemId, quantity: item.quantity, flag: item.flag };
    }

    // Priority 5: Check tile-based interactions (healing desk, PC, etc.)
    const tile = mapEngine.getTile(targetX, targetY);
    return this.checkTileInteraction(tile);
  }

  private findSign(map: GameMap, x: number, y: number): SignData | null {
    return map.signs.find(s => s.x === x && s.y === y) ?? null;
  }

  private findItem(map: GameMap, x: number, y: number): ItemBall | null {
    return map.itemBalls.find(i => i.x === x && i.y === y) ?? null;
  }

  private checkTileInteraction(tileId: number): InteractionResult | null {
    // These tile IDs will be defined in the map data
    // For now, use placeholder ranges:
    // Tile 13 = healing desk, Tile 14 = PC, Tile 15 = mart counter
    switch (tileId) {
      case 13:
        return { type: 'heal' };
      case 14:
        return { type: 'pc' };
      case 15:
        return { type: 'shop', inventory: [] };
      default:
        return null;
    }
  }

  private oppositeDirection(dir: Direction): Direction {
    switch (dir) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'left': return 'right';
      case 'right': return 'left';
    }
  }

  healParty(): void {
    for (const pkmn of this.party) {
      pkmn.hp = pkmn.maxHp;
      pkmn.status = 'none';
      pkmn.statusTurns = 0;
      for (const move of pkmn.moves) {
        move.pp = move.maxPp;
      }
    }
  }

  canUseHM(hm: 'cut' | 'fly' | 'surf' | 'strength' | 'flash'): boolean {
    const requiredBadge = HM_BADGE_REQUIREMENTS[hm];
    if (requiredBadge === undefined) return false;
    if (!this.badges[requiredBadge]) return false;

    // Check if any party Pokemon knows the HM move
    // HM move IDs: Cut=15, Fly=19, Surf=57, Strength=70, Flash=148
    const hmMoveIds: Record<string, number> = {
      cut: 15,
      fly: 19,
      surf: 57,
      strength: 70,
      flash: 148,
    };

    const moveId = hmMoveIds[hm];
    if (moveId === undefined) return false;

    return this.party.some(p =>
      p.hp > 0 && p.moves.some(m => m.moveId === moveId)
    );
  }

  useCut(x: number, y: number, facing: Direction, mapEngine: MapEngine): boolean {
    if (!this.canUseHM('cut')) return false;

    const delta = DIRECTION_DELTA[facing];
    const targetX = x + delta.dx;
    const targetY = y + delta.dy;

    if (mapEngine.getCollision(targetX, targetY) === COLLISION.CUT_TREE) {
      mapEngine.removeCutTree(targetX, targetY);
      return true;
    }
    return false;
  }

  useStrength(x: number, y: number, facing: Direction, mapEngine: MapEngine): boolean {
    if (!this.canUseHM('strength')) return false;

    const delta = DIRECTION_DELTA[facing];
    const boulderX = x + delta.dx;
    const boulderY = y + delta.dy;

    if (mapEngine.getCollision(boulderX, boulderY) !== COLLISION.BOULDER) return false;

    // Check if the tile behind the boulder is walkable
    const pushX = boulderX + delta.dx;
    const pushY = boulderY + delta.dy;
    const pushCollision = mapEngine.getCollision(pushX, pushY);

    if (pushCollision !== COLLISION.WALKABLE && pushCollision !== COLLISION.TALL_GRASS) return false;

    // Move boulder
    mapEngine.setDynamicCollision(boulderX, boulderY, COLLISION.WALKABLE);
    mapEngine.setDynamicCollision(pushX, pushY, COLLISION.BOULDER);
    return true;
  }

  useSurf(player: Player, facing: Direction, mapEngine: MapEngine): boolean {
    if (!this.canUseHM('surf')) return false;
    if (player.isSurfing) return false;

    const delta = DIRECTION_DELTA[facing];
    const targetX = player.x + delta.dx;
    const targetY = player.y + delta.dy;

    if (mapEngine.getCollision(targetX, targetY) === COLLISION.WATER) {
      player.startSurf();
      return true;
    }
    return false;
  }

  useFlash(): boolean {
    if (!this.canUseHM('flash')) return false;
    this.setFlag('flash_active');
    return true;
  }
}
