import { describe, it, expect } from 'vitest';
import {
  parseTaxonomyFile,
  getAllSeedDishes,
  generateSeedInserts,
} from '../seed-data';
import { slugify } from '../dish-taxonomy';

// ── parseTaxonomyFile ──────────────────────────────────────────────────

describe('parseTaxonomyFile', () => {
  const SAMPLE_MD = `## Japanese (3 dishes)

| Dish Name | Native Name | Cuisine | Category | Description |
|---|---|---|---|---|
| Sushi (Nigiri) | Nigiri-zushi | Japanese | rice | Vinegared rice topped with raw fish |
| Ramen | Ramen | Japanese | noodles | Wheat noodles in rich broth |
| Miso Soup | Miso Shiru | Japanese | soup | Fermented soybean paste soup with dashi |
`;

  it('parses table rows into ParsedDish records', () => {
    const dishes = parseTaxonomyFile(SAMPLE_MD);
    expect(dishes).toHaveLength(3);
    expect(dishes[0]).toEqual({
      name: 'Sushi (Nigiri)',
      nativeName: 'Nigiri-zushi',
      cuisine: 'Japanese',
      category: 'rice',
      description: 'Vinegared rice topped with raw fish',
    });
  });

  it('handles native name of "-" as null', () => {
    const md = `| Hot Dog | - | American | main | Beef frank in soft bun |`;
    const dishes = parseTaxonomyFile(md);
    expect(dishes[0].nativeName).toBeNull();
  });

  it('skips header and separator rows', () => {
    const md = `| Dish Name | Native Name | Cuisine | Category | Description |
|---|---|---|---|---|
| Sushi | Sushi | Japanese | rice | Vinegared rice |`;
    const dishes = parseTaxonomyFile(md);
    expect(dishes).toHaveLength(1);
    expect(dishes[0].name).toBe('Sushi');
  });

  it('skips non-table lines', () => {
    const md = `## Header

Some text

| Sushi | Sushi | Japanese | rice | Vinegared rice |

**Total: 1 dish**`;
    const dishes = parseTaxonomyFile(md);
    expect(dishes).toHaveLength(1);
  });

  it('returns empty array for empty content', () => {
    expect(parseTaxonomyFile('')).toEqual([]);
  });
});

// ── getAllSeedDishes ────────────────────────────────────────────────────

describe('getAllSeedDishes', () => {
  it('loads and parses all taxonomy files', () => {
    const dishes = getAllSeedDishes();

    // There should be a substantial number of dishes (the files contain 2000+)
    expect(dishes.length).toBeGreaterThan(1500);
  });

  it('covers multiple cuisines', () => {
    const dishes = getAllSeedDishes();
    const cuisines = new Set(dishes.map((d) => d.cuisine));

    // Expect cuisines from each region file
    expect(cuisines.has('Japanese')).toBe(true);
    expect(cuisines.has('American')).toBe(true);
    expect(cuisines.has('Italian')).toBe(true);
    expect(cuisines.has('Thai')).toBe(true);
    expect(cuisines.has('Mexican')).toBe(true);
    expect(cuisines.has('Lebanese')).toBe(true);
    expect(cuisines.has('Ethiopian')).toBe(true);
    expect(cuisines.size).toBeGreaterThan(30);
  });

  it('covers all DishCategory values via normalization', () => {
    const dishes = getAllSeedDishes();
    const seeds = generateSeedInserts(dishes);
    const categories = new Set(seeds.map((d) => d.category));

    expect(categories.has('main')).toBe(true);
    expect(categories.has('appetizer')).toBe(true);
    expect(categories.has('soup')).toBe(true);
    expect(categories.has('salad')).toBe(true);
    expect(categories.has('side')).toBe(true);
    expect(categories.has('dessert')).toBe(true);
    expect(categories.has('bread')).toBe(true);
    expect(categories.has('beverage')).toBe(true);
    expect(categories.has('condiment')).toBe(true);
    expect(categories.has('snack')).toBe(true);
    expect(categories.has('breakfast')).toBe(true);
  });
});

