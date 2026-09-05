import * as cheerio from 'cheerio';
import type { ParsedRecipe } from '../types';

/**
 * Extended recipe type that includes extra fields extracted from HTML
 * that the base ParsedRecipe may not yet have.
 */
export interface UrlParsedRecipe extends ParsedRecipe {
  yield_text?: string;
  tags?: string[];
  image_url?: string;
  source_url?: string;
  source_name?: string;
}

/**
 * Parse a raw HTML string and extract recipe data.
 *
 * Extraction priority:
 *  1. JSON-LD (schema.org/Recipe)
 *  2. Microdata (itemprop attributes)
 *  3. Meta tag fallback (og:title, og:description, og:image)
 *
 * Returns null if no recipe data is found.
 */
export function parseRecipeFromHtml(html: string): UrlParsedRecipe | null {
  const $ = cheerio.load(html);

  // 1. Try JSON-LD
  const jsonLd = extractJsonLd($);
  if (jsonLd) return jsonLd;

  // 2. Try Microdata
  const microdata = extractMicrodata($);
  if (microdata) return microdata;

  // 3. Meta tag fallback
  return extractMetaTags($);
}

// ---------------------------------------------------------------------------
// JSON-LD extraction
// ---------------------------------------------------------------------------

function extractJsonLd($: cheerio.CheerioAPI): UrlParsedRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const recipe = findRecipeInJsonLd(data);
    if (recipe) return mapSchemaToRecipe(recipe);
  }
  return null;
}

function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  // Direct Recipe object
  if (isRecipeType(data as Record<string, unknown>)) {
    return data as Record<string, unknown>;
  }

  // Array (could be @graph or top-level array)
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  // Object with @graph array
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph'] as unknown[]) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  return null;
}

