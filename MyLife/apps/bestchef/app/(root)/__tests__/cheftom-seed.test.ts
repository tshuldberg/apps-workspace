import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_ROUTE_DIR = path.resolve(process.cwd(), 'app', '(root)');
const CHEFTOM_SEED_PATH = path.join(ROOT_ROUTE_DIR, 'data', 'cheftom-seed-recipes.json');
const CHEFTOM_SEED_MODULE_PATH = path.join(ROOT_ROUTE_DIR, 'data', 'cheftom-seed.ts');
const CHEFTOM_SEED_SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'seed-cheftom-content.mjs');

interface ChefTomSeedRecipe {
  id: string;
  ingredients: string[];
  steps: string[];
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  reviewedCount: number;
  likeCount: number;
}

function readSeedRecipes(): ChefTomSeedRecipe[] {
  return JSON.parse(readFileSync(CHEFTOM_SEED_PATH, 'utf8')) as ChefTomSeedRecipe[];
}

describe('ChefTom seed recipes', () => {
  it('keeps the public launch baseline at 20 recipes with 1000 votes each', () => {
    const recipes = readSeedRecipes();

    expect(recipes).toHaveLength(20);
    for (const recipe of recipes) {
      expect(recipe.id).toMatch(/^cheftom-seed-/);
      expect(recipe.voteScore).toBe(1000);
      expect(recipe.upvoteCount).toBe(1000);
      expect(recipe.downvoteCount).toBe(0);
      expect(recipe.reviewedCount).toBe(1000);
      expect(recipe.likeCount).toBe(1000);
    }
  });

  it('keeps ChefTom rendered as the #1 threshold holder in local and cloud seeds', () => {
    const localSeedModule = readFileSync(CHEFTOM_SEED_MODULE_PATH, 'utf8');
    const cloudSeedScript = readFileSync(CHEFTOM_SEED_SCRIPT_PATH, 'utf8');

    expect(localSeedModule).toContain('CHEFTOM_SEED_REVISION = \'cheftom-foodnetwork-top-20-detailed-2026-05-06\'');
    expect(localSeedModule).toMatch(/recipe\.voteScore,\s+1,\s+1,/);
    expect(cloudSeedScript).toContain('rank: 1,');
    expect(cloudSeedScript).not.toContain('rank: recipe.sourceRank');
    expect(cloudSeedScript).toContain('deleteRetiredChefTomContent');
  });

  it('keeps every ChefTom baseline recipe detailed enough for recipe detail pages', () => {
    const recipes = readSeedRecipes();

    for (const recipe of recipes) {
      expect(recipe.ingredients.length, `${recipe.id} ingredients`).toBeGreaterThanOrEqual(10);
      expect(recipe.steps.length, `${recipe.id} steps`).toBeGreaterThanOrEqual(6);
      expect(recipe.steps.every((step) => step.length >= 40), `${recipe.id} detailed steps`).toBe(true);
    }
  });
});
