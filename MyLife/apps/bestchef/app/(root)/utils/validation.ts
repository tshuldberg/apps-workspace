// Public role address, NOT trey's personal email.
export const CREATOR_CONTACT_EMAIL = 'hello@bestchef.app';

export const INPUT_CAPS = {
  dishTitle: 120,
  recipeDescription: 500,
  ingredientsBlock: 8000,
  instructionsBlock: 8000,
  bio: 280,
  handle: 30,
  displayName: 60,
  comment: 2000,
  portfolio: 500,
  socialLinks: 500,
  motivation: 2000,
  proposeName: 100,
  proposeCuisine: 60,
  proposeCategory: 60,
} as const;

// Bidi control chars + zero-width spaces/joiners.
// U+200B-U+200F, U+202A-U+202E, U+2060-U+2069, U+FEFF.
const BIDI_ZWSP_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

export function normalizeHandle(raw: string): string {
  if (typeof raw !== 'string') return '';
  let s = raw;
  try {
    s = s.normalize('NFKC');
  } catch {
    // normalize not available; continue with raw.
  }
  s = s.replace(BIDI_ZWSP_RE, '');
  s = s.toLowerCase();
  s = s.replace(/\s+/g, '_');
  s = s.replace(/^@+/, '');
  s = s.replace(/[^a-z0-9_]/g, '');
  if (s.length > INPUT_CAPS.handle) s = s.slice(0, INPUT_CAPS.handle);
  return s;
}

export function isValidHandle(h: string): boolean {
  return typeof h === 'string' && /^[a-z0-9_]{2,30}$/.test(h);
}

export function sanitizeFreeText(s: string, max: number): string {
  if (typeof s !== 'string') return '';
  // Strip C0 control chars (except tab \x09, newline \x0A, CR \x0D) and DEL.
  let out = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  out = out.replace(BIDI_ZWSP_RE, '');
  // Collapse runs of whitespace per line, but preserve newlines.
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .join('\n');
  // Collapse 3+ consecutive blank lines to 2.
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.trim();
  if (typeof max === 'number' && max > 0 && out.length > max) {
    out = out.slice(0, max);
  }
  return out;
}

// Hand-rolled shape-checkers (zod not available in this app's deps).

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

function isOptionalBoundedString(v: unknown, min: number, max: number): v is string | undefined {
  if (v === undefined) return true;
  if (typeof v !== 'string') return false;
  return v.length >= min && v.length <= max;
}

function isBoundedString(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

export interface SubmitParamsShape {
  dishId?: string;
  dishName?: string;
  forkFrom?: string;
}

export const SubmitParams = {
  safeParse(input: unknown): ParseResult<SubmitParamsShape> {
    if (input === null || typeof input !== 'object') return { ok: false };
    const obj = input as Record<string, unknown>;
    const { dishId, dishName, forkFrom } = obj;
    if (!isOptionalBoundedString(dishId, 1, 64)) return { ok: false };
    if (!isOptionalBoundedString(forkFrom, 1, 64)) return { ok: false };
    // dishName is UI-only display; accept undefined or string up to a reasonable cap.
    if (dishName !== undefined && (typeof dishName !== 'string' || dishName.length > 200)) {
      return { ok: false };
    }
    const value: SubmitParamsShape = {};
    if (typeof dishId === 'string') value.dishId = dishId;
    if (typeof dishName === 'string') value.dishName = dishName;
    if (typeof forkFrom === 'string') value.forkFrom = forkFrom;
    return { ok: true, value };
  },
};

export interface DishIdParamShape {
  id: string;
}

export const DishIdParam = {
  safeParse(input: unknown): ParseResult<DishIdParamShape> {
    if (input === null || typeof input !== 'object') return { ok: false };
    const obj = input as Record<string, unknown>;
    const { id } = obj;
    if (!isBoundedString(id, 1, 64)) return { ok: false };
    return { ok: true, value: { id } };
  },
};
