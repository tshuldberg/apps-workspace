// === Evolution Animation Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawTextCentered } from '../rendering/text.ts';
import { drawWindow } from '../rendering/menu-ui.ts';
import { getPokemonFrontSprite } from '../rendering/sprites.ts';
import { playSfx, playMusic, stopMusic } from '../audio.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { Pokemon } from '../data/game-types.ts';

type EvoPhase = 'text-start' | 'animating' | 'cancelled' | 'evolved' | 'text-end';

export class EvolutionScene implements Scene {
  private pokemon: Pokemon;
  private targetSpeciesId: number;
  private phase: EvoPhase = 'text-start';
  private frame = 0;
  private flashTimer = 0;
  private showOld = true;
  private flashSpeed = 20; // frames between flashes, decreases over time
  private cancelled = false;
  private onComplete: ((evolved: boolean) => void) | null;

  constructor(
    pokemon: Pokemon,
    targetSpeciesId: number,
    onComplete?: (evolved: boolean) => void,
  ) {
    this.pokemon = pokemon;
    this.targetSpeciesId = targetSpeciesId;
    this.onComplete = onComplete ?? null;
  }

  enter(): void {
    playMusic('evolution');
  }

  exit(): void {
    stopMusic();
  }

  update(): void {
    this.frame++;

    switch (this.phase) {
      case 'text-start':
        if (this.frame > 60) {
          this.phase = 'animating';
          this.frame = 0;
          this.flashTimer = 0;
        }
        break;

      case 'animating':
        // B to cancel
        if (isPressed('B')) {
          this.cancelled = true;
          this.phase = 'cancelled';
          this.frame = 0;
          playSfx('menu-back');
          break;
        }

        this.flashTimer++;
        // Flash speed increases over time
        this.flashSpeed = Math.max(3, 20 - Math.floor(this.frame / 30));

        if (this.flashTimer >= this.flashSpeed) {
          this.flashTimer = 0;
          this.showOld = !this.showOld;
        }

        // After 180 frames (~3 seconds), evolution completes
        if (this.frame >= 180) {
          this.phase = 'evolved';
          this.frame = 0;
          playSfx('level-up');
        }
        break;

      case 'cancelled':
        if (this.frame > 30) {
          if (isPressed('A') || isPressed('B')) {
            if (this.onComplete) this.onComplete(false);
            SceneManager.pop();
          }
        }
        break;

      case 'evolved':
        if (this.frame > 30) {
          this.pokemon.speciesId = this.targetSpeciesId;
          this.phase = 'text-end';
          this.frame = 0;
        }
        break;

      case 'text-end':
        if (isPressed('A') || isPressed('B')) {
          if (this.onComplete) this.onComplete(true);
          SceneManager.pop();
        }
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Dark background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    const spriteX = (NATIVE_WIDTH - 56) / 2;
    const spriteY = 24;

    switch (this.phase) {
      case 'text-start': {
        const sprite = getPokemonFrontSprite(this.pokemon.speciesId);
        ctx.drawImage(sprite, spriteX, spriteY);

        drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
        drawText(ctx, 'What?', 8, 112, PALETTE.BLACK);
        drawText(ctx, `${this.pokemon.nickname} is evolving!`, 8, 124, PALETTE.BLACK);
        break;
      }

      case 'animating': {
        // Flash between old and new sprite
        const spriteId = this.showOld ? this.pokemon.speciesId : this.targetSpeciesId;
        const sprite = getPokemonFrontSprite(spriteId);

        // White flash effect during transition
        if (!this.showOld && this.flashSpeed < 10) {
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 0.3;
          ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
          ctx.globalAlpha = 1;
        }

        ctx.drawImage(sprite, spriteX, spriteY);
        break;
      }

      case 'cancelled': {
        const sprite = getPokemonFrontSprite(this.pokemon.speciesId);
        ctx.drawImage(sprite, spriteX, spriteY);

        drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
        drawText(ctx, `${this.pokemon.nickname}`, 8, 112, PALETTE.BLACK);
        drawText(ctx, 'stopped evolving!', 8, 124, PALETTE.BLACK);
        break;
      }

      case 'evolved': {
        // White flash
        ctx.fillStyle = '#FFFFFF';
        const alpha = Math.max(0, 1 - this.frame / 30);
        ctx.globalAlpha = alpha;
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
        ctx.globalAlpha = 1;

        const sprite = getPokemonFrontSprite(this.targetSpeciesId);
        ctx.drawImage(sprite, spriteX, spriteY);
        break;
      }

      case 'text-end': {
        const sprite = getPokemonFrontSprite(this.targetSpeciesId);
        ctx.drawImage(sprite, spriteX, spriteY);

        drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
        drawText(ctx, `${this.pokemon.nickname}`, 8, 112, PALETTE.BLACK);
        drawText(ctx, `evolved into #${this.targetSpeciesId}!`, 8, 124, PALETTE.BLACK);
        break;
      }
    }
  }
}
