// Real WCAG 2.x contrast math. Pure functions over color strings; no hardcoded
// "AA" anywhere in the system depends on these. Accepts the same color forms the
// theme allows: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba().

export interface Rgba {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** Parse a supported color string into 0-255 channels + 0-1 alpha. Throws on an unparseable value. */
export function parseColor(input: string): Rgba {
  const value = input.trim();

  const hex = value.match(HEX_RE);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const rgb = value.match(RGB_RE);
  if (rgb) {
    const r = clampChannel(Number(rgb[1]));
    const g = clampChannel(Number(rgb[2]));
    const b = clampChannel(Number(rgb[3]));
    const a = rgb[4] === undefined ? 1 : clamp01(Number(rgb[4]));
    return { r, g, b, a };
  }

  throw new Error(`Unparseable color: ${input}`);
}

function clampChannel(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function linearize(channel01: number): number {
  return channel01 <= 0.03928
    ? channel01 / 12.92
    : Math.pow((channel01 + 0.055) / 1.055, 2.4);
}

function luminanceOf(c: Rgba): number {
  const r = linearize(c.r / 255);
  const g = linearize(c.g / 255);
  const b = linearize(c.b / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Alpha-composite `fg` over an opaque `bg`, returning an opaque color. */
function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** WCAG relative luminance (0-1). Alpha is ignored; the color is treated as opaque. */
export function relativeLuminance(color: string): number {
  return luminanceOf(parseColor(color));
}

/**
 * WCAG contrast ratio between `fg` and `bg`, 1..21. If `fg` is translucent it is
 * composited over `bg` (assumed opaque) first, which is the correct treatment
 * for semi-transparent text/UI on a known background.
 */
export function contrastRatio(fg: string, bg: string): number {
  const bgColor = parseColor(bg);
  const fgColor = parseColor(fg);
  const effectiveFg = fgColor.a < 1 ? compositeOver(fgColor, bgColor) : fgColor;
  const l1 = luminanceOf(effectiveFg);
  const l2 = luminanceOf(bgColor);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when the pair meets WCAG AA: 4.5 for normal text, 3.0 for large text / UI. */
export function ratesAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? 3 : 4.5);
}

/** True when the pair meets WCAG AAA: 7.0 for normal text, 4.5 for large text. */
export function ratesAAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? 4.5 : 7);
}
