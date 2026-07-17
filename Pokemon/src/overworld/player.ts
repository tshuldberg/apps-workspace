import { TILE_SIZE, WALK_SPEED, PALETTE } from '../constants.ts';
import { isDown, isPressed } from '../input.ts';
import type { Direction } from '../data/game-types.ts';
import type { MapEngine } from './map-engine.ts';
import type { NpcManager } from './npc.ts';

const CYCLE_SPEED = WALK_SPEED * 2;
const LEDGE_JUMP_TILES = 2;

const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const KEY_TO_DIRECTION: { key: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'; dir: Direction }[] = [
  { key: 'UP', dir: 'up' },
  { key: 'DOWN', dir: 'down' },
  { key: 'LEFT', dir: 'left' },
  { key: 'RIGHT', dir: 'right' },
];

export class Player {
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  facing: Direction;
  isMoving = false;
  moveProgress = 0;
  isSurfing = false;
  isCycling = false;
  stepCount = 0;
  repelSteps = 0;
  private ledgeJumping = false;
  private ledgeJumpTarget = 0;
  private walkFrame = 0;
  private walkAnimTimer = 0;
  private justTurned = false;

  constructor(x: number, y: number, facing: Direction) {
    this.x = x;
    this.y = y;
    this.pixelX = x * TILE_SIZE;
    this.pixelY = y * TILE_SIZE;
    this.facing = facing;
  }

  get currentSpeed(): number {
    return this.isCycling ? CYCLE_SPEED : WALK_SPEED;
  }

  update(mapEngine: MapEngine, npcManager?: NpcManager): void {
    if (this.isMoving) {
      this.advanceMovement();
      return;
    }

    // Check for direction input
    const pressedDir = this.getPressedDirection();
    if (!pressedDir) {
      this.justTurned = false;
      return;
    }

    if (this.facing !== pressedDir) {
      // Turn to face direction first
      this.facing = pressedDir;
      this.justTurned = true;
      return;
    }

    // If we just turned this frame, don't move yet
    if (this.justTurned) {
      this.justTurned = false;
      // But if they're still holding the key, try to move
    }

    // Attempt movement in facing direction
    const delta = DIRECTION_DELTA[this.facing];
    const targetX = this.x + delta.dx;
    const targetY = this.y + delta.dy;

    // Check ledge jump
    if (this.facing === 'down' && mapEngine.getCollision(targetX, targetY) === 3) {
      this.startLedgeJump(mapEngine, npcManager);
      return;
    }

    if (this.canMove(delta.dx, delta.dy, mapEngine, npcManager)) {
      this.startMovement(targetX, targetY);
    }
  }

  private getPressedDirection(): Direction | null {
    for (const { key, dir } of KEY_TO_DIRECTION) {
      if (isDown(key)) return dir;
    }
    return null;
  }

  private startMovement(targetX: number, targetY: number): void {
    this.isMoving = true;
    this.moveProgress = 0;
    this.x = targetX;
    this.y = targetY;
  }

  private startLedgeJump(mapEngine: MapEngine, npcManager?: NpcManager): void {
    // Jump over the ledge tile to the tile below it
    const landY = this.y + LEDGE_JUMP_TILES;
    // Check if landing tile is walkable
    if (landY >= (mapEngine.map?.height ?? 0)) return;
    const landCollision = mapEngine.getCollision(this.x, landY);
    if (landCollision !== 0 && landCollision !== 4) return;

    // Check NPC at landing
    if (npcManager?.getNpcAt(this.x, landY)) return;

    this.isMoving = true;
    this.ledgeJumping = true;
    this.moveProgress = 0;
    this.ledgeJumpTarget = TILE_SIZE * LEDGE_JUMP_TILES;
    this.x = this.x;
    this.y = landY;
  }

