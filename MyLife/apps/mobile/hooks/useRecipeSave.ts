import { Alert } from 'react-native';
import {
  createRecipe,
  updateRecipe,
  addIngredient,
  getIngredients,
  deleteIngredient,
  parseIngredientText,
  detectStepTimerMinutes,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import type { RecipeFormValues } from '../components/recipes/RecipeForm';
import { uuid } from '../lib/uuid';

function getSteps(db: DatabaseAdapter, recipeId: string) {
  return db.query<{ id: string }>(
    `SELECT id FROM rc_steps WHERE recipe_id = ?`,
    [recipeId],
  );
}

function addStep(
  db: DatabaseAdapter,
  id: string,
  recipeId: string,
  stepNumber: number,
  instruction: string,
  timerMinutes: number | null,
): void {
  db.execute(
    `INSERT INTO rc_steps (id, recipe_id, step_number, instruction, timer_minutes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, recipeId, stepNumber, instruction, timerMinutes, stepNumber],
  );
}

function deleteStep(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_steps WHERE id = ?`, [id]);
}

function saveIngredients(db: DatabaseAdapter, recipeId: string, lines: string[]): void {
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parsed = parseIngredientText(line);
      addIngredient(db, uuid(), {
        recipe_id: recipeId,
        name: parsed.prepNote ? `${parsed.item}, ${parsed.prepNote}` : parsed.item || line,
        quantity: parsed.quantity !== null ? String(parsed.quantity) : null,
        unit: parsed.unit,
        item: parsed.item || line,
        quantity_value: parsed.quantity,
        prep_note: parsed.prepNote,
        sort_order: i,
      });
    });
}

function saveSteps(db: DatabaseAdapter, recipeId: string, lines: string[]): void {
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      addStep(db, uuid(), recipeId, i + 1, line, detectStepTimerMinutes(line));
    });
}

/**
 * Save a recipe (create or update) from form values.
 * Returns the recipe ID on success, or null if validation fails.
 */
export function saveRecipe(
  db: DatabaseAdapter,
  values: RecipeFormValues,
  editId?: string,
): string | null {
  const cleanTitle = values.title.trim();
  if (!cleanTitle) {
    Alert.alert('Missing Title', 'Enter a recipe title.');
    return null;
  }

  const servingsNum = values.servings ? parseInt(values.servings, 10) : null;
  const prepNum = values.prepTime ? parseInt(values.prepTime, 10) : null;
  const cookNum = values.cookTime ? parseInt(values.cookTime, 10) : null;
  const totalNum = (prepNum || 0) + (cookNum || 0) || null;

  if (editId) {
    updateRecipe(db, editId, {
      title: cleanTitle,
      description: values.description.trim() || null,
      servings: servingsNum,
      prep_time_mins: prepNum,
      cook_time_mins: cookNum,
      total_time_mins: totalNum,
      difficulty: values.difficulty || null,
      notes: values.notes.trim() || null,
      source_url: values.sourceUrl.trim() || null,
    });

    // Replace ingredients
    const oldIngredients = getIngredients(db, editId);
    for (const old of oldIngredients) deleteIngredient(db, old.id);
    saveIngredients(db, editId, values.ingredientLines);

    // Replace steps
    const oldSteps = getSteps(db, editId);
    for (const old of oldSteps) deleteStep(db, old.id);
    saveSteps(db, editId, values.stepLines);

    return editId;
  }

  const recipeId = uuid();
  createRecipe(db, recipeId, {
    title: cleanTitle,
    description: values.description.trim() || null,
    servings: servingsNum,
    prep_time_mins: prepNum,
    cook_time_mins: cookNum,
    total_time_mins: totalNum,
    difficulty: values.difficulty || null,
    notes: values.notes.trim() || null,
    source_url: values.sourceUrl.trim() || null,
    rating: 0,
    is_favorite: 0,
  });

  saveIngredients(db, recipeId, values.ingredientLines);
  saveSteps(db, recipeId, values.stepLines);

  return recipeId;
}
