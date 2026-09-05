/**
 * Seed data parser for BestChef dish taxonomy.
 *
 * Parses the 5 taxonomy markdown files from `docs/designs/taxonomy/` into
 * structured Dish records. Usable for initial database seeding and testing.
 */

import { randomUUID } from 'crypto';
import { slugify } from './dish-taxonomy';
import { getDishVisuals } from './dish-visuals';
import type { DishCategory } from './types';

// ── Types ──────────────────────────────────────────────────────────────

export interface ParsedDish {
  name: string;
  nativeName: string | null;
  cuisine: string;
  category: string;
  description: string;
}

export interface SeedDish {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  category: DishCategory;
  cuisine: string;
  region: string | null;
  description: string | null;
  photoUrl: string | null;
  gradientFrom: string;
  gradientTo: string;
  emoji: string;
  aliasCount: number;
  submissionCount: number;
  status: 'active';
  proposedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Category normalization ─────────────────────────────────────────────

const CATEGORY_MAP: Record<string, DishCategory> = {
  appetizer: 'appetizer',
  soup: 'soup',
  salad: 'salad',
  main: 'main',
  side: 'side',
  dessert: 'dessert',
  bread: 'bread',
  beverage: 'beverage',
  condiment: 'condiment',
  snack: 'snack',
  breakfast: 'breakfast',
  // Additional categories found in taxonomy files that map to DishCategory
  rice: 'main',
  noodles: 'main',
  stew: 'main',
  dumpling: 'main',
  pastry: 'snack',
};

function normalizeCategory(raw: string): DishCategory {
  const lower = raw.trim().toLowerCase();
  return CATEGORY_MAP[lower] ?? 'main';
}

// ── Region extraction from cuisine ─────────────────────────────────────

/**
 * Some cuisine values include a parenthesized region, e.g.
 * "Chinese (Sichuan)" or "Indian (Punjabi)". Extract the region
 * and return the base cuisine name.
 */
function extractCuisineAndRegion(raw: string): { cuisine: string; region: string | null } {
  const match = raw.match(/^(.+?)\s*\((.+)\)$/);
  if (match) {
    return { cuisine: match[1].trim(), region: match[2].trim() };
  }
  return { cuisine: raw.trim(), region: null };
}

// ── Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a single taxonomy markdown file into ParsedDish records.
 *
 * Expected format per file:
 * ```
 * ## Cuisine Name (N dishes)
 *
 * | Dish Name | Native Name | Cuisine | Category | Description |
 * |---|---|---|---|---|
 * | Sushi (Nigiri) | Nigiri-zushi | Japanese | rice | Vinegared rice topped with raw fish |
 * ```
 */
export function parseTaxonomyFile(content: string): ParsedDish[] {
  const dishes: ParsedDish[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip non-table-data lines
    if (!line.startsWith('|')) continue;

    // Skip header and separator rows
    const trimmed = line.trim();
    if (trimmed.startsWith('| Dish Name') || trimmed.startsWith('|---') || trimmed.startsWith('|--------')) {
      continue;
    }

    // Parse pipe-delimited columns
    const cols = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cols.length < 5) continue;

    const [name, nativeName, cuisine, category, description] = cols;

    dishes.push({
      name: name,
      nativeName: nativeName === '-' || nativeName === '' ? null : nativeName,
      cuisine: cuisine,
      category: category,
      description: description,
    });
  }

  return dishes;
}

// ── File loading ───────────────────────────────────────────────────────

const TAXONOMY_FILES = [
  'americas.md',
  'east-asia.md',
  'europe.md',
  'middle-east-africa.md',
  'south-southeast-asia.md',
];

/**
 * Load and parse all 5 taxonomy files from the given directory.
 * Defaults to the standard docs/designs/taxonomy/ path.
 */
export function getAllSeedDishes(
  taxonomyDir?: string,
): ParsedDish[] {
  // Dynamic require to read files at runtime (Node.js only)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');

  const dir = taxonomyDir ?? path.resolve(__dirname, '../../../../docs/designs/taxonomy');
  const allDishes: ParsedDish[] = [];

  for (const file of TAXONOMY_FILES) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    allDishes.push(...parseTaxonomyFile(content));
  }

  return allDishes;
}

/**
 * Convert parsed dishes into Dish records ready for Supabase insert.
 * Generates UUIDs and slugs, normalizes categories, and extracts regions.
 */
export function generateSeedInserts(dishes: ParsedDish[]): SeedDish[] {
  const now = new Date();
  const seenSlugs = new Set<string>();

  return dishes.map((d) => {
    let slug = slugify(d.name);

    // Deduplicate slugs by appending cuisine
    if (seenSlugs.has(slug)) {
      const { cuisine } = extractCuisineAndRegion(d.cuisine);
      slug = `${slug}-${slugify(cuisine)}`;
    }
    // If still duplicate, append a counter
    let counter = 2;
    const baseSlug = slug;
    while (seenSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    seenSlugs.add(slug);

    const { cuisine, region } = extractCuisineAndRegion(d.cuisine);
    const visuals = getDishVisuals(d.name, cuisine);

    return {
      id: randomUUID(),
      name: d.name,
      slug,
      nativeName: d.nativeName,
      category: normalizeCategory(d.category),
      cuisine,
      region,
      description: d.description,
      photoUrl: null,
      gradientFrom: visuals.from,
      gradientTo: visuals.to,
      emoji: visuals.emoji,
      aliasCount: 0,
      submissionCount: 0,
      status: 'active' as const,
      proposedBy: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}
