/**
 * Clipboard recipe import (P14-C / F-018).
 *
 * Detects whether pasted clipboard content is a URL or plain text.
 * URLs are fetched and parsed via schema.org `Recipe` JSON-LD or
 * basic microdata without Node-only HTML parsing dependencies. Plain
 * text is passed through `parseRecipeFromText` from @mylife/bestchef.
 *
 * The output is intentionally a small editable draft so the new-recipe
 * screen can pre-fill its form. We preserve provenance via `sourceUrl`
 * so the saved recipe can attribute the source.
 */

import { parseIsoDuration, parseRecipeFromText } from '@mylife/bestchef';

export interface RecipeDraft {
  /** Recipe title parsed from JSON-LD or the first text line. */
  title: string;
  /** Optional description. */
  description: string | null;
  /** One ingredient per line; pre-trimmed. */
  ingredients: string[];
  /** One step per line. */
  steps: string[];
  /** Servings count if reported. */
  servings: number | null;
  /** Prep time in minutes if reported. */
  prepTimeMins: number | null;
  /** Cook time in minutes if reported. */
  cookTimeMins: number | null;
  /** Free-form tags / cuisine markers if reported. */
  tags: string[];
  /** Original URL when imported via JSON-LD. */
  sourceUrl: string | null;
  /** Hero image URL when reported. */
  imageUrl: string | null;
  /** Source classification, useful for analytics-free debugging. */
  source: 'url' | 'text';
}

export interface ImportRecipeOptions {
  /** Override the fetch implementation. Used by tests. */
  fetchImpl?: typeof fetch;
  /** Override the request timeout (ms). */
  timeoutMs?: number;
  /** When set, restricts URL imports to specific origins (defense-in-depth). */
  allowedHostsRegex?: RegExp;
}

const URL_RE = /^https?:\/\/[^\s]+$/i;
const DEFAULT_TIMEOUT_MS = 8000;

interface HtmlRecipeData {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  servings?: number;
  prepTimeMins?: number;
  cookTimeMins?: number;
  tags?: string[];
  sourceUrl?: string;
  imageUrl?: string;
}

/**
 * Decide whether a string looks like a URL we should fetch. We only
 * accept absolute http(s) URLs to avoid surprising users with file://
 * or data:// imports.
 */
export function detectClipboardKind(input: string): 'url' | 'text' | 'empty' {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 'empty';
  if (URL_RE.test(trimmed)) return 'url';
  return 'text';
}

/**
 * Parse plain text into a recipe draft using the existing module-level
 * heuristic parser. We expose this as its own helper so the kitchen
 * paste-recipe screen can use it directly without going through the
 * URL / clipboard branch.
 */
export function parseRecipeText(text: string): RecipeDraft {
  const parsed = parseRecipeFromText(text);
  return {
    title: parsed.title.trim() || 'Untitled recipe',
    description: parsed.description?.trim() ?? null,
    ingredients: parsed.ingredients.map((line) => line.trim()).filter(Boolean),
    steps: parsed.steps.map((line) => line.trim()).filter(Boolean),
    servings: parsed.servings ?? null,
    prepTimeMins: parsed.prep_time_min ?? null,
    cookTimeMins: parsed.cook_time_min ?? null,
    tags: [],
    sourceUrl: null,
    imageUrl: null,
    source: 'text',
  };
}

/**
 * Parse a fetched HTML document via JSON-LD Recipe schema. Falls back
 * to basic schema.org microdata. Returns null when no structured recipe
 * ingredients or steps are found.
 */
export async function parseRecipeJsonLd(
  html: string,
  sourceUrl: string,
): Promise<RecipeDraft | null> {
  const parsed = parseRecipeHtml(html);
  if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) {
    return null;
  }
  return {
    title: parsed.title.trim() || 'Imported recipe',
    description: parsed.description?.trim() ?? null,
    ingredients: parsed.ingredients.map((line) => line.trim()).filter(Boolean),
    steps: parsed.steps.map((line) => line.trim()).filter(Boolean),
    servings: parsed.servings ?? null,
    prepTimeMins: parsed.prepTimeMins ?? null,
    cookTimeMins: parsed.cookTimeMins ?? null,
    tags: parsed.tags ?? [],
    sourceUrl: parsed.sourceUrl ?? sourceUrl,
    imageUrl: parsed.imageUrl ?? null,
    source: 'url',
  };
}

