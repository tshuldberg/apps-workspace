// === Bag / Inventory Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawChar } from '../rendering/text.ts';
import { drawWindow } from '../rendering/menu-ui.ts';
import { playSfx } from '../audio.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';

interface BagItem {
  itemId: number;
  quantity: number;
}

type BagPhase = 'list' | 'submenu';

export class BagScene implements Scene {
  private items: BagItem[];
  private selectedIndex = 0;
  private scrollOffset = 0;
  private phase: BagPhase = 'list';
  private submenuIndex = 0;
  private readonly maxVisible = 6;
  private readonly submenuItems = ['USE', 'TOSS', 'CANCEL'];

  constructor(items: BagItem[]) {
    this.items = items;
  }

  enter(): void {}
  exit(): void {}

  update(): void {
    switch (this.phase) {
      case 'list': this.updateList(); break;
      case 'submenu': this.updateSubmenu(); break;
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
    if (isPressed('DOWN') && this.selectedIndex < this.items.length - 1) {
      this.selectedIndex++;
      if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
        this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
      }
      playSfx('menu-select');
    }

    if (isPressed('A') && this.items.length > 0) {
      playSfx('menu-select');
      this.phase = 'submenu';
      this.submenuIndex = 0;
    }

    if (isPressed('B')) {
      playSfx('menu-back');
      SceneManager.pop();
    }
  }

  private updateSubmenu(): void {
    if (isPressed('UP')) {
      this.submenuIndex = (this.submenuIndex - 1 + this.submenuItems.length) % this.submenuItems.length;
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.submenuIndex = (this.submenuIndex + 1) % this.submenuItems.length;
      playSfx('menu-select');
    }

    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'list';
    }

    if (isPressed('A')) {
      playSfx('menu-select');
      switch (this.submenuIndex) {
        case 0: // USE
          // Item usage would integrate with battle/overworld
          this.phase = 'list';
          break;
        case 1: { // TOSS
          const item = this.items[this.selectedIndex];
          if (item) {
            item.quantity--;
            if (item.quantity <= 0) {
              this.items.splice(this.selectedIndex, 1);
              if (this.selectedIndex >= this.items.length && this.selectedIndex > 0) {
                this.selectedIndex--;
              }
            }
          }
          this.phase = 'list';
          break;
        }
        case 2: // CANCEL
          this.phase = 'list';
          break;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    drawText(ctx, 'BAG', 8, 2, PALETTE.BLACK);

    if (this.items.length === 0) {
      drawWindow(ctx, 4, 14, 152, 24);
      drawText(ctx, 'Empty!', 12, 20, PALETTE.DARK);
    } else {
      drawWindow(ctx, 4, 14, 152, this.maxVisible * 16 + 8);

      for (let i = 0; i < this.maxVisible; i++) {
        const idx = i + this.scrollOffset;
        if (idx >= this.items.length) break;

        const item = this.items[idx]!;
        const y = 18 + i * 16;

        if (idx === this.selectedIndex) {
          drawChar(ctx, '\u25B6', 8, y, PALETTE.BLACK);
        }

        drawText(ctx, `ITEM #${item.itemId}`, 20, y, PALETTE.BLACK);
        drawText(ctx, 'x' + item.quantity, 120, y, PALETTE.BLACK);
      }

      // Scroll indicators
      if (this.scrollOffset > 0) {
        drawChar(ctx, '^', 148, 18, PALETTE.DARK);
      }
      if (this.scrollOffset + this.maxVisible < this.items.length) {
        drawChar(ctx, 'v', 148, 18 + (this.maxVisible - 1) * 16, PALETTE.DARK);
      }
    }

    // Submenu
    if (this.phase === 'submenu') {
      const smX = NATIVE_WIDTH - 64;
      const smY = 80;
      drawWindow(ctx, smX, smY, 60, this.submenuItems.length * 16 + 8);
      for (let i = 0; i < this.submenuItems.length; i++) {
        const y = smY + 4 + i * 16;
        if (i === this.submenuIndex) {
          drawChar(ctx, '\u25B6', smX + 4, y, PALETTE.BLACK);
        }
        drawText(ctx, this.submenuItems[i]!, smX + 16, y, PALETTE.BLACK);
      }
    }
  }
}
