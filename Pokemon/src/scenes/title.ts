// === Title Screen Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawTextCentered, drawTextLarge } from '../rendering/text.ts';
import { drawWindow, drawMenuList } from '../rendering/menu-ui.ts';
import { getPokemonFrontSprite } from '../rendering/sprites.ts';
import { initTiles } from '../rendering/tiles.ts';
import { initSprites } from '../rendering/sprites.ts';
import { initAudio, playMusic, playSfx, stopMusic } from '../audio.ts';
import { hasSaveData, loadGame, createNewSave } from '../save.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';

type TitlePhase = 'title' | 'menu' | 'oak-intro' | 'name-entry' | 'rival-name' | 'start';

const SHOWCASE_POKEMON = [1, 4, 7, 25, 6, 150, 149, 144, 145, 146, 151, 130];

export class TitleScene implements Scene {
  private frame = 0;
  private blinkTimer = 0;
  private showPress = true;
  private phase: TitlePhase = 'title';
  private menuIndex = 0;
  private menuItems: string[] = [];

  // Pokemon showcase
  private showcaseIndex = 0;
  private showcaseTimer = 0;

  // Oak intro
  private oakTextIndex = 0;
  private oakTexts = [
    'Hello there! Welcome to',
    'the world of POKEMON!',
    'My name is OAK!',
    'People call me the',
    'POKEMON PROF!',
    'This world is inhabited',
    'by creatures called',
    'POKEMON!',
    'Now tell me, what is',
    'your name?',
  ];

  // Name entry
  private enteredName = '';
  private nameTarget: 'player' | 'rival' = 'player';
  private nameCharIndex = 0;
  private nameRow = 0;
  private nameCol = 0;
  private readonly nameChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz';

  // Rival
  private rivalTexts = [
    'This is my grandson.',
    'He has been your rival',
    'since you were a baby.',
    'What is his name?',
  ];

  // Final
  private playerName = '';
  private rivalName = '';

  enter(): void {
    initTiles();
    initSprites();
    this.menuItems = hasSaveData() ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
  }

  exit(): void {
    stopMusic();
  }

  update(): void {
    this.frame++;

    switch (this.phase) {
      case 'title':
        this.updateTitle();
        break;
      case 'menu':
        this.updateMenu();
        break;
      case 'oak-intro':
        this.updateOakIntro();
        break;
      case 'name-entry':
        this.updateNameEntry();
        break;
      case 'rival-name':
        this.updateRivalName();
        break;
      case 'start':
        this.startGame();
        break;
    }
  }

  private updateTitle(): void {
    this.blinkTimer++;
    if (this.blinkTimer >= 30) {
      this.blinkTimer = 0;
      this.showPress = !this.showPress;
    }
    this.showcaseTimer++;
    if (this.showcaseTimer >= 180) {
      this.showcaseTimer = 0;
      this.showcaseIndex = (this.showcaseIndex + 1) % SHOWCASE_POKEMON.length;
    }
    if (isPressed('START') || isPressed('A')) {
      initAudio();
      playSfx('menu-select');
      this.phase = 'menu';
    }
  }

  private updateMenu(): void {
    if (isPressed('UP')) {
      this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length;
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
      playSfx('menu-select');
    }
    if (isPressed('A')) {
      playSfx('menu-select');
      const selected = this.menuItems[this.menuIndex]!;
      if (selected === 'CONTINUE') {
        const save = loadGame();
        if (save) {
          // Load game and go to overworld
          // For now, just start — overworld scene will be imported when available
          this.playerName = save.playerName;
          this.rivalName = save.rivalName;
          this.phase = 'start';
        }
      } else {
        // NEW GAME
        this.phase = 'oak-intro';
        this.oakTextIndex = 0;
      }
    }
    if (isPressed('B')) {
      this.phase = 'title';
    }
  }

  private updateOakIntro(): void {
    if (isPressed('A') || isPressed('START')) {
      playSfx('text-advance');
      this.oakTextIndex += 2;
      if (this.oakTextIndex >= this.oakTexts.length) {
        this.phase = 'name-entry';
        this.nameTarget = 'player';
        this.enteredName = '';
        this.nameRow = 0;
        this.nameCol = 0;
      }
    }
  }

  private updateNameEntry(): void {
    const maxCols = 26;
    const maxRows = 2;

    if (isPressed('LEFT')) {
      this.nameCol = (this.nameCol - 1 + maxCols) % maxCols;
    }
    if (isPressed('RIGHT')) {
      this.nameCol = (this.nameCol + 1) % maxCols;
    }
    if (isPressed('UP')) {
      this.nameRow = (this.nameRow - 1 + maxRows) % maxRows;
    }
    if (isPressed('DOWN')) {
      this.nameRow = (this.nameRow + 1) % maxRows;
    }

    this.nameCharIndex = this.nameRow * maxCols + this.nameCol;

    if (isPressed('A')) {
      if (this.enteredName.length < 7) {
        const ch = this.nameChars[this.nameCharIndex];
        if (ch !== undefined) {
          this.enteredName += ch;
          playSfx('text-advance');
        }
      }
    }

    if (isPressed('B')) {
      if (this.enteredName.length > 0) {
        this.enteredName = this.enteredName.slice(0, -1);
        playSfx('menu-back');
      }
    }

    if (isPressed('START') && this.enteredName.length > 0) {
      playSfx('menu-select');
      if (this.nameTarget === 'player') {
        this.playerName = this.enteredName;
        this.phase = 'rival-name';
        this.oakTextIndex = 0;
      } else {
        this.rivalName = this.enteredName;
        this.phase = 'start';
      }
    }
  }

