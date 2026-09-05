import type { ParsedIngredient } from '../types';

const UNICODE_FRACTIONS: Record<string, number> = {
  '\u00BC': 0.25,
  '\u00BD': 0.5,
  '\u00BE': 0.75,
  '\u2153': 1 / 3,
  '\u2154': 2 / 3,
  '\u2155': 0.2,
  '\u2156': 0.4,
  '\u2157': 0.6,
  '\u2158': 0.8,
  '\u2159': 1 / 6,
  '\u215A': 5 / 6,
  '\u215B': 0.125,
  '\u215C': 0.375,
  '\u215D': 0.625,
  '\u215E': 0.875,
};

const UNIT_MAP: Record<string, string> = {
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  T: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  t: 'tsp',
  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lb: 'lb',
  lbs: 'lb',
  gram: 'g',
  grams: 'g',
  g: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kg: 'kg',
  milliliter: 'ml',
  milliliters: 'ml',
  ml: 'ml',
  liter: 'L',
  liters: 'L',
  l: 'L',
  quart: 'quart',
  quarts: 'quart',
  qt: 'quart',
  pint: 'pint',
  pints: 'pint',
  pt: 'pint',
  gallon: 'gallon',
  gallons: 'gallon',
  gal: 'gallon',
  pinch: 'pinch',
  dash: 'dash',
  clove: 'clove',
  cloves: 'clove',
  piece: 'piece',
  pieces: 'piece',
  slice: 'slice',
  slices: 'slice',
  can: 'can',
  cans: 'can',
  bunch: 'bunch',
  bunches: 'bunch',
  sprig: 'sprig',
  sprigs: 'sprig',
  head: 'head',
  heads: 'head',
  stalk: 'stalk',
  stalks: 'stalk',
  stick: 'stick',
  sticks: 'stick',
  package: 'package',
  packages: 'package',
  pkg: 'package',
};

const SIZE_MODIFIERS = new Set([
  'small',
  'medium',
  'large',
  'extra-large',
  'jumbo',
  'thin',
  'thick',
]);

export function parseIngredientText(raw: string): ParsedIngredient {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw, quantity: null, unit: null, item: '', prepNote: null };
  }

  let text = trimmed;
  for (const [char, value] of Object.entries(UNICODE_FRACTIONS)) {
    if (text.includes(char)) {
      const unicodePattern = new RegExp(`(\\d+)?\\s*${escapeRegex(char)}`);
      text = text.replace(unicodePattern, (_match, whole) => {
        const wholeNum = whole ? Number.parseInt(whole, 10) : 0;
        return String(wholeNum + value);
      });
    }
  }

  let prepNote: string | null = null;
  // Prep splitting on `,` or `;` (parens are handled later as size descriptors).
  const prepDelimRe = /[,;]/;
  const prepDelimMatch = text.match(prepDelimRe);
  if (prepDelimMatch && prepDelimMatch.index != null) {
    const idx = prepDelimMatch.index;
    const tail = text.slice(idx + 1).trim();
    if (tail.length > 0) {
      prepNote = tail;
    }
    text = text.slice(0, idx).trim();
  }

  const toTasteMatch = text.match(/^(.+?)\s+to\s+taste$/i);
  if (toTasteMatch) {
    return {
      raw,
      quantity: null,
      unit: null,
      item: toTasteMatch[1].trim(),
      prepNote: 'to taste',
    };
  }

  let quantity: number | null = null;
  let remaining = text;

  // Range handling: "1-2 cups" or "1 to 2 cups" -> midpoint
  const rangeMatch = remaining.match(
    /^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s+(.+)$/,
  );
  if (rangeMatch) {
    const lo = Number.parseFloat(rangeMatch[1]);
    const hi = Number.parseFloat(rangeMatch[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      quantity = (lo + hi) / 2;
      remaining = rangeMatch[3];
      const unitResult = extractUnit(remaining);
      if (unitResult) {
        return {
          raw,
          quantity,
          unit: unitResult.unit,
          item: unitResult.remainder.trim().replace(/^of\s+/i, ''),
          prepNote,
        };
      }
      return { raw, quantity, unit: null, item: remaining, prepNote };
    }
  }

  const parenSizeMatch = remaining.match(
    /^(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*\(([^)]+)\)\s*(.+)$/,
  );
  if (parenSizeMatch) {
    quantity = parseQuantity(parenSizeMatch[1]);
    const parenContent = parenSizeMatch[2].trim();
    remaining = parenSizeMatch[3].trim();

    const unitResult = extractUnit(remaining);
    if (unitResult) {
      return {
        raw,
        quantity,
        unit: `${unitResult.unit} (${parenContent})`,
        item: unitResult.remainder.trim(),
        prepNote,
      };
    }

    return {
      raw,
      quantity,
      unit: parenContent,
      item: remaining,
      prepNote,
    };
  }

  const mixedNumberMatch = remaining.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)\s+(.+)$/);
  if (mixedNumberMatch) {
    quantity =
      Number.parseInt(mixedNumberMatch[1], 10) +
      Number.parseInt(mixedNumberMatch[2], 10) / Number.parseInt(mixedNumberMatch[3], 10);
    remaining = mixedNumberMatch[4];
  } else {
    const fractionMatch = remaining.match(/^(\d+)\s*\/\s*(\d+)\s+(.+)$/);
    if (fractionMatch) {
      quantity =
        Number.parseInt(fractionMatch[1], 10) / Number.parseInt(fractionMatch[2], 10);
      remaining = fractionMatch[3];
    } else {
      const numberMatch = remaining.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      if (numberMatch) {
        quantity = Number.parseFloat(numberMatch[1]);
        remaining = numberMatch[2];
      }
    }
  }

  const unitResult = extractUnit(remaining);
  if (unitResult) {
    return {
      raw,
      quantity,
      unit: unitResult.unit,
      item: unitResult.remainder.trim().replace(/^of\s+/i, ''),
      prepNote,
    };
  }

  const words = remaining.split(/\s+/);
  if (quantity !== null && words.length > 1 && SIZE_MODIFIERS.has(words[0].toLowerCase())) {
    const sizeWord = words[0];
    const item = words.slice(1).join(' ');
    return {
      raw,
      quantity,
      unit: 'piece',
      item,
      prepNote: prepNote ? `${sizeWord}, ${prepNote}` : sizeWord,
    };
  }

  if (quantity !== null) {
    return { raw, quantity, unit: null, item: remaining, prepNote };
  }

  return { raw, quantity: null, unit: null, item: remaining, prepNote };
}

function parseQuantity(value: string): number {
  const fractionMatch = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    return Number.parseInt(fractionMatch[1], 10) / Number.parseInt(fractionMatch[2], 10);
  }
  return Number.parseFloat(value);
}

function extractUnit(text: string): { unit: string; remainder: string } | null {
  const words = text.split(/\s+/);
  if (words.length === 0) return null;

  const first = words[0].replace(/\.$/, '');
  const normalized = UNIT_MAP[first] ?? UNIT_MAP[first.toLowerCase()];
  if (normalized && words.length > 1) {
    return { unit: normalized, remainder: words.slice(1).join(' ') };
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
