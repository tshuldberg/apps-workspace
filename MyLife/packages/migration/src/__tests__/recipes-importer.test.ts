import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { importFromMyRecipes } from '../importers/recipes';

// Standalone MyRecipes DDL (unprefixed tables)
const STANDALONE_DDL = [
  `CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    prep_time_min INTEGER,
    cook_time_min INTEGER,
    total_time_min INTEGER,
    servings INTEGER,
    yield_text TEXT,
    source_url TEXT,
    source_name TEXT,
    image_path TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    section TEXT,
    quantity REAL,
    unit TEXT,
    item TEXT NOT NULL,
    prep_note TEXT,
    is_optional INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    section TEXT,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    timer_minutes INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'custom',
    color TEXT
  )`,
  `CREATE TABLE recipe_tags (
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
  )`,
  `CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_recipe_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE recipe_collections (
    recipe_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (recipe_id, collection_id)
  )`,
  `CREATE TABLE grocery_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Shopping List',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE grocery_items (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
    recipe_id TEXT,
    section TEXT NOT NULL DEFAULT 'other',
    item TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    is_checked INTEGER NOT NULL DEFAULT 0,
    is_pantry_staple INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE rc_meal_plans (
    id TEXT PRIMARY KEY,
    week_start_date TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE rc_meal_plan_items (
    id TEXT PRIMARY KEY,
    meal_plan_id TEXT NOT NULL REFERENCES rc_meal_plans(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (meal_plan_id, day_of_week, meal_slot)
  )`,
  `CREATE TABLE gd_plants (
    id TEXT PRIMARY KEY,
    species TEXT NOT NULL,
    location TEXT NOT NULL,
    planting_date TEXT NOT NULL,
    watering_interval_days INTEGER NOT NULL DEFAULT 3,
    last_watered_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE gd_plant_care_logs (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES gd_plants(id) ON DELETE CASCADE,
    care_type TEXT NOT NULL,
    performed_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE gd_garden_layouts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grid_width INTEGER NOT NULL DEFAULT 8,
    grid_height INTEGER NOT NULL DEFAULT 8,
    cells_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE gd_garden_journal (
    id TEXT PRIMARY KEY,
    plant_id TEXT,
    photo_path TEXT NOT NULL,
    note TEXT,
    identified_species TEXT,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE gd_harvests (
    id TEXT PRIMARY KEY,
    plant_id TEXT,
    item_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    harvested_at TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE gd_harvest_recipe_links (
    id TEXT PRIMARY KEY,
    harvest_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    match_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE ev_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    location TEXT,
    description TEXT,
    capacity INTEGER,
    invite_token TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE ev_guests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    dietary_preferences TEXT,
    allergies TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE ev_rsvps (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    response TEXT NOT NULL,
    note TEXT,
    responded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, guest_id)
  )`,
  `CREATE TABLE ev_menu_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    course TEXT NOT NULL,
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE ev_potluck_claims (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    dish_name TEXT NOT NULL,
    note TEXT,
    claimed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE ev_event_timeline (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    label TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

// Hub DDL for recipes tables (rc_ prefix + garden/event tables)
const HUB_DDL = [
  `CREATE TABLE IF NOT EXISTS rc_recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    servings INTEGER,
    prep_time_mins INTEGER,
    cook_time_mins INTEGER,
    total_time_mins INTEGER,
    difficulty TEXT,
    source_url TEXT,
    image_uri TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    rating INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS rc_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS rc_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    timer_minutes INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS rc_recipe_tags (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    tag TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rc_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rc_meal_plans (
    id TEXT PRIMARY KEY,
    week_start_date TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS rc_meal_plan_items (
    id TEXT PRIMARY KEY,
    meal_plan_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    meal_slot TEXT NOT NULL,
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (meal_plan_id, day_of_week, meal_slot)
  )`,
  `CREATE TABLE IF NOT EXISTS gd_plants (
    id TEXT PRIMARY KEY,
    species TEXT NOT NULL,
    location TEXT NOT NULL,
    planting_date TEXT NOT NULL,
    watering_interval_days INTEGER NOT NULL DEFAULT 3,
    last_watered_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gd_plant_care_logs (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL,
    care_type TEXT NOT NULL,
    performed_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gd_garden_layouts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grid_width INTEGER NOT NULL DEFAULT 8,
    grid_height INTEGER NOT NULL DEFAULT 8,
    cells_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gd_garden_journal (
    id TEXT PRIMARY KEY,
    plant_id TEXT,
    photo_path TEXT NOT NULL,
    note TEXT,
    identified_species TEXT,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gd_harvests (
    id TEXT PRIMARY KEY,
    plant_id TEXT,
    item_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    harvested_at TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gd_harvest_recipe_links (
    id TEXT PRIMARY KEY,
    harvest_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    match_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ev_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    location TEXT,
    description TEXT,
    capacity INTEGER,
    invite_token TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ev_guests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    dietary_preferences TEXT,
    allergies TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ev_rsvps (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    response TEXT NOT NULL,
    note TEXT,
    responded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, guest_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ev_menu_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    course TEXT NOT NULL,
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ev_potluck_claims (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    dish_name TEXT NOT NULL,
    note TEXT,
    claimed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ev_event_timeline (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    label TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

describe('importFromMyRecipes', () => {
  let sourceDb: InMemoryTestDatabase;
  let hubDb: InMemoryTestDatabase;

  beforeEach(() => {
    sourceDb = createInMemoryTestDatabase();
    hubDb = createInMemoryTestDatabase();
    for (const ddl of STANDALONE_DDL) {
      sourceDb.adapter.execute(ddl);
    }
    for (const ddl of HUB_DDL) {
      hubDb.adapter.execute(ddl);
    }
  });

  afterEach(() => {
    sourceDb.close();
    hubDb.close();
  });

  it('imports recipes with field name mapping', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title, description, prep_time_min, cook_time_min, total_time_min, servings, source_url, image_path, is_favorite, rating, notes)
       VALUES ('r1', 'Pasta Carbonara', 'Classic Italian pasta', 10, 20, 30, 4, 'https://example.com/recipe', '/photos/carbonara.jpg', 1, 5, 'Family favorite')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.recipesImported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const recipes = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM rc_recipes');
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.title).toBe('Pasta Carbonara');
    expect(recipes[0]!.prep_time_mins).toBe(10);
    expect(recipes[0]!.cook_time_mins).toBe(20);
    expect(recipes[0]!.image_uri).toBe('/photos/carbonara.jpg');
    expect(recipes[0]!.is_favorite).toBe(1);
    expect(recipes[0]!.rating).toBe(5);
  });

  it('warns about yield_text and source_name loss', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title, yield_text, source_name)
       VALUES ('r1', 'Bread', '2 loaves', 'Grandma')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.recipesImported).toBe(1);
    expect(result.warnings.some(w => w.includes('yield_text'))).toBe(true);
    expect(result.warnings.some(w => w.includes('source_name'))).toBe(true);
  });

  it('imports ingredients with item-to-name mapping', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title) VALUES ('r1', 'Test Recipe')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO ingredients (id, recipe_id, quantity, unit, item, prep_note, sort_order)
       VALUES ('i1', 'r1', 2.0, 'cups', 'flour', 'sifted', 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO ingredients (id, recipe_id, quantity, unit, item, is_optional, sort_order)
       VALUES ('i2', 'r1', 1.0, 'tsp', 'vanilla extract', 1, 1)`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.ingredientsImported).toBe(2);

    const ings = hubDb.adapter.query<Record<string, unknown>>(
      'SELECT * FROM rc_ingredients ORDER BY sort_order',
    );
    expect(ings).toHaveLength(2);
    // Should combine item + prep_note
    expect(ings[0]!.name).toBe('flour, sifted');
    expect(ings[0]!.quantity).toBe('2');
    // Optional ingredient should generate a warning
    expect(result.warnings.some(w => w.includes('is_optional'))).toBe(true);
  });

  it('imports steps', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title) VALUES ('r1', 'Test Recipe')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO steps (id, recipe_id, step_number, instruction, timer_minutes, sort_order)
       VALUES ('s1', 'r1', 1, 'Preheat oven to 350F', NULL, 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO steps (id, recipe_id, step_number, instruction, timer_minutes, sort_order)
       VALUES ('s2', 'r1', 2, 'Bake for 25 minutes', 25, 1)`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.stepsImported).toBe(2);

    const steps = hubDb.adapter.query<Record<string, unknown>>(
      'SELECT * FROM rc_steps ORDER BY sort_order',
    );
    expect(steps).toHaveLength(2);
    expect(steps[1]!.timer_minutes).toBe(25);
  });

  it('flattens normalized tags into inline tags', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title) VALUES ('r1', 'Pad Thai')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO tags (id, name, type) VALUES ('t1', 'Thai', 'cuisine')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO tags (id, name, type) VALUES ('t2', 'Dinner', 'meal_type')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ('r1', 't1')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ('r1', 't2')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.tagsImported).toBe(2);

    const hubTags = hubDb.adapter.query<Record<string, unknown>>(
      "SELECT * FROM rc_recipe_tags WHERE recipe_id = 'r1'",
    );
    expect(hubTags).toHaveLength(2);
    const tagNames = hubTags.map(t => t.tag);
    expect(tagNames).toContain('Thai');
    expect(tagNames).toContain('Dinner');
  });

  it('warns about collections not being imported', () => {
    sourceDb.adapter.execute(
      `INSERT INTO collections (id, name) VALUES ('col1', 'Quick Meals')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.collectionsImported).toBe(1);
    expect(result.warnings.some(w => w.includes('collection'))).toBe(true);
  });

  it('warns about grocery lists not being imported', () => {
    sourceDb.adapter.execute(
      `INSERT INTO grocery_lists (id, name) VALUES ('gl1', 'Weekly Shopping')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO grocery_items (id, list_id, item) VALUES ('gi1', 'gl1', 'Milk')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.groceryListsImported).toBe(1);
    expect(result.groceryItemsImported).toBe(1);
    expect(result.warnings.some(w => w.includes('grocery'))).toBe(true);
  });

  it('imports preferences as settings', () => {
    sourceDb.adapter.execute(
      `INSERT INTO preferences (key, value) VALUES ('defaultServings', '6')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.settingsImported).toBe(1);
    const settings = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM rc_settings');
    expect(settings).toHaveLength(1);
    expect(settings[0]!.value).toBe('6');
  });

  it('imports meal plans and items', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title) VALUES ('r1', 'Test Recipe')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO rc_meal_plans (id, week_start_date) VALUES ('mp1', '2025-01-06')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO rc_meal_plan_items (id, meal_plan_id, recipe_id, day_of_week, meal_slot, servings)
       VALUES ('mpi1', 'mp1', 'r1', 0, 'dinner', 4)`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.mealPlansImported).toBe(1);
    expect(result.mealPlanItemsImported).toBe(1);

    const plans = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM rc_meal_plans');
    expect(plans).toHaveLength(1);

    const items = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM rc_meal_plan_items');
    expect(items).toHaveLength(1);
    expect(items[0]!.meal_slot).toBe('dinner');
  });

  // Garden and event import tests removed: V7 drops gd_*/ev_* tables from recipes.
  // Garden data is now owned by modules/garden, events by modules/rsvp.

  it('handles empty source database gracefully', () => {
    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.recipesImported).toBe(0);
    expect(result.ingredientsImported).toBe(0);
    expect(result.stepsImported).toBe(0);
    expect(result.tagsImported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('imports multiple recipes with all related data', () => {
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title, servings) VALUES ('r1', 'Pancakes', 4)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO recipes (id, title, servings) VALUES ('r2', 'Waffles', 6)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO ingredients (id, recipe_id, item, sort_order) VALUES ('i1', 'r1', 'flour', 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO ingredients (id, recipe_id, item, sort_order) VALUES ('i2', 'r1', 'eggs', 1)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO ingredients (id, recipe_id, item, sort_order) VALUES ('i3', 'r2', 'flour', 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO steps (id, recipe_id, step_number, instruction) VALUES ('s1', 'r1', 1, 'Mix')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO steps (id, recipe_id, step_number, instruction) VALUES ('s2', 'r2', 1, 'Mix')`,
    );

    const result = importFromMyRecipes(sourceDb.adapter, hubDb.adapter);

    expect(result.recipesImported).toBe(2);
    expect(result.ingredientsImported).toBe(3);
    expect(result.stepsImported).toBe(2);
    expect(result.errors).toHaveLength(0);

    const hubRecipes = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM rc_recipes');
    expect(hubRecipes).toHaveLength(2);
  });
});
