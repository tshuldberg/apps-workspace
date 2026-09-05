// Pure color-math helpers shared by derive.ts and generate.ts: hex<->HSL,
// lightness adjustment, RGB mixing, and translucent-string construction. No
// react, no DOM. Built on the parser in contrast.ts.

import { parseColor, type Rgba } from './contrast';

function toHex2(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0');
}

/** {r,g,b} (0-255) -> '#rrggbb'. Alpha is dropped; use `rgba()` for translucency. */
export function rgbToHex(c: { r: number; g: number; b: number }): string {
  return `#${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}`;
}

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export function rgbToHsl(c: { r: number; g: number; b: number }): Hsl {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(hsl: Hsl): { r: number; g: number; b: number } {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, hsl.s)) / 100;
  const l = Math.max(0, Math.min(100, hsl.l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Shift a color's HSL lightness by `deltaPoints` percentage points (clamped 0-100). */
export function adjustLightness(color: string, deltaPoints: number): string {
  const hsl = rgbToHsl(parseColor(color));
  hsl.l = Math.max(0, Math.min(100, hsl.l + deltaPoints));
  return rgbToHex(hslToRgb(hsl));
}

/** Linearly mix two colors in RGB space: t=0 -> a, t=1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

/** Build an `rgba(r, g, b, a)` string from any color (its own alpha is replaced). */
export function withAlpha(color: string, alpha: number): string {
  const c: Rgba = parseColor(color);
  const a = Math.max(0, Math.min(1, alpha));
  const round = (n: number): number => Math.round(n);
  return `rgba(${round(c.r)}, ${round(c.g)}, ${round(c.b)}, ${a})`;
}
