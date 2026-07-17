// === Bill's PC Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE, PC_BOX_COUNT, PC_BOX_SIZE, MAX_PARTY_SIZE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawChar } from '../rendering/text.ts';
import { drawWindow, drawHpBar } from '../rendering/menu-ui.ts';
import { getPokemonMiniSprite } from '../rendering/sprites.ts';
import { playSfx } from '../audio.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { Pokemon, SaveData } from '../data/game-types.ts';

type PcPhase = 'main-menu' | 'box-view' | 'party-view' | 'confirm-release';

export class PcScene implements Scene {
  private save: SaveData;
  private phase: PcPhase = 'main-menu';
  private menuIndex = 0;
  private currentBox = 0;
  private boxCursor = 0;
  private partyCursor = 0;
  private selectedPokemon: Pokemon | null = null;
  private selectedSource: 'box' | 'party' = 'box';
  private selectedIndex = 0;
  private releaseTarget: Pokemon | null = null;

  private readonly mainMenuItems = ['WITHDRAW', 'DEPOSIT', 'RELEASE', 'CHANGE BOX', 'EXIT'];
  private readonly boxCols = 5;
  private readonly boxRows = 4; // 20 slots = 5x4

  constructor(save: SaveData) {
    this.save = save;
  }

  enter(): void {
    playSfx('menu-select');
  }

  exit(): void {}

  update(): void {
    switch (this.phase) {
      case 'main-menu': this.updateMainMenu(); break;
      case 'box-view': this.updateBoxView(); break;
      case 'party-view': this.updatePartyView(); break;
      case 'confirm-release': this.updateConfirmRelease(); break;
    }
  }

  private updateMainMenu(): void {
    if (isPressed('UP')) {
      this.menuIndex = (this.menuIndex - 1 + this.mainMenuItems.length) % this.mainMenuItems.length;
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.menuIndex = (this.menuIndex + 1) % this.mainMenuItems.length;
      playSfx('menu-select');
    }
    if (isPressed('A')) {
      playSfx('menu-select');
      switch (this.menuIndex) {
        case 0: // WITHDRAW
        case 1: // DEPOSIT
        case 2: // RELEASE
          this.phase = 'box-view';
          this.boxCursor = 0;
          break;
        case 3: // CHANGE BOX
          this.currentBox = (this.currentBox + 1) % PC_BOX_COUNT;
          playSfx('menu-select');
          break;
        case 4: // EXIT
          SceneManager.pop();
          break;
      }
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      SceneManager.pop();
    }
  }

