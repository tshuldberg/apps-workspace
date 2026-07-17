// === Pokedex Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawChar } from '../rendering/text.ts';
import { drawWindow } from '../rendering/menu-ui.ts';
import { getPokemonFrontSprite } from '../rendering/sprites.ts';
import { playSfx } from '../audio.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { SaveData } from '../data/game-types.ts';

type DexPhase = 'list' | 'detail';

export class PokedexScene implements Scene {
  private save: SaveData;
  private selectedIndex = 0;
  private scrollOffset = 0;
  private phase: DexPhase = 'list';
  private readonly maxVisible = 7;
  private readonly totalPokemon = 151;

  constructor(save: SaveData) {
    this.save = save;
  }

  enter(): void {}
  exit(): void {}

  update(): void {
    switch (this.phase) {
      case 'list': this.updateList(); break;
      case 'detail': this.updateDetail(); break;
    }
  }

  private updateList(): void {
    if (isPressed('UP') && this.selectedIndex > 0) {
      this.selectedIndex--;
      if (this.selectedIndex < this.scrollOffset) {
        this.scrollOffset = this.selectedIndex;
      }
      playSfx('menu-select');
    }
    if (isPressed('DOWN') && this.selectedIndex < this.totalPokemon - 1) {
      this.selectedIndex++;
      if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
        this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
      }
      playSfx('menu-select');
    }

    if (isPressed('A')) {
      const id = this.selectedIndex + 1;
      if (this.isSeen(id)) {
        playSfx('menu-select');
        this.phase = 'detail';
      }
    }

    if (isPressed('B')) {
      playSfx('menu-back');
      SceneManager.pop();
    }
  }

  private updateDetail(): void {
    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'list';
    }
    if (isPressed('UP')) {
      // Previous seen Pokemon
      let idx = this.selectedIndex - 1;
      while (idx >= 0 && !this.isSeen(idx + 1)) idx--;
      if (idx >= 0) {
        this.selectedIndex = idx;
        playSfx('menu-select');
      }
    }
    if (isPressed('DOWN')) {
      let idx = this.selectedIndex + 1;
      while (idx < this.totalPokemon && !this.isSeen(idx + 1)) idx++;
      if (idx < this.totalPokemon) {
        this.selectedIndex = idx;
        playSfx('menu-select');
      }
    }
  }

  private isSeen(id: number): boolean {
    return this.save.pokedexSeen.includes(id);
  }

  private isCaught(id: number): boolean {
    return this.save.pokedexCaught.includes(id);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    if (this.phase === 'detail') {
      this.renderDetail(ctx);
      return;
    }

    // Header
    drawText(ctx, 'POKeDEX', 8, 2, PALETTE.BLACK);

    // Count
    const seen = this.save.pokedexSeen.length;
    const caught = this.save.pokedexCaught.length;
    drawText(ctx, `SEEN:${seen} OWN:${caught}`, 8, 12, PALETTE.DARK);

    // List
    drawWindow(ctx, 4, 24, 152, this.maxVisible * 16 + 8);

    for (let i = 0; i < this.maxVisible; i++) {
      const idx = i + this.scrollOffset;
      if (idx >= this.totalPokemon) break;

      const dexNum = idx + 1;
      const y = 28 + i * 16;
      const numStr = dexNum.toString().padStart(3, '0');

      if (idx === this.selectedIndex) {
        drawChar(ctx, '\u25B6', 8, y, PALETTE.BLACK);
      }

      // Pokeball icon if caught
      if (this.isCaught(dexNum)) {
        drawChar(ctx, '*', 20, y, PALETTE.BLACK);
      }

      drawText(ctx, numStr, 28, y, PALETTE.BLACK);

      if (this.isSeen(dexNum)) {
        drawText(ctx, `Pokemon #${dexNum}`, 56, y, PALETTE.BLACK);
      } else {
        drawText(ctx, '----------', 56, y, PALETTE.DARK);
      }
    }

    // Scroll indicators
    if (this.scrollOffset > 0) {
      drawChar(ctx, '^', 148, 28, PALETTE.DARK);
    }
    if (this.scrollOffset + this.maxVisible < this.totalPokemon) {
      drawChar(ctx, 'v', 148, 28 + (this.maxVisible - 1) * 16, PALETTE.DARK);
    }
  }

  private renderDetail(ctx: CanvasRenderingContext2D): void {
    const dexNum = this.selectedIndex + 1;

    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Number
    const numStr = '#' + dexNum.toString().padStart(3, '0');
    drawText(ctx, numStr, 8, 4, PALETTE.BLACK);

    // Name
    drawText(ctx, `Pokemon #${dexNum}`, 48, 4, PALETTE.BLACK);

    // Sprite
    if (this.isCaught(dexNum)) {
      const sprite = getPokemonFrontSprite(dexNum);
      ctx.drawImage(sprite, 4, 20);
    } else {
      // Silhouette
      drawWindow(ctx, 4, 20, 60, 60);
      drawText(ctx, '???', 20, 44, PALETTE.DARK);
    }

    // Info panel
    drawWindow(ctx, 68, 20, 88, 60);

    if (this.isCaught(dexNum)) {
      drawText(ctx, 'Type:', 72, 28, PALETTE.DARK);
      drawText(ctx, '???', 72, 38, PALETTE.BLACK);
      drawText(ctx, 'HT: ???', 72, 52, PALETTE.BLACK);
      drawText(ctx, 'WT: ???', 72, 62, PALETTE.BLACK);
    } else {
      drawText(ctx, 'Seen only', 72, 40, PALETTE.DARK);
    }

    // Description
    drawWindow(ctx, 4, 86, 152, 54);
    if (this.isCaught(dexNum)) {
      drawText(ctx, 'A mysterious', 12, 94, PALETTE.BLACK);
      drawText(ctx, 'creature found', 12, 106, PALETTE.BLACK);
      drawText(ctx, 'in the wild.', 12, 118, PALETTE.BLACK);
    }
  }
}
