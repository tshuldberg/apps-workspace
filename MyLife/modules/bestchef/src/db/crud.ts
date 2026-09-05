import type { DatabaseAdapter } from '@mylife/db';
import type {
  Recipe,
  CreateRecipe,
  UpdateRecipe,
  Ingredient,
  CreateIngredient,
  RecipeTag,
  RecipeFilters,
  Step,
  CreateStep,
  StructuredIngredient,
} from '../types';

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Row shapes
// ─────────────────────────────────────────────────────────────────────────

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  total_time_mins: number | null;
  difficulty: string | null;
  source_url: string | null;
  source_submission_id: string | null;
  source_chef_id: string | null;
  source_chef_name: string | null;
  source_chef_handle: string | null;
  image_uri: string | null;
  is_favorite: number;
  rating: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sort_order: number;
  section?: string | null;
  quantity_value?: number | null;
  item?: string | null;
  prep_note?: string | null;
  is_optional?: number | null;
}

interface RecipeTagRow {
  id: string;
  recipe_id: string;
  tag: string;
}

interface StepRow {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  sort_order: number;
  section?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    prep_time_mins: row.prep_time_mins,
    cook_time_mins: row.cook_time_mins,
    total_time_mins: row.total_time_mins,
    difficulty: row.difficulty as Recipe['difficulty'],
    source_url: row.source_url,
    source_submission_id: row.source_submission_id,
    source_chef_id: row.source_chef_id,
    source_chef_name: row.source_chef_name,
    source_chef_handle: row.source_chef_handle,
    image_uri: row.image_uri,
    is_favorite: row.is_favorite,
    rating: row.rating,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    sort_order: row.sort_order,
    section: row.section ?? null,
    quantity_value: row.quantity_value ?? null,
    item: row.item ?? row.name,
    prep_note: row.prep_note ?? null,
    is_optional: row.is_optional ?? 0,
  };
}

function rowToStructuredIngredient(row: IngredientRow): StructuredIngredient {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    section: row.section ?? null,
    quantity_value: row.quantity_value ?? parseLegacyQuantity(row.quantity),
    quantity: row.quantity,
    unit: row.unit,
    item: row.item ?? row.name,
    name: row.name,
    prep_note: row.prep_note ?? null,
    is_optional: row.is_optional ?? 0,
    sort_order: row.sort_order,
  };
}

function rowToTag(row: RecipeTagRow): RecipeTag {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    tag: row.tag,
  };
}

