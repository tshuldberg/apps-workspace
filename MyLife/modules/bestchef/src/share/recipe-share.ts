import type { DatabaseAdapter } from '@mylife/db';
import type { Recipe, StructuredIngredient, Step, ShareToken } from '../types';
import { formatQuantity } from '../utils/fractions';
import { formatDuration } from '../utils/time';

function formatIngredientLine(ing: StructuredIngredient): string {
  const qty = formatQuantity(ing.quantity_value);
  const unit = ing.unit ?? '';
  const item = ing.item || ing.name;
  return `- ${[qty, unit, item].filter(Boolean).join(' ')}`;
}

export function generateShareText(
  recipe: Recipe,
  ingredients: StructuredIngredient[],
  steps: Step[],
): string {
  const lines: string[] = [];

  lines.push(recipe.title);

  const metaParts: string[] = [];
  if (recipe.prep_time_mins) metaParts.push(`Prep: ${formatDuration(recipe.prep_time_mins)}`);
  if (recipe.cook_time_mins) metaParts.push(`Cook: ${formatDuration(recipe.cook_time_mins)}`);
  if (recipe.servings) metaParts.push(`Serves: ${recipe.servings}`);
  if (metaParts.length > 0) lines.push(metaParts.join(' | '));

  lines.push('');

  if (ingredients.length > 0) {
    lines.push('Ingredients:');
    for (const ing of ingredients) {
      lines.push(formatIngredientLine(ing));
    }
    lines.push('');
  }

  if (steps.length > 0) {
    const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
    lines.push('Steps:');
    sorted.forEach((step, i) => {
      lines.push(`${i + 1}. ${step.instruction}`);
    });
    lines.push('');
  }

  lines.push('Shared from MyLife');

  return lines.join('\n');
}

const DEFAULT_SHARE_EXPIRY_DAYS = 30;

export function generateShareToken(
  db: DatabaseAdapter,
  recipeId: string,
  expiryDays: number = DEFAULT_SHARE_EXPIRY_DAYS,
): ShareToken {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const shareToken: ShareToken = {
    id,
    recipe_id: recipeId,
    token,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    view_count: 0,
  };

  db.execute(
    `INSERT INTO rc_share_tokens (id, recipe_id, token, created_at, expires_at, view_count)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, recipeId, token, shareToken.created_at, shareToken.expires_at, 0],
  );

  return shareToken;
}

export function getRecipeByShareToken(
  db: DatabaseAdapter,
  token: string,
): Recipe | null {
  const rows = db.query<{ recipe_id: string; id: string; expires_at: string | null }>(
    `SELECT id, recipe_id, expires_at FROM rc_share_tokens WHERE token = ? LIMIT 1`,
    [token],
  );
  if (rows.length === 0) return null;

  // Check expiry
  if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
    return null;
  }

  // Confirm the recipe exists before incrementing the view count
  const recipes = db.query<Recipe>(
    `SELECT * FROM rc_recipes WHERE id = ? LIMIT 1`,
    [rows[0].recipe_id],
  );
  if (!recipes[0]) return null;

  db.execute(
    `UPDATE rc_share_tokens SET view_count = view_count + 1 WHERE id = ?`,
    [rows[0].id],
  );

  return recipes[0];
}

export function getShareTokenViewCount(
  db: DatabaseAdapter,
  token: string,
): number {
  const rows = db.query<{ view_count: number }>(
    `SELECT view_count FROM rc_share_tokens WHERE token = ? LIMIT 1`,
    [token],
  );
  return rows[0]?.view_count ?? 0;
}