  private updateBoxView(): void {
    const box = this.save.pcBoxes[this.currentBox]!;

    // Navigation
    if (isPressed('LEFT') && this.boxCursor % this.boxCols > 0) {
      this.boxCursor--;
      playSfx('menu-select');
    }
    if (isPressed('RIGHT') && this.boxCursor % this.boxCols < this.boxCols - 1) {
      this.boxCursor++;
      playSfx('menu-select');
    }
    if (isPressed('UP') && this.boxCursor >= this.boxCols) {
      this.boxCursor -= this.boxCols;
      playSfx('menu-select');
    }
    if (isPressed('DOWN') && this.boxCursor + this.boxCols < PC_BOX_SIZE) {
      this.boxCursor += this.boxCols;
      playSfx('menu-select');
    }

    // Switch box with SELECT
    if (isPressed('SELECT')) {
      this.currentBox = (this.currentBox + 1) % PC_BOX_COUNT;
      this.boxCursor = 0;
      playSfx('menu-select');
    }

    if (isPressed('A')) {
      const pokemon = box[this.boxCursor] ?? null;

      switch (this.menuIndex) {
        case 0: // WITHDRAW
          if (pokemon && this.save.party.length < MAX_PARTY_SIZE) {
            this.save.party.push(pokemon);
            box[this.boxCursor] = null;
            playSfx('menu-select');
          } else {
            playSfx('menu-back');
          }
          break;
        case 1: // DEPOSIT
          this.phase = 'party-view';
          this.partyCursor = 0;
          break;
        case 2: // RELEASE
          if (pokemon) {
            this.releaseTarget = pokemon;
            this.selectedIndex = this.boxCursor;
            this.selectedSource = 'box';
            this.phase = 'confirm-release';
          }
          break;
      }
    }

    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'main-menu';
    }
  }

  private updatePartyView(): void {
    if (isPressed('UP') && this.partyCursor > 0) {
      this.partyCursor--;
      playSfx('menu-select');
    }
    if (isPressed('DOWN') && this.partyCursor < this.save.party.length - 1) {
      this.partyCursor++;
      playSfx('menu-select');
    }

    if (isPressed('A')) {
      if (this.save.party.length > 1) {
        const pokemon = this.save.party[this.partyCursor]!;
        const box = this.save.pcBoxes[this.currentBox]!;
        const emptySlot = box.indexOf(null);
        if (emptySlot !== -1) {
          box[emptySlot] = pokemon;
          this.save.party.splice(this.partyCursor, 1);
          if (this.partyCursor >= this.save.party.length) {
            this.partyCursor = this.save.party.length - 1;
          }
          playSfx('menu-select');
        } else {
          playSfx('menu-back');
        }
      } else {
        playSfx('menu-back');
      }
    }

    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'box-view';
    }
  }

  private updateConfirmRelease(): void {
    if (isPressed('A')) {
      // Release the Pokemon
      if (this.selectedSource === 'box') {
        this.save.pcBoxes[this.currentBox]![this.selectedIndex] = null;
      }
      this.releaseTarget = null;
      playSfx('menu-select');
      this.phase = 'box-view';
    }
    if (isPressed('B')) {
      this.releaseTarget = null;
      playSfx('menu-back');
      this.phase = 'box-view';
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    switch (this.phase) {
      case 'main-menu':
        this.renderMainMenu(ctx);
        break;
      case 'box-view':
        this.renderBoxView(ctx);
        break;
      case 'party-view':
        this.renderPartyView(ctx);
        break;
      case 'confirm-release':
        this.renderBoxView(ctx);
        this.renderConfirmRelease(ctx);
        break;
    }
  }

  private renderMainMenu(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, "BILL's PC", 8, 4, PALETTE.BLACK);
    drawText(ctx, `BOX ${this.currentBox + 1}`, 100, 4, PALETTE.DARK);

    drawWindow(ctx, 8, 20, 100, this.mainMenuItems.length * 16 + 8);
    for (let i = 0; i < this.mainMenuItems.length; i++) {
      const y = 24 + i * 16;
      if (i === this.menuIndex) {
        drawChar(ctx, '\u25B6', 12, y, PALETTE.BLACK);
      }
      drawText(ctx, this.mainMenuItems[i]!, 24, y, PALETTE.BLACK);
    }
  }

  private renderBoxView(ctx: CanvasRenderingContext2D): void {
    const box = this.save.pcBoxes[this.currentBox]!;

    drawText(ctx, `BOX ${this.currentBox + 1}`, 8, 2, PALETTE.BLACK);

    // Grid of Pokemon slots
    const gridX = 4;
    const gridY = 14;
    const cellW = 28;
    const cellH = 28;

    drawWindow(ctx, gridX, gridY, this.boxCols * cellW + 8, this.boxRows * cellH + 8);

    for (let i = 0; i < PC_BOX_SIZE; i++) {
      const col = i % this.boxCols;
      const row = Math.floor(i / this.boxCols);
      const cx = gridX + 4 + col * cellW;
      const cy = gridY + 4 + row * cellH;

      // Highlight selected
      if (i === this.boxCursor) {
        ctx.fillStyle = PALETTE.LIGHT;
        ctx.fillRect(cx, cy, cellW - 2, cellH - 2);
      }

      const pokemon = box[i];
      if (pokemon) {
        const miniSprite = getPokemonMiniSprite(pokemon.speciesId);
        ctx.drawImage(miniSprite, cx + 6, cy + 2);
        drawText(ctx, pokemon.level.toString(), cx + 4, cy + 20, PALETTE.DARK);
      } else {
        drawText(ctx, '-', cx + 10, cy + 8, PALETTE.DARK);
      }
    }

    // Info panel for selected
    const selectedPkmn = box[this.boxCursor] ?? null;
    if (selectedPkmn) {
      drawWindow(ctx, 4, 130, 152, 14);
      drawText(ctx, `${selectedPkmn.nickname} Lv${selectedPkmn.level}`, 8, 132, PALETTE.BLACK);
    }
  }

  private renderPartyView(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'DEPOSIT which?', 8, 2, PALETTE.BLACK);
    drawWindow(ctx, 4, 14, 152, this.save.party.length * 20 + 8);

    for (let i = 0; i < this.save.party.length; i++) {
      const pkmn = this.save.party[i]!;
      const y = 18 + i * 20;

      if (i === this.partyCursor) {
        drawChar(ctx, '\u25B6', 8, y + 4, PALETTE.BLACK);
      }

      const mini = getPokemonMiniSprite(pkmn.speciesId);
      ctx.drawImage(mini, 20, y);
      drawText(ctx, pkmn.nickname, 38, y, PALETTE.BLACK);
      drawText(ctx, 'Lv' + pkmn.level, 38, y + 10, PALETTE.DARK);
      drawHpBar(ctx, pkmn.hp, pkmn.maxHp, 100, y + 12, 48);
    }
  }

  private renderConfirmRelease(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, 20, 60, 120, 40);
    if (this.releaseTarget) {
      drawText(ctx, `Release`, 28, 68, PALETTE.BLACK);
      drawText(ctx, `${this.releaseTarget.nickname}?`, 28, 80, PALETTE.BLACK);
      drawText(ctx, 'A:Yes  B:No', 32, 92, PALETTE.DARK);
    }
  }
}