function parseRecipeHtml(html: string): HtmlRecipeData | null {
  return parseJsonLdRecipe(html) ?? parseMicrodataRecipe(html);
}

function parseJsonLdRecipe(html: string): HtmlRecipeData | null {
  const scriptRegex =
    /<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    const candidates = [raw, decodeHtmlEntities(raw)];
    for (const candidate of candidates) {
      let data: unknown;
      try {
        data = JSON.parse(candidate);
      } catch {
        continue;
      }

      const recipe = findRecipeInJsonLd(data);
      if (recipe) return mapSchemaRecipe(recipe);
    }
  }

  return null;
}

function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;
  if (isRecipeType(obj)) return obj;

  const nestedKeys = ['@graph', 'mainEntity', 'itemListElement'];
  for (const key of nestedKeys) {
    const found = findRecipeInJsonLd(obj[key]);
    if (found) return found;
  }

  return null;
}

function isRecipeType(obj: Record<string, unknown>): boolean {
  const type = obj['@type'];
  if (typeof type === 'string') return type.toLowerCase() === 'recipe';
  if (Array.isArray(type)) {
    return type.some((entry) => String(entry).toLowerCase() === 'recipe');
  }
  return false;
}

function mapSchemaRecipe(schema: Record<string, unknown>): HtmlRecipeData | null {
  const title = normalizeText(String(schema.name ?? ''));
  if (!title) return null;

  const ingredients = parseStringList(schema.recipeIngredient);
  const steps = parseInstructions(schema.recipeInstructions);
  const prepTimeMins = parseDurationValue(schema.prepTime);
  const cookTimeMins = parseDurationValue(schema.cookTime);
  const servings = parseServings(schema.recipeYield);
  const tags = parseTags(schema.keywords, schema.recipeCategory, schema.recipeCuisine);
  const imageUrl = parseImageUrl(schema.image);
  const sourceUrl = typeof schema.url === 'string' ? schema.url : undefined;
  const description =
    typeof schema.description === 'string'
      ? normalizeText(schema.description)
      : undefined;

  return compactRecipeData({
    title,
    description,
    ingredients,
    steps,
    servings,
    prepTimeMins,
    cookTimeMins,
    tags,
    sourceUrl,
    imageUrl,
  });
}

function parseMicrodataRecipe(html: string): HtmlRecipeData | null {
  if (!/\bitemtype\s*=\s*["'][^"']*schema\.org\/Recipe["']/i.test(html)) {
    return null;
  }

  const title = firstItemPropValue(html, 'name');
  if (!title) return null;

  return compactRecipeData({
    title,
    description: firstItemPropValue(html, 'description'),
    ingredients: allItemPropValues(html, 'recipeIngredient'),
    steps: allItemPropValues(html, 'recipeInstructions'),
    servings: parseServings(firstItemPropValue(html, 'recipeYield')),
    prepTimeMins: parseDurationValue(firstItemPropValue(html, 'prepTime')),
    cookTimeMins: parseDurationValue(firstItemPropValue(html, 'cookTime')),
    imageUrl: firstItemPropValue(html, 'image'),
  });
}

function compactRecipeData(recipe: HtmlRecipeData): HtmlRecipeData {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    ...(recipe.description ? { description: recipe.description } : {}),
    ...(recipe.servings !== undefined ? { servings: recipe.servings } : {}),
    ...(recipe.prepTimeMins !== undefined ? { prepTimeMins: recipe.prepTimeMins } : {}),
    ...(recipe.cookTimeMins !== undefined ? { cookTimeMins: recipe.cookTimeMins } : {}),
    ...(recipe.tags && recipe.tags.length > 0 ? { tags: recipe.tags } : {}),
    ...(recipe.sourceUrl ? { sourceUrl: recipe.sourceUrl } : {}),
    ...(recipe.imageUrl ? { imageUrl: recipe.imageUrl } : {}),
  };
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function parseInstructions(value: unknown): string[] {
  const steps: string[] = [];
  collectInstructions(value, steps);
  return steps;
}