function rowToStep(row: StepRow): Step {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    step_number: row.step_number,
    instruction: row.instruction,
    timer_minutes: row.timer_minutes,
    sort_order: row.sort_order,
    section: row.section ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Recipes CRUD
// ─────────────────────────────────────────────────────────────────────────

/** Create a new recipe */
export function createRecipe(
  db: DatabaseAdapter,
  id: string,
  input: CreateRecipe,
): Recipe {
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO rc_recipes (id, title, description, servings, prep_time_mins, cook_time_mins,
      total_time_mins, difficulty, source_url, source_submission_id, source_chef_id,
      source_chef_name, source_chef_handle, image_uri, is_favorite, rating, notes,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.description ?? null,
      input.servings ?? null,
      input.prep_time_mins ?? null,
      input.cook_time_mins ?? null,
      input.total_time_mins ?? null,
      input.difficulty ?? null,
      input.source_url ?? null,
      input.source_submission_id ?? null,
      input.source_chef_id ?? null,
      input.source_chef_name ?? null,
      input.source_chef_handle ?? null,
      input.image_uri ?? null,
      input.is_favorite ?? 0,
      input.rating ?? 0,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    title: input.title,
    description: input.description ?? null,
    servings: input.servings ?? null,
    prep_time_mins: input.prep_time_mins ?? null,
    cook_time_mins: input.cook_time_mins ?? null,
    total_time_mins: input.total_time_mins ?? null,
    difficulty: input.difficulty ?? null,
    source_url: input.source_url ?? null,
    source_submission_id: input.source_submission_id ?? null,
    source_chef_id: input.source_chef_id ?? null,
    source_chef_name: input.source_chef_name ?? null,
    source_chef_handle: input.source_chef_handle ?? null,
    image_uri: input.image_uri ?? null,
    is_favorite: input.is_favorite ?? 0,
    rating: input.rating ?? 0,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };
}

/** Get recipes with optional filters. Newest first by default. */
export function getRecipes(db: DatabaseAdapter, filters?: RecipeFilters): Recipe[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.search) {
    conditions.push(`r.title LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLike(filters.search)}%`);
  }
  if (filters?.is_favorite) {
    conditions.push(`r.is_favorite = 1`);
  }
  if (filters?.difficulty) {
    conditions.push(`r.difficulty = ?`);
    params.push(filters.difficulty);
  }
  if (filters?.tag) {
    conditions.push(`r.id IN (SELECT recipe_id FROM rc_recipe_tags WHERE tag = ?)`);
    params.push(filters.tag);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  params.push(limit, offset);

  const rows = db.query<RecipeRow>(
    `SELECT r.* FROM rc_recipes r ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    params,
  );

  return rows.map(rowToRecipe);
}

/** Get a single recipe by ID, or null if not found */
export function getRecipeById(db: DatabaseAdapter, id: string): Recipe | null {
  const rows = db.query<RecipeRow>(
    `SELECT * FROM rc_recipes WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToRecipe(rows[0]) : null;
}

/** Update a recipe's fields. Only provided fields are changed. */
export function updateRecipe(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateRecipe,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, keyof UpdateRecipe> = {
    title: 'title',
    description: 'description',
    servings: 'servings',
    prep_time_mins: 'prep_time_mins',
    cook_time_mins: 'cook_time_mins',
    total_time_mins: 'total_time_mins',
    difficulty: 'difficulty',
    source_url: 'source_url',
    source_submission_id: 'source_submission_id',
    source_chef_id: 'source_chef_id',
    source_chef_name: 'source_chef_name',
    source_chef_handle: 'source_chef_handle',
    image_uri: 'image_uri',
    is_favorite: 'is_favorite',
    rating: 'rating',
    notes: 'notes',
  };

  for (const [col, key] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    db.execute(`UPDATE rc_recipes SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export function toggleFavorite(db: DatabaseAdapter, id: string): boolean {
  const recipe = getRecipeById(db, id);
  if (!recipe) {
    return false;
  }
  const next = recipe.is_favorite ? 0 : 1;
  updateRecipe(db, id, { is_favorite: next });
  return next === 1;
}

export function setRating(db: DatabaseAdapter, id: string, rating: number | null): void {
  updateRecipe(db, id, { rating: rating ?? 0 });
}

/** Delete a recipe by ID. Cascades to ingredients and tags. */
export function deleteRecipe(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM rc_recipes WHERE id = ?`, [id]);
  const rows = db.query<RecipeRow>(`SELECT * FROM rc_recipes WHERE id = ?`, [id]);
  return rows.length === 0;
}

/** Count total recipes, optionally filtered */
export function countRecipes(db: DatabaseAdapter, filters?: RecipeFilters): number {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.search) {
    conditions.push(`title LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLike(filters.search)}%`);
  }
  if (filters?.is_favorite) {
    conditions.push(`is_favorite = 1`);
  }
  if (filters?.difficulty) {
    conditions.push(`difficulty = ?`);
    params.push(filters.difficulty);
  }
  if (filters?.tag) {
    conditions.push(`id IN (SELECT recipe_id FROM rc_recipe_tags WHERE tag = ?)`);
    params.push(filters.tag);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM rc_recipes ${where}`,
    params,
  );
  return rows[0]?.count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Ingredients CRUD
// ─────────────────────────────────────────────────────────────────────────

/** Add an ingredient to a recipe */
export function addIngredient(
  db: DatabaseAdapter,
  id: string,
  input: CreateIngredient,
): Ingredient {
  db.execute(
    `INSERT INTO rc_ingredients (
      id,
      recipe_id,
      name,
      quantity,
      unit,
      sort_order,
      section,
      quantity_value,
      item,
      prep_note,
      is_optional
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.recipe_id,
      input.name,
      input.quantity ?? null,
      input.unit ?? null,
      input.sort_order ?? 0,
      input.section ?? null,
      input.quantity_value ?? parseLegacyQuantity(input.quantity ?? null),
      input.item ?? input.name,
      input.prep_note ?? null,
      input.is_optional ?? 0,
    ],
  );

  return {
    id,
    recipe_id: input.recipe_id,
    name: input.name,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    sort_order: input.sort_order ?? 0,
    section: input.section ?? null,
    quantity_value: input.quantity_value ?? parseLegacyQuantity(input.quantity ?? null),
    item: input.item ?? input.name,
    prep_note: input.prep_note ?? null,
    is_optional: input.is_optional ?? 0,
  };
}

/** Get all ingredients for a recipe, ordered by sort_order */
export function getIngredients(db: DatabaseAdapter, recipeId: string): Ingredient[] {
  const rows = db.query<IngredientRow>(
    `SELECT * FROM rc_ingredients WHERE recipe_id = ? ORDER BY sort_order`,
    [recipeId],
  );
  return rows.map(rowToIngredient);
}

export function getStructuredIngredients(
  db: DatabaseAdapter,
  recipeId: string,
): StructuredIngredient[] {
  const rows = db.query<IngredientRow>(
    `SELECT * FROM rc_ingredients WHERE recipe_id = ? ORDER BY sort_order`,
    [recipeId],
  );
  return rows.map(rowToStructuredIngredient);
}

/** Update an ingredient */
export function updateIngredient(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<
    Pick<
      Ingredient,
      | 'name'
      | 'quantity'
      | 'unit'
      | 'sort_order'
      | 'section'
      | 'quantity_value'
      | 'item'
      | 'prep_note'
      | 'is_optional'
    >
  >,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.quantity !== undefined) {
    fields.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.unit !== undefined) {
    fields.push('unit = ?');
    values.push(updates.unit);
  }
  if (updates.sort_order !== undefined) {
    fields.push('sort_order = ?');
    values.push(updates.sort_order);
  }
  if (updates.section !== undefined) {
    fields.push('section = ?');
    values.push(updates.section);
  }
  if (updates.quantity_value !== undefined) {
    fields.push('quantity_value = ?');
    values.push(updates.quantity_value);
  }
  if (updates.item !== undefined) {
    fields.push('item = ?');
    values.push(updates.item);
  }
  if (updates.prep_note !== undefined) {
    fields.push('prep_note = ?');
    values.push(updates.prep_note);
  }
  if (updates.is_optional !== undefined) {
    fields.push('is_optional = ?');
    values.push(updates.is_optional);
  }

  if (fields.length > 0) {
    values.push(id);
    db.execute(`UPDATE rc_ingredients SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

/** Delete an ingredient by ID */
export function deleteIngredient(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_ingredients WHERE id = ?`, [id]);
}

// ─────────────────────────────────────────────────────────────────────────
// Steps CRUD
// ─────────────────────────────────────────────────────────────────────────

export function addStep(
  db: DatabaseAdapter,
  id: string,
  input: CreateStep,
): Step {
  const sortOrder = input.sort_order ?? input.step_number - 1;
  db.execute(
    `INSERT INTO rc_steps (
      id,
      recipe_id,
      step_number,
      instruction,
      timer_minutes,
      sort_order,
      section
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.recipe_id,
      input.step_number,
      input.instruction,
      input.timer_minutes ?? null,
      sortOrder,
      input.section ?? null,
    ],
  );

  return {
    id,
    recipe_id: input.recipe_id,
    step_number: input.step_number,
    instruction: input.instruction,
    timer_minutes: input.timer_minutes ?? null,
    sort_order: sortOrder,
    section: input.section ?? null,
  };
}

export function getSteps(db: DatabaseAdapter, recipeId: string): Step[] {
  const rows = db.query<StepRow>(
    `SELECT * FROM rc_steps WHERE recipe_id = ? ORDER BY sort_order`,
    [recipeId],
  );
  return rows.map(rowToStep);
}

export function updateStep(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Step, 'step_number' | 'instruction' | 'timer_minutes' | 'sort_order' | 'section'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.step_number !== undefined) {
    fields.push('step_number = ?');
    values.push(updates.step_number);
  }
  if (updates.instruction !== undefined) {
    fields.push('instruction = ?');
    values.push(updates.instruction);
  }
  if (updates.timer_minutes !== undefined) {
    fields.push('timer_minutes = ?');
    values.push(updates.timer_minutes);
  }
  if (updates.sort_order !== undefined) {
    fields.push('sort_order = ?');
    values.push(updates.sort_order);
  }
  if (updates.section !== undefined) {
    fields.push('section = ?');
    values.push(updates.section);
  }

  if (fields.length > 0) {
    values.push(id);
    db.execute(`UPDATE rc_steps SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export function deleteStep(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_steps WHERE id = ?`, [id]);
}

// ─────────────────────────────────────────────────────────────────────────
// Recipe Tags CRUD
// ─────────────────────────────────────────────────────────────────────────

/** Add a tag to a recipe */
export function addTag(
  db: DatabaseAdapter,
  id: string,
  recipeId: string,
  tag: string,
): RecipeTag {
  db.execute(
    `INSERT INTO rc_recipe_tags (id, recipe_id, tag) VALUES (?, ?, ?)`,
    [id, recipeId, tag],
  );
  return { id, recipe_id: recipeId, tag };
}

/** Get all tags for a recipe */
export function getTags(db: DatabaseAdapter, recipeId: string): RecipeTag[] {
  const rows = db.query<RecipeTagRow>(
    `SELECT * FROM rc_recipe_tags WHERE recipe_id = ?`,
    [recipeId],
  );
  return rows.map(rowToTag);
}

/** Delete a tag by ID */
export function deleteTag(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_recipe_tags WHERE id = ?`, [id]);
}

// ─────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────

/** Get a setting value by key */
export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM rc_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

/** Set a setting value */
export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

function parseLegacyQuantity(quantity: string | null): number | null {
  if (!quantity) return null;
  const trimmed = quantity.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
    const [numerator, denominator] = trimmed.split('/').map((value) => Number.parseFloat(value.trim()));
    if (denominator) {
      return numerator / denominator;
    }
  }
  if (/^\d+\s+\d+\s*\/\s*\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/, 2);
    const [numerator, denominator] = fraction.split('/').map((value) => Number.parseFloat(value.trim()));
    if (denominator) {
      return Number.parseFloat(whole) + numerator / denominator;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Recipe Details
// ─────────────────────────────────────────────────────────────────────────

export function getRecipeWithDetails(
  db: DatabaseAdapter,
  id: string,
): { recipe: Recipe; ingredients: Ingredient[]; steps: Step[]; tags: RecipeTag[] } | null {
  const recipe = getRecipeById(db, id);
  if (!recipe) return null;
  const ingredients = getIngredients(db, id);
  const steps = getSteps(db, id);
  const tags = getTags(db, id);
  return { recipe, ingredients, steps, tags };
}

export function duplicateRecipe(
  db: DatabaseAdapter,
  sourceId: string,
  newRecipeId: string,
  newIngredientIds: string[],
  newStepIds: string[],
  newTagIds: string[],
): string | null {
  const details = getRecipeWithDetails(db, sourceId);
  if (!details) return null;

  const { recipe, ingredients, steps, tags } = details;
  const now = new Date().toISOString();

  db.transaction(() => {
    // Clone recipe
    db.execute(
      `INSERT INTO rc_recipes (
        id, title, description, servings, prep_time_mins, cook_time_mins,
        total_time_mins, difficulty, source_url, source_submission_id,
        source_chef_id, source_chef_name, source_chef_handle, image_uri,
        is_favorite, rating, notes, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        newRecipeId,
        recipe.title + ' (Copy)',
        recipe.description,
        recipe.servings,
        recipe.prep_time_mins,
        recipe.cook_time_mins,
        recipe.total_time_mins,
        recipe.difficulty,
        recipe.source_url,
        null,
        recipe.source_chef_id,
        recipe.source_chef_name,
        recipe.source_chef_handle,
        recipe.image_uri,
        recipe.rating,
        recipe.notes,
        now,
        now,
      ],
    );

    // Clone ingredients
    ingredients.forEach((ing, i) => {
      db.execute(
        `INSERT INTO rc_ingredients (id, recipe_id, name, quantity, unit, sort_order, section, quantity_value, item, prep_note, is_optional)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newIngredientIds[i], newRecipeId, ing.name, ing.quantity, ing.unit, ing.sort_order, ing.section ?? null, ing.quantity_value ?? null, ing.item ?? null, ing.prep_note ?? null, ing.is_optional ?? 0],
      );
    });

    // Clone steps
    steps.forEach((step, i) => {
      db.execute(
        `INSERT INTO rc_steps (id, recipe_id, step_number, instruction, timer_minutes, sort_order, section)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newStepIds[i], newRecipeId, step.step_number, step.instruction, step.timer_minutes, step.sort_order, step.section ?? null],
      );
    });

    // Clone tags
    tags.forEach((tag, i) => {
      db.execute(
        `INSERT INTO rc_recipe_tags (id, recipe_id, tag) VALUES (?, ?, ?)`,
        [newTagIds[i], newRecipeId, tag.tag],
      );
    });
  });

  return newRecipeId;
}

// ─────────────────────────────────────────────────────────────────────────
// Convenience Settings
// ─────────────────────────────────────────────────────────────────────────

export function getDefaultServings(db: DatabaseAdapter): number {
  const val = getSetting(db, 'defaultServings');
  return val ? parseInt(val, 10) : 4;
}

export function getMeasurementSystem(db: DatabaseAdapter): string {
  return getSetting(db, 'measurementSystem') ?? 'us';
}
