import type { DatabaseAdapter } from '@mylife/db';
import { getDishVisuals } from '@mylife/bestchef';
import recipes from './cheftom-seed-recipes.json';

export const CHEFTOM_SEED_REVISION = 'cheftom-foodnetwork-top-20-detailed-2026-05-06';
export const CHEFTOM_SEED_SOURCE_URL =
  'https://www.foodnetwork.com/recipes/photos/foodnetwork-top-50-most-saved-recipes';

const SUBMISSIONS_TABLE = 'rc_bestchef_submissions';
const SEED_SETTINGS_KEY = 'bestchef_cheftom_seed_revision';
const CHEFTOM_PROFILE = {
  id: 'chef-cheftom',
  name: 'ChefTom',
  handle: 'cheftom',
};

export interface ChefTomSeedRecipe {
  sourceRank: number;
  id: string;
  dishId: string;
  dishName: string;
  dishSlug: string;
  title: string;
  description: string;
  cuisine: string;
  category: string;
  region: string;
  ingredients: string[];
  steps: string[];
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  reviewedCount: number;
  likeCount: number;
}

export interface ChefTomSeedDishMeta {
  dishId: string;
  dishName: string;
  dishSlug: string;
  cuisine: string;
  category: string;
  region: string;
  gradientFrom: string;
  gradientTo: string;
  emoji: string;
}

const CHEFTOM_SEED_RECIPES = recipes as ChefTomSeedRecipe[];

function getStringSetting(db: DatabaseAdapter, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(
      'SELECT value FROM rc_settings WHERE key = ?',
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function setStringSetting(db: DatabaseAdapter, key: string, value: string): void {
  try {
    db.execute(
      'INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)',
      [key, value],
    );
  } catch {
    // Seed content can still be inserted if settings persistence is unavailable.
  }
}

function countChefTomSeedRows(db: DatabaseAdapter): number {
  try {
    const rows = db.query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM ${SUBMISSIONS_TABLE}
       WHERE chef_handle = ? AND id LIKE ?`,
      [CHEFTOM_PROFILE.handle, 'cheftom-seed-%'],
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

function seedTimestamp(rank: number): string {
  const base = Date.UTC(2026, 4, 2, 19, 0, 0);
  return new Date(base - (rank - 1) * 60 * 60 * 1000).toISOString();
}

function writeSeedRecipe(db: DatabaseAdapter, recipe: ChefTomSeedRecipe): void {
  const timestamp = seedTimestamp(recipe.sourceRank);
  db.execute(
    `INSERT OR REPLACE INTO ${SUBMISSIONS_TABLE} (
      id, dish_id, dish_name, title, description, ingredients_json,
      instructions_json, photo_uri, videos_json, chef_id, chef_name,
      chef_handle, vote_score, rank, photo_verified, language, created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recipe.id,
      recipe.dishId,
      recipe.dishName,
      recipe.title,
      recipe.description,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      null,
      '[]',
      CHEFTOM_PROFILE.id,
      CHEFTOM_PROFILE.name,
      CHEFTOM_PROFILE.handle,
      recipe.voteScore,
      1,
      1,
      'en',
      timestamp,
      timestamp,
    ],
  );
}

export function ensureChefTomSeedSubmissions(db: DatabaseAdapter): void {
  const existingRevision = getStringSetting(db, SEED_SETTINGS_KEY);
  const existingCount = countChefTomSeedRows(db);
  if (
    existingRevision === CHEFTOM_SEED_REVISION
    && existingCount >= CHEFTOM_SEED_RECIPES.length
  ) {
    return;
  }

  try {
    db.transaction(() => {
      db.execute(
        `DELETE FROM ${SUBMISSIONS_TABLE}
         WHERE chef_handle = ? AND id LIKE ?`,
        [CHEFTOM_PROFILE.handle, 'cheftom-seed-%'],
      );
      for (const recipe of CHEFTOM_SEED_RECIPES) {
        writeSeedRecipe(db, recipe);
      }
      setStringSetting(db, SEED_SETTINGS_KEY, CHEFTOM_SEED_REVISION);
    });
  } catch {
    // Local seed content should not make the Vote tab fail to render.
  }
}

export function getChefTomSeedDishMeta(dishId: string): ChefTomSeedDishMeta | null {
  const recipe = CHEFTOM_SEED_RECIPES.find((item) => item.dishId === dishId);
  if (!recipe) return null;

  const visuals = getDishVisuals(recipe.dishName, recipe.cuisine);
  return {
    dishId: recipe.dishId,
    dishName: recipe.dishName,
    dishSlug: recipe.dishSlug,
    cuisine: recipe.cuisine,
    category: recipe.category,
    region: recipe.region,
    gradientFrom: visuals.from,
    gradientTo: visuals.to,
    emoji: visuals.emoji,
  };
}

export function getChefTomSeedRecipeCount(): number {
  return CHEFTOM_SEED_RECIPES.length;
}
