import { TILE_SIZE, WALK_SPEED, PALETTE } from '../constants.ts';
import type { Direction, NpcData, TrainerPlacement } from '../data/game-types.ts';
import type { MapEngine } from './map-engine.ts';
import { randInt } from '../utils/random.ts';

const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const WANDER_INTERVAL = 120; // frames between wander attempts
const WANDER_CHANCE = 25;    // percent chance to move each interval
const ALL_DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export interface NpcInstance {
  data: NpcData;
  x: number;
  y: number;
  facing: Direction;
  isMoving: boolean;
  pixelX: number;
  pixelY: number;
  moveProgress: number;
  moveTimer: number;
  targetX: number;
  targetY: number;
}

export interface TrainerInstance {
  data: TrainerPlacement;
  x: number;
  y: number;
  facing: Direction;
  isMoving: boolean;
  pixelX: number;
  pixelY: number;
  moveProgress: number;
  defeated: boolean;
  approachTarget: { x: number; y: number } | null;
}

export class NpcManager {
  private npcs: NpcInstance[] = [];
  private trainers: TrainerInstance[] = [];
  private mapEngine: MapEngine | null = null;
  private eventFlags: Record<string, boolean> = {};

  loadNpcs(mapNpcs: NpcData[], mapEngine: MapEngine): void {
    this.mapEngine = mapEngine;
    this.npcs = mapNpcs.map(data => ({
      data,
      x: data.x,
      y: data.y,
      facing: data.facing,
      isMoving: false,
      pixelX: data.x * TILE_SIZE,
      pixelY: data.y * TILE_SIZE,
      moveProgress: 0,
      moveTimer: randInt(0, WANDER_INTERVAL), // Stagger wander timers
      targetX: data.x,
      targetY: data.y,
    }));
  }

  loadTrainers(placements: TrainerPlacement[], mapEngine: MapEngine, flags: Record<string, boolean>): void {
    this.mapEngine = mapEngine;
    this.eventFlags = flags;
    this.trainers = placements.map(data => ({
      data,
      x: data.x,
      y: data.y,
      facing: data.facing,
      isMoving: false,
      pixelX: data.x * TILE_SIZE,
      pixelY: data.y * TILE_SIZE,
      moveProgress: 0,
      defeated: !!flags[data.flag],
      approachTarget: null,
    }));
  }

  update(): void {
    for (const npc of this.npcs) {
      if (npc.isMoving) {
        this.advanceNpcMovement(npc);
        continue;
      }

      if (npc.data.movement === 'wander') {
        npc.moveTimer++;
        if (npc.moveTimer >= WANDER_INTERVAL) {
          npc.moveTimer = 0;
          if (randInt(1, 100) <= WANDER_CHANCE) {
            this.tryWanderNpc(npc);
          }
        }
      }
    }

    // Update approaching trainers
    for (const trainer of this.trainers) {
      if (trainer.isMoving && trainer.approachTarget) {
        this.advanceTrainerApproach(trainer);
      }
    }
  }

  private tryWanderNpc(npc: NpcInstance): void {
    if (!this.mapEngine) return;

    const dir = ALL_DIRECTIONS[randInt(0, 3)]!;
    const delta = DIRECTION_DELTA[dir];
    const targetX = npc.x + delta.dx;
    const targetY = npc.y + delta.dy;

    npc.facing = dir;

    // Check if target is walkable and not occupied
    if (!this.mapEngine.isWalkable(targetX, targetY, false)) return;
    if (this.getNpcAt(targetX, targetY)) return;

    npc.isMoving = true;
    npc.moveProgress = 0;
    npc.targetX = targetX;
    npc.targetY = targetY;
  }

  private advanceNpcMovement(npc: NpcInstance): void {
    npc.moveProgress += WALK_SPEED;

    const targetPixelX = npc.targetX * TILE_SIZE;
    const targetPixelY = npc.targetY * TILE_SIZE;
    const startPixelX = npc.x * TILE_SIZE;
    const startPixelY = npc.y * TILE_SIZE;

    // We haven't updated npc.x/y yet so we can interpolate from current to target
    const progress = Math.min(npc.moveProgress / TILE_SIZE, 1);
    npc.pixelX = startPixelX + (targetPixelX - startPixelX) * progress;
    npc.pixelY = startPixelY + (targetPixelY - startPixelY) * progress;

    if (npc.moveProgress >= TILE_SIZE) {
      npc.x = npc.targetX;
      npc.y = npc.targetY;
      npc.pixelX = targetPixelX;
      npc.pixelY = targetPixelY;
      npc.isMoving = false;
      npc.moveProgress = 0;
    }
  }

