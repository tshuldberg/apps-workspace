// === Pokemart Shop Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawChar } from '../rendering/text.ts';
import { drawWindow, drawMoney } from '../rendering/menu-ui.ts';
import { playSfx } from '../audio.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { SaveData } from '../data/game-types.ts';

interface ShopItem {
  id: number;
  name: string;
  price: number;
}

type ShopPhase = 'mode-select' | 'buy' | 'sell' | 'quantity' | 'confirm';

export class ShopScene implements Scene {
  private save: SaveData;
  private shopItems: ShopItem[];
  private phase: ShopPhase = 'mode-select';
  private modeIndex = 0;
  private itemIndex = 0;
  private scrollOffset = 0;
  private quantity = 1;
  private readonly maxVisible = 5;
  private buying = true;

  constructor(save: SaveData, shopItems: ShopItem[]) {
    this.save = save;
    this.shopItems = shopItems;
  }

  enter(): void {
    playSfx('menu-select');
  }

  exit(): void {}

  update(): void {
    switch (this.phase) {
      case 'mode-select': this.updateModeSelect(); break;
      case 'buy': this.updateBuy(); break;
      case 'sell': this.updateSell(); break;
      case 'quantity': this.updateQuantity(); break;
    }
  }

  private updateModeSelect(): void {
    if (isPressed('UP') || isPressed('DOWN')) {
      this.modeIndex = this.modeIndex === 0 ? 1 : 0;
      playSfx('menu-select');
    }
    if (isPressed('A')) {
      playSfx('menu-select');
      if (this.modeIndex === 0) {
        this.phase = 'buy';
        this.buying = true;
        this.itemIndex = 0;
        this.scrollOffset = 0;
      } else {
        this.phase = 'sell';
        this.buying = false;
        this.itemIndex = 0;
        this.scrollOffset = 0;
      }
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      SceneManager.pop();
    }
  }

  private updateBuy(): void {
    this.updateItemList(this.shopItems.length);
    if (isPressed('A') && this.shopItems.length > 0) {
      playSfx('menu-select');
      this.quantity = 1;
      this.phase = 'quantity';
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'mode-select';
    }
  }

  private updateSell(): void {
    this.updateItemList(this.save.bag.length);
    if (isPressed('A') && this.save.bag.length > 0) {
      playSfx('menu-select');
      this.quantity = 1;
      this.phase = 'quantity';
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'mode-select';
    }
  }

  private updateItemList(count: number): void {
    if (isPressed('UP') && this.itemIndex > 0) {
      this.itemIndex--;
      if (this.itemIndex < this.scrollOffset) this.scrollOffset = this.itemIndex;
      playSfx('menu-select');
    }
    if (isPressed('DOWN') && this.itemIndex < count - 1) {
      this.itemIndex++;
      if (this.itemIndex >= this.scrollOffset + this.maxVisible) {
        this.scrollOffset = this.itemIndex - this.maxVisible + 1;
      }
      playSfx('menu-select');
    }
  }

  private updateQuantity(): void {
    if (isPressed('UP')) {
      this.quantity = Math.min(this.quantity + 1, 99);
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.quantity = Math.max(this.quantity - 1, 1);
      playSfx('menu-select');
    }
    if (isPressed('A')) {
      if (this.buying) {
        const item = this.shopItems[this.itemIndex];
        if (item) {
          const cost = item.price * this.quantity;
          if (this.save.money >= cost) {
            this.save.money -= cost;
            const existing = this.save.bag.find(b => b.itemId === item.id);
            if (existing) {
              existing.quantity += this.quantity;
            } else {
              this.save.bag.push({ itemId: item.id, quantity: this.quantity });
            }
            playSfx('menu-select');
          } else {
            playSfx('menu-back');
          }
        }
      } else {
        const bagItem = this.save.bag[this.itemIndex];
        if (bagItem) {
          const sellPrice = Math.floor(50 * this.quantity); // half price placeholder
          this.save.money += sellPrice;
          bagItem.quantity -= this.quantity;
          if (bagItem.quantity <= 0) {
            this.save.bag.splice(this.itemIndex, 1);
            if (this.itemIndex >= this.save.bag.length && this.itemIndex > 0) {
              this.itemIndex--;
            }
          }
          playSfx('menu-select');
        }
      }
      this.phase = this.buying ? 'buy' : 'sell';
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = this.buying ? 'buy' : 'sell';
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Money display
    drawMoney(ctx, this.save.money, 4, 4);

    switch (this.phase) {
      case 'mode-select':
        this.renderModeSelect(ctx);
        break;
      case 'buy':
        this.renderBuyList(ctx);
        break;
      case 'sell':
        this.renderSellList(ctx);
        break;
      case 'quantity':
        this.renderQuantity(ctx);
        break;
    }
  }

  private renderModeSelect(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 4, 30, 64, 40);
    const modes = ['BUY', 'SELL'];
    for (let i = 0; i < modes.length; i++) {
      const y = 36 + i * 16;
      if (i === this.modeIndex) {
        drawChar(ctx, '\u25B6', 8, y, PALETTE.BLACK);
      }
      drawText(ctx, modes[i]!, 20, y, PALETTE.BLACK);
    }

    drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
    drawText(ctx, 'How may I help you?', 8, 112, PALETTE.BLACK);
  }

  private renderBuyList(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'BUY', 8, 28, PALETTE.BLACK);
    drawWindow(ctx, 4, 38, 152, this.maxVisible * 16 + 8);

    for (let i = 0; i < this.maxVisible; i++) {
      const idx = i + this.scrollOffset;
      if (idx >= this.shopItems.length) break;
      const item = this.shopItems[idx]!;
      const y = 42 + i * 16;
      if (idx === this.itemIndex) {
        drawChar(ctx, '\u25B6', 8, y, PALETTE.BLACK);
      }
      drawText(ctx, item.name, 20, y, PALETTE.BLACK);
      drawText(ctx, '$' + item.price, 112, y, PALETTE.DARK);
    }
  }

  private renderSellList(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'SELL', 8, 28, PALETTE.BLACK);
    drawWindow(ctx, 4, 38, 152, this.maxVisible * 16 + 8);

    for (let i = 0; i < this.maxVisible; i++) {
      const idx = i + this.scrollOffset;
      if (idx >= this.save.bag.length) break;
      const item = this.save.bag[idx]!;
      const y = 42 + i * 16;
      if (idx === this.itemIndex) {
        drawChar(ctx, '\u25B6', 8, y, PALETTE.BLACK);
      }
      drawText(ctx, `ITEM #${item.itemId}`, 20, y, PALETTE.BLACK);
      drawText(ctx, 'x' + item.quantity, 112, y, PALETTE.DARK);
    }

    if (this.save.bag.length === 0) {
      drawText(ctx, 'No items to sell!', 12, 50, PALETTE.DARK);
    }
  }

  private renderQuantity(ctx: CanvasRenderingContext2D): void {
    if (this.buying) {
      this.renderBuyList(ctx);
    } else {
      this.renderSellList(ctx);
    }

    // Quantity selector overlay
    drawWindow(ctx, 80, 80, 72, 40);
    drawText(ctx, 'x ' + this.quantity, 88, 88, PALETTE.BLACK);

    if (this.buying) {
      const item = this.shopItems[this.itemIndex];
      if (item) {
        drawText(ctx, '$' + (item.price * this.quantity), 88, 104, PALETTE.DARK);
      }
    }
  }
}