function isRecipeType(obj: Record<string, unknown>): boolean {
  const type = obj['@type'];
  if (type === 'Recipe') return true;
  if (Array.isArray(type) && type.includes('Recipe')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Microdata extraction
// ---------------------------------------------------------------------------

function extractMicrodata($: cheerio.CheerioAPI): UrlParsedRecipe | null {
  let recipeEl = $('[itemtype="https://schema.org/Recipe"]').first();
  if (!recipeEl.length) {
    recipeEl = $('[itemtype="http://schema.org/Recipe"]').first();
  }

  if (!recipeEl.length) return null;

  const title = recipeEl.find('[itemprop="name"]').first().text().trim();
  if (!title) return null;

  const description = recipeEl.find('[itemprop="description"]').first().text().trim() || undefined;

  const ingredients: string[] = [];
  recipeEl.find('[itemprop="recipeIngredient"]').each((_i, el) => {
    const text = $(el).text().trim();
    if (text) ingredients.push(text);
  });

  const steps: string[] = [];
  recipeEl.find('[itemprop="recipeInstructions"]').each((_i, el) => {
    const text = $(el).text().trim();
    if (text) steps.push(text);
  });

  const prepTimeRaw = recipeEl.find('[itemprop="prepTime"]').attr('content') || '';
  const cookTimeRaw = recipeEl.find('[itemprop="cookTime"]').attr('content') || '';
  const yieldRaw = recipeEl.find('[itemprop="recipeYield"]').first().text().trim();

  const recipe: UrlParsedRecipe = { title, ingredients, steps };
  if (description) recipe.description = description;
  if (prepTimeRaw) {
    const mins = parseIsoDuration(prepTimeRaw);
    if (mins !== undefined) recipe.prep_time_min = mins;
  }
  if (cookTimeRaw) {
    const mins = parseIsoDuration(cookTimeRaw);
    if (mins !== undefined) recipe.cook_time_min = mins;
  }
  if (yieldRaw) {
    const servings = parseServings(yieldRaw);
    if (servings !== undefined) recipe.servings = servings;
  }

  const imageEl = recipeEl.find('[itemprop="image"]').first();
  const imageUrl = imageEl.attr('src') || imageEl.attr('content');
  if (imageUrl) recipe.image_url = imageUrl;

  return recipe;
}

// ---------------------------------------------------------------------------
// Meta tag fallback
// ---------------------------------------------------------------------------

function extractMetaTags($: cheerio.CheerioAPI): UrlParsedRecipe | null {
  const title =
    $('meta[property="og:title"]').attr('content') || $('title').text().trim();

  if (!title) return null;

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    undefined;
  const imageUrl = $('meta[property="og:image"]').attr('content') || undefined;

  const recipe: UrlParsedRecipe = { title, ingredients: [], steps: [] };
  if (description) recipe.description = description;
  if (imageUrl) recipe.image_url = imageUrl;

  return recipe;
}

// ---------------------------------------------------------------------------
// Schema.org Recipe -> UrlParsedRecipe mapping
// ---------------------------------------------------------------------------

function mapSchemaToRecipe(schema: Record<string, unknown>): UrlParsedRecipe {
  const title = String(schema.name ?? '');
  const description = schema.description ? String(schema.description) : undefined;

  // Ingredients
  const rawIngredients = schema.recipeIngredient;
  const ingredients: string[] = Array.isArray(rawIngredients)
    ? rawIngredients.map((i) => String(i).trim()).filter(Boolean)
    : [];

  // Steps: can be string[], HowToStep[], HowToSection[], or a single string
  const steps = parseInstructions(schema.recipeInstructions);

  // Times
  const prepTime = schema.prepTime ? parseIsoDuration(String(schema.prepTime)) : undefined;
  const cookTime = schema.cookTime ? parseIsoDuration(String(schema.cookTime)) : undefined;

  // Servings
  const yieldRaw = schema.recipeYield;
  let servings: number | undefined;
  let yieldText: string | undefined;
  if (yieldRaw !== undefined) {
    if (Array.isArray(yieldRaw)) {
      // Some sites provide an array like ["4", "4 servings"]
      for (const y of yieldRaw) {
        const s = parseServings(String(y));
        if (s !== undefined) {
          servings = s;
          break;
        }
      }
      yieldText = String(yieldRaw[0]);
    } else {
      servings = parseServings(String(yieldRaw));
      yieldText = String(yieldRaw);
    }
  }

  // Tags
  const tags = parseTags(schema.keywords, schema.recipeCategory);

  // Image
  const imageUrl = parseImage(schema.image);

  const recipe: UrlParsedRecipe = { title, ingredients, steps };
  if (description) recipe.description = description;
  if (prepTime !== undefined) recipe.prep_time_min = prepTime;
  if (cookTime !== undefined) recipe.cook_time_min = cookTime;
  if (servings !== undefined) recipe.servings = servings;
  if (yieldText) recipe.yield_text = yieldText;
  if (tags && tags.length > 0) recipe.tags = tags;
  if (imageUrl) recipe.image_url = imageUrl;

  return recipe;
}

// ---------------------------------------------------------------------------
// Instruction parsing
// ---------------------------------------------------------------------------

function parseInstructions(raw: unknown): string[] {
  if (!raw) return [];

  // Single string
  if (typeof raw === 'string') {
    return raw
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Array of strings or HowToStep objects
  if (Array.isArray(raw)) {
    const steps: string[] = [];
    for (const item of raw) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) steps.push(trimmed);
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        // HowToStep
        if (obj.text) {
          steps.push(String(obj.text).trim());
        } else if (obj.name) {
          steps.push(String(obj.name).trim());
        }
        // HowToSection with itemListElement
        if (Array.isArray(obj.itemListElement)) {
          for (const sub of obj.itemListElement as Record<string, unknown>[]) {
            if (sub.text) steps.push(String(sub.text).trim());
          }
        }
      }
    }
    return steps;
  }

  return [];
}

// ---------------------------------------------------------------------------
// ISO 8601 duration parsing
// ---------------------------------------------------------------------------

/** Parse ISO 8601 duration (PT15M, PT1H30M, PT2H) to total minutes. */
export function parseIsoDuration(iso: string): number | undefined {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const total = hours * 60 + minutes + (seconds > 0 ? Math.ceil(seconds / 60) : 0);
  return total > 0 ? total : undefined;
}

// ---------------------------------------------------------------------------
// Helper parsers
// ---------------------------------------------------------------------------

function parseServings(raw: string): number | undefined {
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

function parseTags(
  keywords: unknown,
  recipeCategory: unknown,
): string[] | undefined {
  const tags: string[] = [];

  if (typeof keywords === 'string') {
    tags.push(...keywords.split(',').map((k) => k.trim()).filter(Boolean));
  } else if (Array.isArray(keywords)) {
    tags.push(...keywords.map((k) => String(k).trim()).filter(Boolean));
  }

  if (typeof recipeCategory === 'string') {
    tags.push(
      ...recipeCategory.split(',').map((c) => c.trim()).filter(Boolean),
    );
  } else if (Array.isArray(recipeCategory)) {
    tags.push(...recipeCategory.map((c) => String(c).trim()).filter(Boolean));
  }

  return tags.length > 0 ? tags : undefined;
}

function parseImage(image: unknown): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      return String((first as Record<string, unknown>).url ?? '');
    }
  }
  if (typeof image === 'object') {
    return String((image as Record<string, unknown>).url ?? '');
  }
  return undefined;
}
