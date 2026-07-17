// === Start Menu Overlay Scene ===

import { NATIVE_WIDTH, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawChar } from '../rendering/text.ts';
import { drawWindow } from '../rendering/menu-ui.ts';
import { playSfx } from '../audio.ts';
import { saveGame } from '../save.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { SaveData } from '../data/game-types.ts';
import { PokedexScene } from './pokedex.ts';
import { PokemonSummaryScene } from './pokemon-summary.ts';
import { BagScene } from './bag.ts';

const MENU_ITEMS = ['POKeDEX', 'POKEMON', 'BAG', 'PLAYER', 'SAVE', 'OPTION', 'EXIT'];

export class MenuScene implements Scene {
  private selectedIndex = 0;
  private saveData: SaveData;
  private saving = false;
  private saveTimer = 0;

  constructor(saveData: SaveData) {
    this.saveData = saveData;
  }

  enter(): void {
    playSfx('menu-select');
  }

  exit(): void {}

  update(): void {
    if (this.saving) {
      this.saveTimer++;
      if (this.saveTimer > 60) {
        this.saving = false;
      }
      return;
    }

    if (isPressed('UP')) {
      this.selectedIndex = (this.selectedIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.selectedIndex = (this.selectedIndex + 1) % MENU_ITEMS.length;
      playSfx('menu-select');
    }

    if (isPressed('A')) {
      playSfx('menu-select');
      this.handleSelect();
    }

    if (isPressed('B') || isPressed('START')) {
      playSfx('menu-back');
      SceneManager.pop();
    }
  }

  private handleSelect(): void {
    switch (this.selectedIndex) {
      case 0: // POKeDEX
        SceneManager.push(new PokedexScene(this.saveData));
        break;
      case 1: // POKEMON
        SceneManager.push(new PokemonSummaryScene(this.saveData.party));
        break;
      case 2: // BAG
        SceneManager.push(new BagScene(this.saveData.bag));
        break;
      case 3: // PLAYER
        // Show player card — just display info
        break;
      case 4: // SAVE
        this.saving = true;
        this.saveTimer = 0;
        saveGame(this.saveData);
        playSfx('save');
        break;
      case 5: // OPTION
        // Options menu
        break;
      case 6: // EXIT
        SceneManager.pop();
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Menu window on right side
    const menuW = 72;
    const menuX = NATIVE_WIDTH - menuW - 4;
    const menuY = 4;
    const menuH = MENU_ITEMS.length * 16 + 8;

    drawWindow(ctx, menuX, menuY, menuW, menuH);

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const y = menuY + 4 + i * 16;
      if (i === this.selectedIndex) {
        drawChar(ctx, '\u25B6', menuX + 4, y, PALETTE.BLACK);
      }
      drawText(ctx, MENU_ITEMS[i]!, menuX + 16, y, PALETTE.BLACK);
    }

    // Save confirmation
    if (this.saving) {
      drawWindow(ctx, 8, 104, 144, 36);
      if (this.saveTimer < 30) {
        drawText(ctx, 'Saving...', 16, 112, PALETTE.BLACK);
      } else {
        drawText(ctx, 'Game saved!', 16, 112, PALETTE.BLACK);
      }
    }

    // Player info window (below menu)
    if (this.selectedIndex === 3) {
      drawWindow(ctx, 4, 56, 80, 52);
      drawText(ctx, this.saveData.playerName, 12, 62, PALETTE.BLACK);
      drawText(ctx, 'BADGES: ' + this.saveData.badges.filter(Boolean).length, 12, 76, PALETTE.BLACK);
      drawText(ctx, '$' + this.saveData.money, 12, 90, PALETTE.BLACK);
    }
  }
}
