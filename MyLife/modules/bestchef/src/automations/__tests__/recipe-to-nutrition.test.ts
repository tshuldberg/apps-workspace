/**
 * Integration tests for the recipe-to-nutrition automation rule (Phase 5-core).
 *
 * Verifies that apply() atomically writes to the nutrition food log, pantry,
 * and hub_automation_log — all inside a single db.transaction() that rolls
 * back cleanly on any sub-write failure.
 *
 * Schema reality: per-serving macros come from a runtime join of
 * rc_nutrition_data + rc_pantry_items + rc_ingredients via fuzzy match
 * (see calculateRecipeNutrition). Tests seed all three tables so that the
 * engine returns non-zero macros.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { recipeToNutritionRule } from '../recipe-to-nutrition';
import type {
  RecipeCookedInput,
  RecipeCookedPreviewState,
} from '../recipe-to-nutrition';

// Minimal subset of the nutrition schema needed for these tests. The real
// module definition can't be imported cross-package because tsc's rootDir
// binds to this module's src. We only need the two tables the rule writes
// into (nu_food_log + nu_food_log_items) plus their FK target (nu_foods).
const NU_FOODS = `
CREATE TABLE IF NOT EXISTS nu_foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    serving_size REAL NOT NULL,
    serving_unit TEXT NOT NULL,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    fiber_g REAL NOT NULL DEFAULT 0,
    sugar_g REAL NOT NULL DEFAULT 0,
    sodium_mg REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('usda', 'open_food_facts', 'fatsecret', 'custom', 'ai_photo')),
    barcode TEXT,
    usda_ndb_number TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;
const NU_FOOD_LOG = `
CREATE TABLE IF NOT EXISTS nu_food_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;
const NU_FOOD_LOG_ITEMS = `
CREATE TABLE IF NOT EXISTS nu_food_log_items (
    id TEXT PRIMARY KEY,
    log_id TEXT NOT NULL REFERENCES nu_food_log(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL REFERENCES nu_foods(id) ON DELETE CASCADE,
    serving_count REAL NOT NULL DEFAULT 1,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0
)`;

interface SeedOptions {
  withNutrition?: boolean; // rc_nutrition_data seeded?
  withPantry?: boolean;    // rc_pantry_items seeded?
  recipeId?: string;
}

function seedRecipe(
  adapter: DatabaseAdapter,
  opts: SeedOptions = {},
): string {
  const recipeId = opts.recipeId ?? 'recipe-1';
  adapter.execute(
    `INSERT INTO rc_recipes (id, title, servings, is_favorite, rating)
     VALUES (?, ?, ?, 0, 0)`,
    [recipeId, 'Spaghetti Bolognese', 2],
  );
  // Two ingredients with quantity_value for deduction math.
  adapter.execute(
    `INSERT INTO rc_ingredients
      (id, recipe_id, name, item, quantity_value, quantity, unit, sort_order, is_optional)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ['ing-1', recipeId, 'spaghetti', 'spaghetti', 200, '200', 'g', 0],
  );
  adapter.execute(
    `INSERT INTO rc_ingredients
      (id, recipe_id, name, item, quantity_value, quantity, unit, sort_order, is_optional)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ['ing-2', recipeId, 'ground beef', 'ground beef', 300, '300', 'g', 1],
  );

  if (opts.withPantry) {
    adapter.execute(
      `INSERT INTO rc_pantry_items
        (id, name, quantity, unit, storage_location, grocery_section)
       VALUES (?, ?, ?, ?, 'pantry', 'pantry')`,
      ['pantry-1', 'spaghetti', 500, 'g'],
    );
    adapter.execute(
      `INSERT INTO rc_pantry_items
        (id, name, quantity, unit, storage_location, grocery_section)
       VALUES (?, ?, ?, ?, 'fridge', 'meat')`,
      ['pantry-2', 'ground beef', 1000, 'g'],
    );
  }

  if (opts.withNutrition && opts.withPantry) {
    // Per-unit nutrition data anchored to pantry items. The engine scales by
    // ingredient.quantity_value (a scalar) during summation.
    adapter.execute(
      `INSERT INTO rc_nutrition_data
        (id, pantry_item_id, calories, fat_g, carbs_g, protein_g, source)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
      ['nd-1', 'pantry-1', 2, 0.05, 0.4, 0.07],
    );
    adapter.execute(
      `INSERT INTO rc_nutrition_data
        (id, pantry_item_id, calories, fat_g, carbs_g, protein_g, source)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
      ['nd-2', 'pantry-2', 2.5, 0.15, 0, 0.2],
    );
  }

  return recipeId;
}

function makeInput(overrides: Partial<RecipeCookedInput> = {}): RecipeCookedInput {
  return {
    recipeId: 'recipe-1',
    servingsCooked: 1,
    cookedAt: '2026-04-18T19:30:00.000Z',
    ...overrides,
  };
}

/** Drop nu_* tables from a hub DB so tableExists('nu_food_log') returns false.
 *  Children before parents so FK constraints don't block the drops. */
