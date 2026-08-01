import type { BrainResult } from '../types.js';

export function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(
  object: Record<string, unknown>,
  key: 'speak' | 'prompt',
): string | null | undefined {
  const value = object[key];
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

export function validateBrainResult(raw: unknown): BrainResult | null {
  const value = asObject(raw);
  if (
    value === null ||
    (value.action !== 'chat' && value.action !== 'prompt' && value.action !== 'none')
  ) {
    return null;
  }

  const speak = nullableString(value, 'speak');
  const prompt = nullableString(value, 'prompt');
  if (speak === undefined || prompt === undefined) return null;
  if (value.action === 'prompt' && (prompt === null || prompt.trim() === '')) return null;

  return { action: value.action, speak, prompt };
}