// ── generateSeedInserts ────────────────────────────────────────────────

describe('generateSeedInserts', () => {
  it('generates valid UUIDs and slugs', () => {
    const parsed = parseTaxonomyFile(
      `| Kung Pao Chicken | Gong Bao Ji Ding | Chinese (Sichuan) | main | Spicy diced chicken with peanuts |`,
    );
    const seeds = generateSeedInserts(parsed);

    expect(seeds).toHaveLength(1);
    expect(seeds[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(seeds[0].slug).toBe('kung-pao-chicken');
    expect(seeds[0].cuisine).toBe('Chinese');
    expect(seeds[0].region).toBe('Sichuan');
    expect(seeds[0].status).toBe('active');
  });

  it('deduplicates slugs across cuisines', () => {
    const parsed = parseTaxonomyFile(`| Satay | Satay | Thai | appetizer | Grilled meat skewers |
| Satay | Satay | Malaysian | appetizer | Grilled meat skewers |
| Satay | Satay | Singaporean | appetizer | Grilled meat skewers |`);
    const seeds = generateSeedInserts(parsed);

    const slugs = seeds.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs[0]).toBe('satay');
    expect(slugs[1]).toBe('satay-malaysian');
    expect(slugs[2]).toBe('satay-singaporean');
  });

  it('extracts region from parenthesized cuisine', () => {
    const parsed = parseTaxonomyFile(
      `| Pad Thai | Pad Thai | Thai | noodles | Stir-fried rice noodles |
| Khao Soi | Khao Soi | Thai (Northern) | noodles | Coconut curry noodle soup |`,
    );
    const seeds = generateSeedInserts(parsed);

    expect(seeds[0].cuisine).toBe('Thai');
    expect(seeds[0].region).toBeNull();
    expect(seeds[1].cuisine).toBe('Thai');
    expect(seeds[1].region).toBe('Northern');
  });

  it('normalizes raw categories to DishCategory enum values', () => {
    const parsed = parseTaxonomyFile(
      `| Gyudon | Gyudon | Japanese | rice | Beef and onion over rice |
| Ramen | Ramen | Japanese | noodles | Wheat noodles in broth |
| Buuz | Buuz | Mongolian | dumpling | Steamed meat dumplings |
| Pastilla | Bastilla | Moroccan | pastry | Phyllo pie with pigeon |`,
    );
    const seeds = generateSeedInserts(parsed);

    // rice, noodles, dumpling all map to 'main'; pastry maps to 'snack'
    expect(seeds[0].category).toBe('main');
    expect(seeds[1].category).toBe('main');
    expect(seeds[2].category).toBe('main');
    expect(seeds[3].category).toBe('snack');
  });

  it('sets default field values', () => {
    const parsed = parseTaxonomyFile(
      `| Test Dish | - | TestCuisine | main | A test dish |`,
    );
    const seeds = generateSeedInserts(parsed);
    const dish = seeds[0];

    expect(dish.photoUrl).toBeNull();
    expect(dish.aliasCount).toBe(0);
    expect(dish.submissionCount).toBe(0);
    expect(dish.proposedBy).toBeNull();
    expect(dish.createdAt).toBeInstanceOf(Date);
    expect(dish.updatedAt).toBeInstanceOf(Date);
  });
});

// ── slugify ────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and replaces spaces', () => {
    expect(slugify('Kung Pao Chicken')).toBe('kung-pao-chicken');
  });

  it('strips diacritics', () => {
    expect(slugify('Creme Brulee')).toBe('creme-brulee');
    expect(slugify('Creme Brulee')).toBe('creme-brulee');
  });

  it('removes special characters', () => {
    expect(slugify("PB&J (Peanut Butter)")).toBe('pb-j-peanut-butter');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('never returns an empty slug (bc_dishes_slug_unique)', () => {
    expect(slugify('')).toMatch(/^dish-[0-9a-f]{8}$/);
  });
});
