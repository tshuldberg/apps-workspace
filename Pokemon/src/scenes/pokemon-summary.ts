// === Pokemon Party / Summary Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawChar } from '../rendering/text.ts';
import { drawWindow, drawHpBar, drawPartySlot } from '../rendering/menu-ui.ts';
import { getPokemonFrontSprite } from '../rendering/sprites.ts';
import { playSfx } from '../audio.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { Pokemon } from '../data/game-types.ts';

type PartyPhase = 'list' | 'submenu' | 'summary' | 'switch-select';

export class PokemonSummaryScene implements Scene {
  private party: Pokemon[];
  private selectedIndex = 0;
  private phase: PartyPhase = 'list';
  private submenuIndex = 0;
  private summaryPage = 0;
  private switchFrom = -1;

  private readonly submenuItems = ['SUMMARY', 'SWITCH', 'CANCEL'];

  constructor(party: Pokemon[]) {
    this.party = party;
  }

  enter(): void {}
  exit(): void {}

  update(): void {
    switch (this.phase) {
      case 'list': this.updateList(); break;
      case 'submenu': this.updateSubmenu(); break;
      case 'summary': this.updateSummary(); break;
      case 'switch-select': this.updateSwitchSelect(); break;
    }
  }

  private updateList(): void {
    if (isPressed('UP')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.party.length) % this.party.length;
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.party.length;
      playSfx('menu-select');
    }
    if (isPressed('A')) {
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
        case 0: // SUMMARY
          this.phase = 'summary';
          this.summaryPage = 0;
          break;
        case 1: // SWITCH
          this.switchFrom = this.selectedIndex;
          this.phase = 'switch-select';
          break;
        case 2: // CANCEL
          this.phase = 'list';
          break;
      }
    }
  }

  private updateSummary(): void {
    if (isPressed('LEFT') || isPressed('RIGHT')) {
      this.summaryPage = this.summaryPage === 0 ? 1 : 0;
      playSfx('menu-select');
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'list';
    }
  }

  private updateSwitchSelect(): void {
    if (isPressed('UP')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.party.length) % this.party.length;
      playSfx('menu-select');
    }
    if (isPressed('DOWN')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.party.length;
      playSfx('menu-select');
    }
    if (isPressed('A') && this.selectedIndex !== this.switchFrom) {
      // Swap
      const tmp = this.party[this.switchFrom]!;
      this.party[this.switchFrom] = this.party[this.selectedIndex]!;
      this.party[this.selectedIndex] = tmp;
      playSfx('menu-select');
      this.phase = 'list';
    }
    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'list';
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    if (this.phase === 'summary') {
      this.renderSummary(ctx);
      return;
    }

    // Party list
    drawText(ctx, 'POKEMON', 8, 2, PALETTE.BLACK);

    for (let i = 0; i < this.party.length; i++) {
      drawPartySlot(ctx, this.party[i]!, i, i === this.selectedIndex, 4, 14 + i * 22);
    }

    if (this.phase === 'switch-select') {
      drawText(ctx, 'Move to where?', 8, 132, PALETTE.DARK);
      // Highlight switch-from
      ctx.fillStyle = PALETTE.LIGHT;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(4, 14 + this.switchFrom * 22, 148, 22);
      ctx.globalAlpha = 1;
    }

    // Submenu
    if (this.phase === 'submenu') {
      const smX = NATIVE_WIDTH - 68;
      const smY = 14 + this.selectedIndex * 22;
      drawWindow(ctx, smX, smY, 64, this.submenuItems.length * 16 + 8);
      for (let i = 0; i < this.submenuItems.length; i++) {
        const y = smY + 4 + i * 16;
        if (i === this.submenuIndex) {
          drawChar(ctx, '\u25B6', smX + 4, y, PALETTE.BLACK);
        }
        drawText(ctx, this.submenuItems[i]!, smX + 16, y, PALETTE.BLACK);
      }
    }
  }

  private renderSummary(ctx: CanvasRenderingContext2D): void {
    const pkmn = this.party[this.selectedIndex]!;

    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Sprite
    const sprite = getPokemonFrontSprite(pkmn.speciesId);
    ctx.drawImage(sprite, 4, 4);

    // Name and level
    drawText(ctx, pkmn.nickname, 64, 4, PALETTE.BLACK);
    drawText(ctx, 'Lv' + pkmn.level, 64, 14, PALETTE.BLACK);

    // HP
    drawHpBar(ctx, pkmn.hp, pkmn.maxHp, 84, 28, 60);
    drawText(ctx, `${pkmn.hp}/${pkmn.maxHp}`, 84, 32, PALETTE.BLACK);

    if (this.summaryPage === 0) {
      // Stats page
      drawWindow(ctx, 0, 52, NATIVE_WIDTH, 92);
      drawText(ctx, 'STATS', 8, 56, PALETTE.DARK);

      const stats = [
        ['ATTACK', pkmn.attack],
        ['DEFENSE', pkmn.defense],
        ['SPEED', pkmn.speed],
        ['SPECIAL', pkmn.special],
      ] as const;

      for (let i = 0; i < stats.length; i++) {
        const y = 70 + i * 16;
        const stat = stats[i]!;
        drawText(ctx, stat[0], 8, y, PALETTE.BLACK);
        drawText(ctx, stat[1].toString(), 100, y, PALETTE.BLACK);
      }

      drawText(ctx, '<  1/2  >', 56, 130, PALETTE.DARK);
    } else {
      // Moves page
      drawWindow(ctx, 0, 52, NATIVE_WIDTH, 92);
      drawText(ctx, 'MOVES', 8, 56, PALETTE.DARK);

      for (let i = 0; i < pkmn.moves.length; i++) {
        const move = pkmn.moves[i]!;
        const y = 70 + i * 16;
        drawText(ctx, `Move #${move.moveId}`, 8, y, PALETTE.BLACK);
        drawText(ctx, `PP ${move.pp}/${move.maxPp}`, 96, y, PALETTE.DARK);
      }

      drawText(ctx, '<  2/2  >', 56, 130, PALETTE.DARK);
    }
  }
}
