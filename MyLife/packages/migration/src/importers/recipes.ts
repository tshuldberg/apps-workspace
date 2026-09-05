import type { DatabaseAdapter } from '@mylife/db';

export interface RecipesImportResult {
  recipesImported: number;
  ingredientsImported: number;
  stepsImported: number;
  tagsImported: number;
  collectionsImported: number;
  groceryListsImported: number;
  groceryItemsImported: number;
  mealPlansImported: number;
  mealPlanItemsImported: number;
  settingsImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * Import data from a standalone MyRecipes SQLite database into the hub database.
 * Reads from unprefixed tables in sourceDb, writes to rc_-prefixed tables in hubDb.
 *
 * Table mapping (standalone -> hub):
 *   recipes           -> rc_recipes
 *   ingredients        -> rc_ingredients
 *   steps              -> rc_steps
 *   tags + recipe_tags -> rc_recipe_tags (hub uses inline tags, not a separate tags table)
 *   collections        -> (not in hub schema, warning)
 *   recipe_collections -> (not in hub schema, warning)
 *   grocery_lists      -> (not in hub schema, warning)
 *   grocery_items      -> (not in hub schema, warning)
 *   preferences        -> rc_settings
 *   rc_meal_plans      -> rc_meal_plans (same prefix in both)
 *   rc_meal_plan_items -> rc_meal_plan_items (same prefix in both)
 *
 * Garden (gd_*) and event (ev_*) tables are no longer owned by the recipes module
 * (dropped in V7). Garden data is owned by modules/garden, events by modules/rsvp.
 */
export function importFromMyRecipes(
  sourceDb: DatabaseAdapter,
  hubDb: DatabaseAdapter,
): RecipesImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let recipesImported = 0;
  let ingredientsImported = 0;
  let stepsImported = 0;
  let tagsImported = 0;
  let collectionsImported = 0;
  let groceryListsImported = 0;
  let groceryItemsImported = 0;
  let mealPlansImported = 0;
  let mealPlanItemsImported = 0;
  let settingsImported = 0;