function dropNutritionTables(adapter: DatabaseAdapter): void {
  adapter.execute('DROP TABLE IF EXISTS nu_food_log_items');
  adapter.execute('DROP TABLE IF EXISTS nu_food_log');
  adapter.execute('DROP TABLE IF EXISTS nu_foods');
}

/** Drop rc_pantry_items so tableExists('rc_pantry_items') returns false. */
function dropPantryTables(adapter: DatabaseAdapter): void {
  adapter.execute(`DROP TABLE IF EXISTS rc_pantry_items`);
  adapter.execute(`DROP TABLE IF EXISTS rc_pantry_staples`);
}

/**
 * Build a test DB that has BOTH recipes migrations AND nutrition migrations
 * applied, so a single adapter can host both modules' tables. The parity
 * helper runs module migrations but only for one module at a time, so we
 * run them both manually.
 */
function createDualModuleDb(): { adapter: DatabaseAdapter; close: () => void } {
  const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
  // Overlay just the nutrition tables the rule writes into. We do this inline
  // instead of re-running @mylife/nutrition's migrations because tsc's
  // per-package rootDir forbids cross-package source imports.
  testDb.adapter.execute(NU_FOODS);
  testDb.adapter.execute(NU_FOOD_LOG);
  testDb.adapter.execute(NU_FOOD_LOG_ITEMS);
  return { adapter: testDb.adapter, close: testDb.close };
}

