// === Menu and Window UI System ===

import { PALETTE, NATIVE_WIDTH } from '../constants.ts';
import { drawText, drawChar } from './text.ts';
import type { Pokemon } from '../data/game-types.ts';
import { getPokemonMiniSprite } from './sprites.ts';

/** Draw a Game Boy style bordered window */
export function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // White fill
  ctx.fillStyle = PALETTE.WHITE;
  ctx.fillRect(x, y, w, h);
  // Outer border (black)
  ctx.fillStyle = PALETTE.BLACK;
  ctx.fillRect(x, y, w, 1);         // top
  ctx.fillRect(x, y + h - 1, w, 1); // bottom
  ctx.fillRect(x, y, 1, h);         // left
  ctx.fillRect(x + w - 1, y, 1, h); // right
  // Inner border (dark) — 1px inside
  ctx.fillStyle = PALETTE.DARK;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
}

/** Draw a text box at the bottom of the screen (for dialogue/battle text) */
export function drawTextBox(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  showContinue: boolean = false,
): void {
  const boxH = 40;
  const boxY = 144 - boxH;
  drawWindow(ctx, 0, boxY, NATIVE_WIDTH, boxH);
  for (let i = 0; i < lines.length && i < 2; i++) {
    drawText(ctx, lines[i]!, 8, boxY + 8 + i * 16);
  }
  // Blinking down arrow for continue
  if (showContinue) {
    drawChar(ctx, '\u25B6', NATIVE_WIDTH - 16, boxY + boxH - 12);
  }
}

/** Draw a scrollable menu list with a selector cursor */
export function drawMenuList(
  ctx: CanvasRenderingContext2D,
  items: string[],
  selected: number,
  x: number,
  y: number,
  w: number,
  maxVisible?: number,
): void {
  const visible = maxVisible ?? items.length;
  const scrollOffset = Math.max(0, Math.min(selected - visible + 1, items.length - visible));

  drawWindow(ctx, x, y, w, visible * 16 + 8);

  for (let i = 0; i < visible && i + scrollOffset < items.length; i++) {
    const idx = i + scrollOffset;
    const itemY = y + 4 + i * 16;
    if (idx === selected) {
      drawChar(ctx, '\u25B6', x + 4, itemY);
    }
    drawText(ctx, items[idx]!, x + 16, itemY);
  }

  // Scroll indicators
  if (scrollOffset > 0) {
    drawChar(ctx, '^', x + w - 12, y + 4, PALETTE.DARK);
  }
  if (scrollOffset + visible < items.length) {
    drawChar(ctx, 'v', x + w - 12, y + visible * 16 - 4, PALETTE.DARK);
  }
}

/** Draw HP bar with color based on percentage */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  current: number,
  max: number,
  x: number,
  y: number,
  width: number,
): void {
  const ratio = max > 0 ? current / max : 0;
  const fillW = Math.ceil(ratio * width);

  // "HP" label
  drawText(ctx, 'HP', x - 18, y - 2, PALETTE.BLACK);

  // Background
  ctx.fillStyle = PALETTE.DARK;
  ctx.fillRect(x, y, width, 3);

  // Inner background
  ctx.fillStyle = '#505050';
  ctx.fillRect(x, y, width, 2);

  // Fill color based on ratio
  if (ratio > 0.5) {
    ctx.fillStyle = '#00FF00';
  } else if (ratio > 0.25) {
    ctx.fillStyle = '#FFFF00';
  } else {
    ctx.fillStyle = '#FF0000';
  }

  if (fillW > 0) {
    ctx.fillRect(x, y, fillW, 2);
  }
}

/** Draw experience bar */
export function drawExpBar(
  ctx: CanvasRenderingContext2D,
  current: number,
  needed: number,
  x: number,
  y: number,
  width: number,
): void {
  const ratio = needed > 0 ? Math.min(current / needed, 1) : 0;
  const fillW = Math.ceil(ratio * width);

  // Background
  ctx.fillStyle = '#505050';
  ctx.fillRect(x, y, width, 2);

  // Fill (blue)
  ctx.fillStyle = '#4080FF';
  if (fillW > 0) {
    ctx.fillRect(x, y, fillW, 2);
  }
}

/** Draw a party slot showing Pokemon info */
export function drawPartySlot(
  ctx: CanvasRenderingContext2D,
  pokemon: Pokemon,
  _index: number,
  selected: boolean,
  x: number,
  y: number,
): void {
  // Selection highlight
  if (selected) {
    ctx.fillStyle = PALETTE.LIGHT;
    ctx.fillRect(x, y, 144, 22);
    drawChar(ctx, '\u25B6', x + 1, y + 7);
  }

  // Mini sprite
  const sprite = getPokemonMiniSprite(pokemon.speciesId);
  ctx.drawImage(sprite, x + 12, y + 3);

  // Name and level
  drawText(ctx, pokemon.nickname, x + 30, y + 2, PALETTE.BLACK);
  drawText(ctx, 'Lv' + pokemon.level, x + 30, y + 12, PALETTE.BLACK);

  // HP bar
  drawHpBar(ctx, pokemon.hp, pokemon.maxHp, x + 80, y + 14, 48);

  // HP numbers
  const hpText = `${pokemon.hp}/${pokemon.maxHp}`;
  drawText(ctx, hpText, x + 80, y + 2, PALETTE.BLACK);
}

/** Draw money display */
export function drawMoney(
  ctx: CanvasRenderingContext2D,
  amount: number,
  x: number,
  y: number,
): void {
  drawWindow(ctx, x, y, 80, 20);
  drawText(ctx, '$' + amount.toString(), x + 8, y + 6, PALETTE.BLACK);
}