  private advanceMovement(): void {
    const speed = this.currentSpeed;
    const totalDistance = this.ledgeJumping ? this.ledgeJumpTarget : TILE_SIZE;

    this.moveProgress += speed;

    // Update pixel position based on facing direction
    const delta = DIRECTION_DELTA[this.facing];
    const targetPixelX = this.x * TILE_SIZE;
    const targetPixelY = this.y * TILE_SIZE;
    const startPixelX = targetPixelX - delta.dx * totalDistance;
    const startPixelY = targetPixelY - delta.dy * totalDistance;

    const progress = Math.min(this.moveProgress / totalDistance, 1);
    this.pixelX = startPixelX + (targetPixelX - startPixelX) * progress;
    this.pixelY = startPixelY + (targetPixelY - startPixelY) * progress;

    // Walk animation
    this.walkAnimTimer++;
    if (this.walkAnimTimer >= 4) {
      this.walkAnimTimer = 0;
      this.walkFrame = (this.walkFrame + 1) % 4;
    }

    if (this.moveProgress >= totalDistance) {
      // Movement complete
      this.pixelX = targetPixelX;
      this.pixelY = targetPixelY;
      this.isMoving = false;
      this.moveProgress = 0;
      this.ledgeJumping = false;
      this.stepCount++;

      if (this.repelSteps > 0) {
        this.repelSteps--;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    const screenX = this.pixelX - cameraX;
    const screenY = this.pixelY - cameraY;

    // Ledge jump: apply vertical bounce
    let offsetY = 0;
    if (this.ledgeJumping) {
      const progress = this.moveProgress / this.ledgeJumpTarget;
      offsetY = -Math.sin(progress * Math.PI) * 6;
    }

    // Surfing: draw water under player
    if (this.isSurfing) {
      ctx.fillStyle = '#3890F8';
      ctx.fillRect(screenX - 1, screenY + 8 + offsetY, TILE_SIZE + 2, TILE_SIZE - 6);
    }

    // Player body (placeholder colored rectangle)
    ctx.fillStyle = this.isSurfing ? '#D04040' : this.isCycling ? '#4040D0' : '#D04040';
    ctx.fillRect(screenX + 2, screenY + offsetY, TILE_SIZE - 4, TILE_SIZE);

    // Direction indicator (face)
    ctx.fillStyle = PALETTE.WHITE;
    const faceSize = 4;
    switch (this.facing) {
      case 'down':
        ctx.fillRect(screenX + 4, screenY + 2 + offsetY, faceSize, faceSize);
        ctx.fillRect(screenX + 8, screenY + 2 + offsetY, faceSize, faceSize);
        break;
      case 'up':
        // No face visible from behind
        ctx.fillStyle = PALETTE.DARK;
        ctx.fillRect(screenX + 3, screenY + 1 + offsetY, TILE_SIZE - 6, 5);
        break;
      case 'left':
        ctx.fillRect(screenX + 2, screenY + 2 + offsetY, faceSize, faceSize);
        break;
      case 'right':
        ctx.fillRect(screenX + TILE_SIZE - 6, screenY + 2 + offsetY, faceSize, faceSize);
        break;
    }

    // Walk animation: alternate legs
    if (this.isMoving && this.walkFrame % 2 === 1) {
      ctx.fillStyle = PALETTE.DARK;
      ctx.fillRect(screenX + 3, screenY + TILE_SIZE - 3 + offsetY, 3, 3);
    }
  }

  canMove(dx: number, dy: number, mapEngine: MapEngine, npcManager?: NpcManager): boolean {
    const targetX = this.x + dx;
    const targetY = this.y + dy;

    // Check map boundaries (connections are handled separately)
    const map = mapEngine.map;
    if (map) {
      if (targetX < 0 || targetY < 0 || targetX >= map.width || targetY >= map.height) {
        // Check for map connections
        const connection = mapEngine.getConnection(targetX, targetY);
        return connection !== null;
      }
    }

    // Check collision
    if (!mapEngine.isWalkable(targetX, targetY, this.isSurfing)) {
      return false;
    }

    // Check NPC blocking
    if (npcManager?.getNpcAt(targetX, targetY)) {
      return false;
    }

    return true;
  }

  startSurf(): void {
    this.isSurfing = true;
    this.isCycling = false;
  }

  stopSurf(): void {
    this.isSurfing = false;
  }

  startCycling(): void {
    this.isCycling = true;
    this.isSurfing = false;
  }

  stopCycling(): void {
    this.isCycling = false;
  }
}