  hubDb.transaction(() => {
    // 1. Import recipes
    // Standalone: recipes(id, title, description, prep_time_min, cook_time_min, total_time_min,
    //   servings, yield_text, source_url, source_name, image_path, is_favorite, rating, notes, ...)
    // Hub: rc_recipes(id, title, description, servings, prep_time_mins, cook_time_mins,
    //   total_time_mins, difficulty, source_url, image_uri, is_favorite, rating, notes, ...)
    const recipes = sourceDb.query<Record<string, unknown>>('SELECT * FROM recipes');
    for (const r of recipes) {
      try {
        // Map standalone column names to hub column names
        // Standalone uses prep_time_min, hub uses prep_time_mins
        // Standalone uses image_path, hub uses image_uri
        // Standalone has yield_text and source_name which hub doesn't have
        const rating = (r.rating as number | null) ?? 0;

        hubDb.execute(
          `INSERT OR IGNORE INTO rc_recipes (id, title, description, servings, prep_time_mins, cook_time_mins, total_time_mins, source_url, image_uri, is_favorite, rating, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.title, r.description, r.servings, r.prep_time_min, r.cook_time_min, r.total_time_min, r.source_url, r.image_path, r.is_favorite, rating, r.notes, r.created_at, r.updated_at],
        );
        recipesImported++;

        if (r.yield_text) {
          warnings.push(`Recipe "${r.title}": yield_text "${r.yield_text}" not preserved (hub has no equivalent field).`);
        }
        if (r.source_name) {
          warnings.push(`Recipe "${r.title}": source_name "${r.source_name}" not preserved (hub has no equivalent field).`);
        }
      } catch (e) {
        errors.push(`Recipe ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. Import ingredients
    // Standalone: ingredients(id, recipe_id, section, quantity, unit, item, prep_note, is_optional, sort_order)
    // Hub: rc_ingredients(id, recipe_id, name, quantity, unit, sort_order)
    const ingredients = sourceDb.query<Record<string, unknown>>('SELECT * FROM ingredients');
    for (const ing of ingredients) {
      try {
        // Hub uses "name" instead of "item"; combine item + prep_note for the name
        let name = ing.item as string;
        if (ing.prep_note) {
          name = `${name}, ${ing.prep_note}`;
        }
        if (ing.section) {
          // Prefix with section info if present
          warnings.push(
            `Ingredient "${name}" in recipe ${ing.recipe_id}: section "${ing.section}" not preserved as separate field.`,
          );
        }
        // Hub stores quantity as TEXT, standalone as REAL
        const quantity = ing.quantity != null ? String(ing.quantity) : null;

        hubDb.execute(
          `INSERT OR IGNORE INTO rc_ingredients (id, recipe_id, name, quantity, unit, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ing.id, ing.recipe_id, name, quantity, ing.unit, ing.sort_order],
        );
        ingredientsImported++;

        if ((ing.is_optional as number) === 1) {
          warnings.push(`Ingredient "${name}": is_optional flag not preserved (hub has no equivalent field).`);
        }
      } catch (e) {
        errors.push(`Ingredient ${ing.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Import steps
    // Standalone: steps(id, recipe_id, section, step_number, instruction, timer_minutes, sort_order)
    // Hub: rc_steps(id, recipe_id, step_number, instruction, timer_minutes, sort_order)
    const steps = sourceDb.query<Record<string, unknown>>('SELECT * FROM steps');
    for (const s of steps) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO rc_steps (id, recipe_id, step_number, instruction, timer_minutes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [s.id, s.recipe_id, s.step_number, s.instruction, s.timer_minutes, s.sort_order],
        );
        stepsImported++;

        if (s.section) {
          warnings.push(
            `Step ${s.step_number} in recipe ${s.recipe_id}: section "${s.section}" not preserved.`,
          );
        }
      } catch (e) {
        errors.push(`Step ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Import tags
    // Standalone uses a normalized tag system: tags(id, name, type, color) + recipe_tags(recipe_id, tag_id)
    // Hub uses inline tags: rc_recipe_tags(id, recipe_id, tag)
    // We need to join and flatten.
    try {
      const tagMap = new Map<string, string>();
      const tagRows = sourceDb.query<Record<string, unknown>>('SELECT * FROM tags');
      for (const t of tagRows) {
        tagMap.set(t.id as string, t.name as string);
      }

      const recipeTags = sourceDb.query<Record<string, unknown>>('SELECT * FROM recipe_tags');
      let tagId = 0;
      for (const rt of recipeTags) {
        try {
          const tagName = tagMap.get(rt.tag_id as string);
          if (!tagName) {
            warnings.push(`RecipeTag: tag_id "${rt.tag_id}" not found in tags table, skipping.`);
            continue;
          }

          // Generate a unique ID for the hub rc_recipe_tags row
          const hubTagId = `imported-tag-${++tagId}`;
          hubDb.execute(
            'INSERT OR IGNORE INTO rc_recipe_tags (id, recipe_id, tag) VALUES (?, ?, ?)',
            [hubTagId, rt.recipe_id, tagName],
          );
          tagsImported++;
        } catch (e) {
          errors.push(`RecipeTag: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Tags table may not exist
    }

    // 5. Import collections (warning -- hub rc_ schema does not have collections)
    try {
      const collections = sourceDb.query<Record<string, unknown>>('SELECT * FROM collections');
      collectionsImported = collections.length;
      if (collectionsImported > 0) {
        warnings.push(
          `${collectionsImported} collection(s) skipped. Hub recipe module does not have a collections table.`,
        );
      }
    } catch {
      // Table may not exist
    }

    // 6. Import grocery lists (warning -- hub rc_ schema does not have grocery tables)
    try {
      const groceryLists = sourceDb.query<Record<string, unknown>>('SELECT * FROM grocery_lists');
      groceryListsImported = groceryLists.length;
      if (groceryListsImported > 0) {
        warnings.push(
          `${groceryListsImported} grocery list(s) skipped. Hub recipe module does not have grocery tables.`,
        );
      }
    } catch {
      // Table may not exist
    }

    try {
      const groceryItems = sourceDb.query<Record<string, unknown>>('SELECT * FROM grocery_items');
      groceryItemsImported = groceryItems.length;
    } catch {
      // Table may not exist
    }

    // 7. Import preferences as settings
    // Standalone: preferences(key, value) -> Hub: rc_settings(key, value)
    try {
      const prefs = sourceDb.query<Record<string, unknown>>('SELECT * FROM preferences');
      for (const p of prefs) {
        try {
          hubDb.execute(
            'INSERT OR IGNORE INTO rc_settings (key, value) VALUES (?, ?)',
            [p.key, p.value],
          );
          settingsImported++;
        } catch (e) {
          errors.push(`Preference ${p.key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 8. Import meal plans (same prefix in standalone and hub)
    try {
      const mealPlans = sourceDb.query<Record<string, unknown>>('SELECT * FROM rc_meal_plans');
      for (const mp of mealPlans) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO rc_meal_plans (id, week_start_date, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
            [mp.id, mp.week_start_date, mp.created_at, mp.updated_at],
          );
          mealPlansImported++;
        } catch (e) {
          errors.push(`MealPlan ${mp.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 9. Import meal plan items
    try {
      const mealPlanItems = sourceDb.query<Record<string, unknown>>('SELECT * FROM rc_meal_plan_items');
      for (const mpi of mealPlanItems) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO rc_meal_plan_items (id, meal_plan_id, recipe_id, day_of_week, meal_slot, servings, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [mpi.id, mpi.meal_plan_id, mpi.recipe_id, mpi.day_of_week, mpi.meal_slot, mpi.servings, mpi.created_at, mpi.updated_at],
          );
          mealPlanItemsImported++;
        } catch (e) {
          errors.push(`MealPlanItem ${mpi.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // Garden (gd_*) and event (ev_*) tables dropped in recipes V7.
    // Data now owned by modules/garden and modules/rsvp respectively.
  });

  return {
    recipesImported,
    ingredientsImported,
    stepsImported,
    tagsImported,
    collectionsImported,
    groceryListsImported,
    groceryItemsImported,
    mealPlansImported,
    mealPlanItemsImported,
    settingsImported,
    errors,
    warnings,
  };
}

// Garden (gd_*) and event (ev_*) import functions removed.
// V7 drops these tables from the recipes module.
// Garden data is owned by modules/garden, events by modules/rsvp.