  private updateRivalName(): void {
    if (isPressed('A') || isPressed('START')) {
      playSfx('text-advance');
      this.oakTextIndex += 2;
      if (this.oakTextIndex >= this.rivalTexts.length) {
        this.phase = 'name-entry';
        this.nameTarget = 'rival';
        this.enteredName = '';
        this.nameRow = 0;
        this.nameCol = 0;
      }
    }
  }

  private startGame(): void {
    if (!this.playerName) this.playerName = 'RED';
    if (!this.rivalName) this.rivalName = 'BLUE';

    const save = createNewSave(this.playerName, this.rivalName);

    // Push overworld scene — import dynamically to avoid circular deps
    // The overworld scene will be wired up in main.ts or a coordinator
    // For now, pop title and the game loop will handle it
    SceneManager.pop();
    // Dispatch event so main.ts can handle starting the game
    window.dispatchEvent(new CustomEvent('pokemon-start', { detail: save }));
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    switch (this.phase) {
      case 'title':
        this.renderTitle(ctx);
        break;
      case 'menu':
        this.renderMenu(ctx);
        break;
      case 'oak-intro':
        this.renderOakIntro(ctx);
        break;
      case 'name-entry':
        this.renderNameEntry(ctx);
        break;
      case 'rival-name':
        this.renderRivalName(ctx);
        break;
    }
  }

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Border decoration
    ctx.fillStyle = PALETTE.DARK;
    ctx.fillRect(4, 4, NATIVE_WIDTH - 8, 2);
    ctx.fillRect(4, NATIVE_HEIGHT - 6, NATIVE_WIDTH - 8, 2);
    ctx.fillRect(4, 4, 2, NATIVE_HEIGHT - 8);
    ctx.fillRect(NATIVE_WIDTH - 6, 4, 2, NATIVE_HEIGHT - 8);

    // Title "POKEMON" large
    drawTextLarge(ctx, 'POKEMON', 16, 8, PALETTE.BLACK);

    // "Red Version" subtitle
    drawTextCentered(ctx, 'Red Version', 28, PALETTE.DARK);

    // Showcase Pokemon sprite
    const pokemonId = SHOWCASE_POKEMON[this.showcaseIndex]!;
    const sprite = getPokemonFrontSprite(pokemonId);
    ctx.drawImage(sprite, (NATIVE_WIDTH - 56) / 2, 38);

    // "PRESS START" blinking
    if (this.showPress) {
      drawTextCentered(ctx, 'PRESS START', 110, PALETTE.BLACK);
    }

    // Version info
    drawTextCentered(ctx, '2024 Recreation', 130, PALETTE.DARK);
  }

  private renderMenu(ctx: CanvasRenderingContext2D): void {
    this.renderTitle(ctx);
    // Menu overlay
    drawMenuList(ctx, this.menuItems, this.menuIndex, 40, 96, 80);
  }

  private renderOakIntro(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Oak "sprite" — simple silhouette
    ctx.fillStyle = PALETTE.DARK;
    // Head
    ctx.fillRect(68, 16, 24, 20);
    ctx.fillStyle = '#F0C080';
    ctx.fillRect(70, 20, 20, 12);
    // Body
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(64, 36, 32, 30);
    // Lab coat
    ctx.fillStyle = PALETTE.DARK;
    ctx.fillRect(64, 36, 32, 2);

    // Text box at bottom
    drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
    const line1 = this.oakTexts[this.oakTextIndex] ?? '';
    const line2 = this.oakTexts[this.oakTextIndex + 1] ?? '';
    drawText(ctx, line1, 8, 112);
    drawText(ctx, line2, 8, 124);

    // Continue indicator
    drawText(ctx, '\u25B6', NATIVE_WIDTH - 16, 132, PALETTE.DARK);
  }

  private renderNameEntry(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    const label = this.nameTarget === 'player' ? 'YOUR NAME?' : 'RIVAL NAME?';
    drawText(ctx, label, 8, 4, PALETTE.BLACK);

    // Current name
    drawWindow(ctx, 8, 14, 128, 16);
    drawText(ctx, this.enteredName + '_', 12, 18, PALETTE.BLACK);

    // Character grid — 2 rows of 26
    const startY = 36;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 26; col++) {
        const idx = row * 26 + col;
        const ch = this.nameChars[idx];
        if (ch === undefined) continue;
        const cx = 4 + col * 6;
        const cy = startY + row * 14;

        if (idx === this.nameCharIndex) {
          ctx.fillStyle = PALETTE.LIGHT;
          ctx.fillRect(cx - 1, cy - 1, 7, 10);
        }
        drawText(ctx, ch === ' ' ? '_' : ch, cx, cy, PALETTE.BLACK);
      }
    }

    // Instructions
    drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
    drawText(ctx, 'A:select B:back', 8, 112, PALETTE.DARK);
    drawText(ctx, 'START:confirm', 8, 124, PALETTE.DARK);
  }

  private renderRivalName(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Rival silhouette
    ctx.fillStyle = PALETTE.DARK;
    ctx.fillRect(68, 16, 24, 20);
    ctx.fillStyle = '#F0C080';
    ctx.fillRect(70, 20, 20, 12);
    ctx.fillStyle = '#6060C0';
    ctx.fillRect(64, 36, 32, 30);

    // Text
    drawWindow(ctx, 0, 104, NATIVE_WIDTH, 40);
    const line1 = this.rivalTexts[this.oakTextIndex] ?? '';
    const line2 = this.rivalTexts[this.oakTextIndex + 1] ?? '';
    drawText(ctx, line1, 8, 112);
    drawText(ctx, line2, 8, 124);

    drawText(ctx, '\u25B6', NATIVE_WIDTH - 16, 132, PALETTE.DARK);
  }
}