describe('recipeToNutritionRule', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createDualModuleDb();
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ---------------------------------------------------------------------------
  // check()
  // ---------------------------------------------------------------------------

  describe('check()', () => {
    it('returns a preview state for a valid cooked-recipe event', () => {
      seedRecipe(adapter, { withNutrition: true, withPantry: true });
      const state = recipeToNutritionRule.check(adapter, makeInput());
      expect(state).not.toBeNull();
      expect(state?.recipeId).toBe('recipe-1');
      expect(state?.servingsCooked).toBe(1);
      expect(state?.scaledMacros.calories).not.toBeNull();
      expect(state?.scaledMacros.calories).toBeGreaterThan(0);
      expect(state?.deduction.deducted.length).toBeGreaterThan(0);
    });

    it('returns null when the recipe does not exist', () => {
      // Recipe never inserted.
      const state = recipeToNutritionRule.check(
        adapter,
        makeInput({ recipeId: 'does-not-exist' }),
      );
      expect(state).toBeNull();
    });

    it('returns null when the recipe has no nutrition data AND no pantry module', () => {
      // Seed recipe + ingredients only. Drop pantry and nutrition so neither
      // side of the rule has anything to do.
      seedRecipe(adapter, { withNutrition: false, withPantry: false });
      // Also drop the pantry items table so tableExists returns false.
      dropPantryTables(adapter);
      dropNutritionTables(adapter);
      const state = recipeToNutritionRule.check(adapter, makeInput());
      expect(state).toBeNull();
    });

    it('returns null when servingsCooked is zero or negative', () => {
      seedRecipe(adapter, { withNutrition: true, withPantry: true });
      expect(
        recipeToNutritionRule.check(adapter, makeInput({ servingsCooked: 0 })),
      ).toBeNull();
      expect(
        recipeToNutritionRule.check(adapter, makeInput({ servingsCooked: -1 })),
      ).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // previewCard()
  // ---------------------------------------------------------------------------

  describe('previewCard()', () => {
    it('formats subtitle as "<N> calories, <P>g protein. Decrements X pantry items."', () => {
      const state: RecipeCookedPreviewState = {
        recipeId: 'recipe-1',
        recipeTitle: 'Spaghetti',
        servingsCooked: 1,
        cookedAt: '2026-04-18T19:30:00.000Z',
        scaledMacros: {
          calories: 520.4,
          fat_g: 18,
          saturated_fat_g: null,
          carbs_g: 60,
          fiber_g: null,
          sugar_g: null,
          protein_g: 32.6,
          sodium_mg: null,
        },
        nutritionSummary: {
          recipeId: 'recipe-1',
          servings: 2,
          perServing: {
            calories: 260.2,
            fat_g: 9,
            saturated_fat_g: null,
            carbs_g: 30,
            fiber_g: null,
            sugar_g: null,
            protein_g: 16.3,
            sodium_mg: null,
          },
          total: {
            calories: 520.4,
            fat_g: 18,
            saturated_fat_g: null,
            carbs_g: 60,
            fiber_g: null,
            sugar_g: null,
            protein_g: 32.6,
            sodium_mg: null,
          },
          coverage: 1,
          coveragePercent: 100,
          missingIngredients: [],
          conversionConfidence: 1,
          lowConfidenceIngredients: [],
          lowConfidenceWarnings: [],
          missingIngredientDetails: [],
          ambiguousConversions: [],
          sourceBreakdown: [
            {
              source: 'manual',
              label: 'Manual entry',
              sourceId: null,
              count: 2,
              confidence: 1,
              confirmedCount: 2,
            },
          ],
          missingFields: [
            { key: 'saturated_fat_g', label: 'Saturated fat' },
            { key: 'fiber_g', label: 'Dietary fiber' },
            { key: 'sugar_g', label: 'Total sugars' },
            { key: 'added_sugar_g', label: 'Added sugars' },
            { key: 'sodium_mg', label: 'Sodium' },
          ],
          ingredientConversions: [],
        },
        deduction: {
          deducted: [
            {
              pantryItemId: 'pantry-1',
              pantryItemName: 'spaghetti',
              ingredientItem: 'spaghetti',
              previousQuantity: 500,
              newQuantity: 300,
              removed: false,
            },
            {
              pantryItemId: 'pantry-2',
              pantryItemName: 'ground beef',
              ingredientItem: 'ground beef',
              previousQuantity: 1000,
              newQuantity: 700,
              removed: false,
            },
          ],
          unmatched: [],
        },
        hasNutritionModule: true,
        hasPantryModule: true,
      };
      const card = recipeToNutritionRule.previewCard(state);
      expect(card.title).toBe('Log this meal?');
      expect(card.subtitle).toBe(
        '520 calories, 33g protein. Decrements 2 pantry items.',
      );
      expect(card.cta.apply).toBe('Log + decrement');
      expect(card.cta.dismiss).toBe('Skip');
    });
  });

  // ---------------------------------------------------------------------------
  // apply()
  // ---------------------------------------------------------------------------

  describe('apply()', () => {
    it('atomically writes to nu_food_log, rc_pantry_items, and hub_automation_log', () => {
      seedRecipe(adapter, { withNutrition: true, withPantry: true });
      const state = recipeToNutritionRule.check(adapter, makeInput())!;
      const result = recipeToNutritionRule.apply(adapter, state);

      // 1. nu_food_log parent row
      expect(result.foodLogId).not.toBeNull();
      const logs = adapter.query<{ id: string; date: string }>(
        `SELECT id, date FROM nu_food_log WHERE id = ?`,
        [result.foodLogId],
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]!.date).toBe('2026-04-18');

      // 1a. nu_food_log_items children
      const items = adapter.query<{ calories: number }>(
        `SELECT calories FROM nu_food_log_items WHERE log_id = ?`,
        [result.foodLogId],
      );
      expect(items.length).toBeGreaterThan(0);

      // 2. rc_pantry_items decremented
      expect(result.pantryItemsDecremented).toBeGreaterThan(0);
      const spag = adapter.query<{ quantity: number }>(
        `SELECT quantity FROM rc_pantry_items WHERE id = ?`,
        ['pantry-1'],
      );
      // Started at 500g, recipe needs 200g × 1 serving → 300g left.
      expect(spag[0]!.quantity).toBe(300);

      // 3. hub_automation_log row
      const audit = adapter.query<{ rule_id: string; outcome: string }>(
        `SELECT rule_id, outcome FROM hub_automation_log WHERE id = ?`,
        [result.auditEntryId],
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]!.rule_id).toBe('recipe-to-nutrition');
      expect(audit[0]!.outcome).toBe('applied');
    });

    it('rolls back all writes when an inner write fails', () => {
      seedRecipe(adapter, { withNutrition: true, withPantry: true });
      const state = recipeToNutritionRule.check(adapter, makeInput())!;
      // Force the pantry UPDATE to fail by pointing a deduction at a row
      // that violates a NOT NULL / CHECK via an invalid column mutation.
      // Simpler approach: drop nu_food_log_items AFTER check() captured
      // state, so apply()'s INSERT explodes inside the transaction.
      adapter.execute('DROP TABLE nu_food_log_items');

      expect(() => recipeToNutritionRule.apply(adapter, state)).toThrow();

      // Nothing persisted to any of the 3 tables.
      const logCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM nu_food_log`,
      )[0]!.c;
      expect(logCount).toBe(0);

      const auditCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_automation_log WHERE rule_id = ?`,
        ['recipe-to-nutrition'],
      )[0]!.c;
      expect(auditCount).toBe(0);

      // Pantry quantity unchanged.
      const spag = adapter.query<{ quantity: number }>(
        `SELECT quantity FROM rc_pantry_items WHERE id = ?`,
        ['pantry-1'],
      );
      expect(spag[0]!.quantity).toBe(500);
    });

    it('still runs (pantry-only path) when the nutrition module is missing', () => {
      seedRecipe(adapter, { withNutrition: false, withPantry: true });
      dropNutritionTables(adapter);

      const state = recipeToNutritionRule.check(adapter, makeInput())!;
      expect(state.hasNutritionModule).toBe(false);
      expect(state.hasPantryModule).toBe(true);

      const result = recipeToNutritionRule.apply(adapter, state);
      expect(result.foodLogId).toBeNull();
      expect(result.pantryItemsDecremented).toBeGreaterThan(0);

      // Audit row still written.
      const audit = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_automation_log WHERE rule_id = ?`,
        ['recipe-to-nutrition'],
      )[0]!.c;
      expect(audit).toBe(1);
    });
  });
});