function collectInstructions(value: unknown, steps: string[]): void {
  if (!value) return;

  if (typeof value === 'string') {
    steps.push(...parseStringList(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectInstructions(item, steps);
    }
    return;
  }

  if (typeof value !== 'object') return;

  const obj = value as Record<string, unknown>;
  const text = typeof obj.text === 'string' ? obj.text : obj.name;
  if (typeof text === 'string') {
    const normalized = normalizeText(text);
    if (normalized) steps.push(normalized);
  }

  collectInstructions(obj.itemListElement, steps);
}

function parseDurationValue(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  return parseIsoDuration(value) ?? undefined;
}

function parseServings(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseServings(item);
      if (parsed !== undefined) return parsed;
    }
    return undefined;
  }

  if (value === undefined || value === null) return undefined;
  const match = String(value).match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function parseTags(...values: unknown[]): string[] {
  const tags: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      tags.push(...value.map((entry) => normalizeText(String(entry))).filter(Boolean));
    } else if (typeof value === 'string') {
      tags.push(...value.split(',').map((entry) => normalizeText(entry)).filter(Boolean));
    }
  }
  return Array.from(new Set(tags));
}

function parseImageUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return parseImageUrl(value[0]);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return typeof obj.url === 'string' ? obj.url : undefined;
  }
  return undefined;
}

function firstItemPropValue(html: string, prop: string): string | undefined {
  return allItemPropValues(html, prop)[0];
}

function allItemPropValues(html: string, prop: string): string[] {
  const propName = escapeRegExp(prop);
  const itemPropRegex = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\bitemprop\\s*=\\s*["']${propName}["'])[^>]*(?:>([\\s\\S]*?)<\\/\\1>|\\/?>)`,
    'gi',
  );
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemPropRegex.exec(html)) !== null) {
    const fullMatch = match[0] ?? '';
    const inlineValue =
      extractAttribute(fullMatch, 'content') ??
      extractAttribute(fullMatch, 'src') ??
      extractAttribute(fullMatch, 'href');
    const value = inlineValue ?? stripTags(match[2] ?? '');
    const normalized = normalizeText(value);
    if (normalized) values.push(normalized);
  }

  return values;
}

function extractAttribute(tag: string, name: string): string | undefined {
  const attrRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = tag.match(attrRegex);
  return match?.[2] ? decodeHtmlEntities(match[2]) : undefined;
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ');
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity: string) => {
    if (entity.startsWith('#x')) {
      return decodeNumericEntity(entity, Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return decodeNumericEntity(entity, Number.parseInt(entity.slice(1), 10));
    }
    return namedEntities[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function decodeNumericEntity(entity: string, codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return `&${entity};`;
  }
  return String.fromCodePoint(codePoint);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fetch a URL and parse it. Returns null on failure. The caller chooses
 * how to surface the error.
 */
export async function importRecipeFromUrl(
  url: string,
  options: ImportRecipeOptions = {},
): Promise<RecipeDraft | null> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;
  if (options.allowedHostsRegex) {
    try {
      const parsed = new URL(url);
      if (!options.allowedHostsRegex.test(parsed.hostname)) return null;
    } catch {
      return null;
    }
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    : null;

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'BestChefRecipeImporter/1.0',
      },
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    return await parseRecipeJsonLd(html, url);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Top-level entry. Given clipboard text, produce a draft. Returns null
 * when the input is unusable (empty, network failure, no structured
 * recipe data).
 */
export async function importFromClipboardText(
  clipboardText: string,
  options: ImportRecipeOptions = {},
): Promise<RecipeDraft | null> {
  const kind = detectClipboardKind(clipboardText);
  if (kind === 'empty') return null;
  if (kind === 'url') {
    return importRecipeFromUrl(clipboardText.trim(), options);
  }
  return parseRecipeText(clipboardText);
}