  private advanceTrainerApproach(trainer: TrainerInstance): void {
    trainer.moveProgress += WALK_SPEED;

    const delta = DIRECTION_DELTA[trainer.facing];
    const targetPixelX = (trainer.x + delta.dx) * TILE_SIZE;
    const targetPixelY = (trainer.y + delta.dy) * TILE_SIZE;
    const startPixelX = trainer.x * TILE_SIZE;
    const startPixelY = trainer.y * TILE_SIZE;

    const progress = Math.min(trainer.moveProgress / TILE_SIZE, 1);
    trainer.pixelX = startPixelX + (targetPixelX - startPixelX) * progress;
    trainer.pixelY = startPixelY + (targetPixelY - startPixelY) * progress;

    if (trainer.moveProgress >= TILE_SIZE) {
      trainer.x += delta.dx;
      trainer.y += delta.dy;
      trainer.pixelX = trainer.x * TILE_SIZE;
      trainer.pixelY = trainer.y * TILE_SIZE;
      trainer.moveProgress = 0;

      // Check if reached approach target
      if (trainer.approachTarget &&
          trainer.x === trainer.approachTarget.x &&
          trainer.y === trainer.approachTarget.y) {
        trainer.isMoving = false;
        trainer.approachTarget = null;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    // Render NPCs
    for (const npc of this.npcs) {
      const screenX = npc.pixelX - cameraX;
      const screenY = npc.pixelY - cameraY;

      // Cull off-screen
      if (screenX < -TILE_SIZE || screenX > 160 || screenY < -TILE_SIZE || screenY > 144) continue;

      // NPC body (blue rectangle)
      ctx.fillStyle = '#4060D0';
      ctx.fillRect(screenX + 2, screenY, TILE_SIZE - 4, TILE_SIZE);

      // Direction indicator
      ctx.fillStyle = PALETTE.WHITE;
      this.renderFace(ctx, screenX, screenY, npc.facing);
    }

    // Render trainers
    for (const trainer of this.trainers) {
      if (trainer.defeated) {
        // Still render defeated trainers but with different color
        this.renderTrainer(ctx, trainer, cameraX, cameraY, '#808060');
      } else {
        this.renderTrainer(ctx, trainer, cameraX, cameraY, '#D08020');
      }
    }
  }

  private renderTrainer(
    ctx: CanvasRenderingContext2D,
    trainer: TrainerInstance,
    cameraX: number,
    cameraY: number,
    color: string,
  ): void {
    const screenX = trainer.pixelX - cameraX;
    const screenY = trainer.pixelY - cameraY;

    if (screenX < -TILE_SIZE || screenX > 160 || screenY < -TILE_SIZE || screenY > 144) return;

    ctx.fillStyle = color;
    ctx.fillRect(screenX + 2, screenY, TILE_SIZE - 4, TILE_SIZE);

    ctx.fillStyle = PALETTE.WHITE;
    this.renderFace(ctx, screenX, screenY, trainer.facing);

    // Exclamation mark for undefeated trainers
    if (!trainer.defeated) {
      ctx.fillStyle = '#D04040';
      ctx.fillRect(screenX + 6, screenY - 4, 4, 3);
    }
  }

  private renderFace(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, facing: Direction): void {
    switch (facing) {
      case 'down':
        ctx.fillRect(screenX + 4, screenY + 2, 3, 3);
        ctx.fillRect(screenX + 9, screenY + 2, 3, 3);
        break;
      case 'up':
        break;
      case 'left':
        ctx.fillRect(screenX + 2, screenY + 2, 3, 3);
        break;
      case 'right':
        ctx.fillRect(screenX + TILE_SIZE - 5, screenY + 2, 3, 3);
        break;
    }
  }

  getNpcAt(x: number, y: number): NpcInstance | null {
    // Check regular NPCs
    for (const npc of this.npcs) {
      if (npc.x === x && npc.y === y) return npc;
      // Also block target tile during movement
      if (npc.isMoving && npc.targetX === x && npc.targetY === y) return npc;
    }
    return null;
  }

  getTrainerAt(x: number, y: number): TrainerInstance | null {
    for (const trainer of this.trainers) {
      if (trainer.x === x && trainer.y === y) return trainer;
    }
    return null;
  }

  /** Check if any undefeated trainer can see the player */
  checkTrainerSight(playerX: number, playerY: number): TrainerInstance | null {
    for (const trainer of this.trainers) {
      if (trainer.defeated) continue;
      if (trainer.isMoving) continue;

      const delta = DIRECTION_DELTA[trainer.facing];
      for (let i = 1; i <= trainer.data.sightRange; i++) {
        const checkX = trainer.x + delta.dx * i;
        const checkY = trainer.y + delta.dy * i;

        // Check if something blocks line of sight
        if (this.mapEngine) {
          const collision = this.mapEngine.getCollision(checkX, checkY);
          if (collision === 1 || collision === 7) break; // Solid or cut-tree blocks sight
        }

        // Check if an NPC is blocking line of sight
        if (this.getNpcAt(checkX, checkY)) break;

        if (checkX === playerX && checkY === playerY) {
          return trainer;
        }
      }
    }
    return null;
  }

  /** Start a trainer approaching the player. Returns tiles to walk. */
  startTrainerApproach(trainer: TrainerInstance, playerX: number, playerY: number): void {
    const delta = DIRECTION_DELTA[trainer.facing];
    // Walk to one tile away from the player
    const targetX = playerX - delta.dx;
    const targetY = playerY - delta.dy;

    trainer.approachTarget = { x: targetX, y: targetY };
    trainer.isMoving = true;
    trainer.moveProgress = 0;
  }

  /** Mark a trainer as defeated */
  defeatTrainer(trainer: TrainerInstance): void {
    trainer.defeated = true;
  }

  /** Check if a tile is blocked by any NPC or trainer */
  isTileBlocked(x: number, y: number): boolean {
    if (this.getNpcAt(x, y)) return true;
    if (this.getTrainerAt(x, y)) return true;
    return false;
  }
}
