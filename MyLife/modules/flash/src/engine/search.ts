export type FlashSearchState = 'new' | 'learn' | 'review' | 'due' | 'suspended' | 'buried';
export type FlashSearchProperty = 'lapses' | 'interval' | 'ease' | 'reps';

export type FlashSearchToken =
  | { kind: 'deck'; value: string; negated: boolean }
  | { kind: 'tag'; value: string; negated: boolean }
  | { kind: 'state'; value: FlashSearchState; negated: boolean }
  | {
      kind: 'property';
      field: FlashSearchProperty;
      operator: '<' | '<=' | '=' | '>' | '>=';
      value: number;
      negated: boolean;
    }
  | { kind: 'text'; value: string; negated: false };

export interface FlashSearchQuery {
  raw: string;
  tokens: FlashSearchToken[];
}

const PROPERTY_PATTERN = /^(lapses|interval|ease|reps)(<=|>=|=|<|>)(-?\d+(?:\.\d+)?)$/i;
const STATE_VALUES = new Set<FlashSearchState>(['new', 'learn', 'review', 'due', 'suspended', 'buried']);

function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  for (const match of raw.matchAll(pattern)) {
    tokens.push((match[1] ?? match[2] ?? '').trim());
  }
  return tokens.filter(Boolean);
}

export function parseFlashSearchQuery(raw: string): FlashSearchQuery {
  const tokens: FlashSearchToken[] = [];

  for (const token of tokenize(raw)) {
    const negated = token.startsWith('-');
    const normalized = negated ? token.slice(1) : token;

    if (normalized.startsWith('deck:')) {
      const value = normalized.slice(5).trim();
      if (value) {
        tokens.push({ kind: 'deck', value: value.toLowerCase(), negated });
        continue;
      }
    }

    if (normalized.startsWith('tag:')) {
      const value = normalized.slice(4).trim();
      if (value) {
        tokens.push({ kind: 'tag', value: value.toLowerCase(), negated });
        continue;
      }
    }

    if (normalized.startsWith('is:')) {
      const value = normalized.slice(3).trim().toLowerCase() as FlashSearchState;
      if (STATE_VALUES.has(value)) {
        tokens.push({ kind: 'state', value, negated });
        continue;
      }
    }

    if (normalized.startsWith('prop:')) {
      const match = normalized.slice(5).match(PROPERTY_PATTERN);
      if (match) {
        tokens.push({
          kind: 'property',
          field: match[1].toLowerCase() as FlashSearchProperty,
          operator: match[2] as '<' | '<=' | '=' | '>' | '>=',
          value: Number(match[3]),
          negated,
        });
        continue;
      }
    }

    if (!negated) {
      tokens.push({ kind: 'text', value: normalized.toLowerCase(), negated: false });
      continue;
    }

    tokens.push({ kind: 'text', value: token.toLowerCase(), negated: false });
  }

  return { raw, tokens };
}
