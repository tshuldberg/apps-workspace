/**
 * SQLite schema for MyRecipes module.
 * All table names use the rc_ prefix to avoid collisions in the shared hub database.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 */

// -- 1. Recipes --
export const CREATE_RECIPES = `
CREATE TABLE IF NOT EXISTS rc_recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    servings INTEGER,
    prep_time_mins INTEGER,
    cook_time_mins INTEGER,
    total_time_mins INTEGER,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    source_url TEXT,
    image_uri TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    rating INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 2. Ingredients --
export const CREATE_INGREDIENTS = `
CREATE TABLE IF NOT EXISTS rc_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
)`;

// -- 3. Recipe Tags --
export const CREATE_RECIPE_TAGS = `
CREATE TABLE IF NOT EXISTS rc_recipe_tags (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL
)`;

// -- 4. Settings --
export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS rc_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)`;

export const CREATE_STEPS = `
CREATE TABLE IF NOT EXISTS rc_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    timer_minutes INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
)`;

export const CREATE_RC_MEAL_PLANS = `
CREATE TABLE IF NOT EXISTS rc_meal_plans (
    id TEXT PRIMARY KEY,
    week_start_date TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_MEAL_PLAN_ITEMS = `
CREATE TABLE IF NOT EXISTS rc_meal_plan_items (
    id TEXT PRIMARY KEY,
    meal_plan_id TEXT NOT NULL REFERENCES rc_meal_plans(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (meal_plan_id, day_of_week, meal_slot)
)`;

export const CREATE_GD_PLANTS = `
CREATE TABLE IF NOT EXISTS gd_plants (
    id TEXT PRIMARY KEY,
    species TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('indoor', 'outdoor', 'raised_bed', 'container')),
    planting_date TEXT NOT NULL,
    watering_interval_days INTEGER NOT NULL DEFAULT 3,
    last_watered_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GD_PLANT_CARE_LOGS = `
CREATE TABLE IF NOT EXISTS gd_plant_care_logs (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES gd_plants(id) ON DELETE CASCADE,
    care_type TEXT NOT NULL CHECK (care_type IN ('watered', 'fertilized', 'pruned', 'repotted', 'note')),
    performed_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GD_GARDEN_LAYOUTS = `
CREATE TABLE IF NOT EXISTS gd_garden_layouts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grid_width INTEGER NOT NULL DEFAULT 8,
    grid_height INTEGER NOT NULL DEFAULT 8,
    cells_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GD_GARDEN_JOURNAL = `
CREATE TABLE IF NOT EXISTS gd_garden_journal (
    id TEXT PRIMARY KEY,
    plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
    photo_path TEXT NOT NULL,
    note TEXT,
    identified_species TEXT,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GD_HARVESTS = `
CREATE TABLE IF NOT EXISTS gd_harvests (
    id TEXT PRIMARY KEY,
    plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    harvested_at TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GD_HARVEST_RECIPE_LINKS = `
CREATE TABLE IF NOT EXISTS gd_harvest_recipe_links (
    id TEXT PRIMARY KEY,
    harvest_id TEXT NOT NULL REFERENCES gd_harvests(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    match_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EV_EVENTS = `
CREATE TABLE IF NOT EXISTS ev_events (
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
)`;

export const CREATE_EV_GUESTS = `
CREATE TABLE IF NOT EXISTS ev_guests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES ev_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact TEXT,
    dietary_preferences TEXT,
    allergies TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EV_RSVPS = `
CREATE TABLE IF NOT EXISTS ev_rsvps (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES ev_events(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL REFERENCES ev_guests(id) ON DELETE CASCADE,
    response TEXT NOT NULL CHECK (response IN ('attending', 'maybe', 'declined')),
    note TEXT,
    responded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, guest_id)
)`;

export const CREATE_EV_MENU_ITEMS = `
CREATE TABLE IF NOT EXISTS ev_menu_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES ev_events(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    course TEXT NOT NULL CHECK (course IN ('appetizer', 'main', 'side', 'dessert', 'drink')),
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EV_POTLUCK_CLAIMS = `
CREATE TABLE IF NOT EXISTS ev_potluck_claims (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES ev_events(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL REFERENCES ev_guests(id) ON DELETE CASCADE,
    dish_name TEXT NOT NULL,
    note TEXT,
    claimed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EV_EVENT_TIMELINE = `
CREATE TABLE IF NOT EXISTS ev_event_timeline (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES ev_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const ALTER_RC_INGREDIENTS_ADD_SECTION = `
ALTER TABLE rc_ingredients ADD COLUMN section TEXT
`;

export const ALTER_RC_INGREDIENTS_ADD_QUANTITY_VALUE = `
ALTER TABLE rc_ingredients ADD COLUMN quantity_value REAL
`;

export const ALTER_RC_INGREDIENTS_ADD_ITEM = `
ALTER TABLE rc_ingredients ADD COLUMN item TEXT
`;

export const ALTER_RC_INGREDIENTS_ADD_PREP_NOTE = `
ALTER TABLE rc_ingredients ADD COLUMN prep_note TEXT
`;

export const ALTER_RC_INGREDIENTS_ADD_IS_OPTIONAL = `
ALTER TABLE rc_ingredients ADD COLUMN is_optional INTEGER NOT NULL DEFAULT 0
`;

export const ALTER_RC_STEPS_ADD_SECTION = `
ALTER TABLE rc_steps ADD COLUMN section TEXT
`;

export const BACKFILL_RC_INGREDIENTS_ITEM = `
UPDATE rc_ingredients
SET item = name
WHERE item IS NULL OR trim(item) = ''
`;

export const BACKFILL_RC_INGREDIENTS_QUANTITY_VALUE = `
UPDATE rc_ingredients
SET quantity_value = CASE
  WHEN quantity IS NULL OR trim(quantity) = '' THEN NULL
  WHEN trim(quantity) GLOB '[0-9]*' THEN CAST(quantity AS REAL)
  ELSE NULL
END
WHERE quantity_value IS NULL
`;

export const CREATE_RC_PANTRY_ITEMS = `
CREATE TABLE IF NOT EXISTS rc_pantry_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    storage_location TEXT NOT NULL DEFAULT 'pantry' CHECK (storage_location IN (
        'fridge', 'freezer', 'pantry', 'counter', 'other'
    )),
    expiration_date TEXT,
    purchase_date TEXT,
    barcode TEXT,
    photo_path TEXT,
    notes TEXT,
    grocery_section TEXT NOT NULL DEFAULT 'other' CHECK (grocery_section IN (
        'produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery',
        'beverages', 'snacks', 'condiments', 'other'
    )),
    is_staple INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_PANTRY_STAPLES = `
CREATE TABLE IF NOT EXISTS rc_pantry_staples (
    id TEXT PRIMARY KEY,
    item TEXT NOT NULL UNIQUE
)`;

// -- Indexes --
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_recipes_title_idx ON rc_recipes(title)`,
  `CREATE INDEX IF NOT EXISTS rc_recipes_favorite_idx ON rc_recipes(is_favorite) WHERE is_favorite = 1`,
  `CREATE INDEX IF NOT EXISTS rc_recipes_difficulty_idx ON rc_recipes(difficulty)`,
  `CREATE INDEX IF NOT EXISTS rc_recipes_created_idx ON rc_recipes(created_at)`,
  `CREATE INDEX IF NOT EXISTS rc_ingredients_recipe_idx ON rc_ingredients(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS rc_steps_recipe_idx ON rc_steps(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS rc_recipe_tags_recipe_idx ON rc_recipe_tags(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS rc_recipe_tags_tag_idx ON rc_recipe_tags(tag)`,
];

/** All table creation statements in dependency order */
export const ALL_TABLES = [
  CREATE_RECIPES,
  CREATE_INGREDIENTS,
  CREATE_STEPS,
  CREATE_RECIPE_TAGS,
  CREATE_SETTINGS,
];

export const MYGARDEN_TABLES = [
  CREATE_RC_MEAL_PLANS,
  CREATE_RC_MEAL_PLAN_ITEMS,
  CREATE_GD_PLANTS,
  CREATE_GD_PLANT_CARE_LOGS,
  CREATE_GD_GARDEN_LAYOUTS,
  CREATE_GD_GARDEN_JOURNAL,
  CREATE_GD_HARVESTS,
  CREATE_GD_HARVEST_RECIPE_LINKS,
  CREATE_EV_EVENTS,
  CREATE_EV_GUESTS,
  CREATE_EV_RSVPS,
  CREATE_EV_MENU_ITEMS,
  CREATE_EV_POTLUCK_CLAIMS,
  CREATE_EV_EVENT_TIMELINE,
];

export const MYGARDEN_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_meal_plans_week_idx ON rc_meal_plans(week_start_date)`,
  `CREATE INDEX IF NOT EXISTS rc_meal_plan_items_plan_idx ON rc_meal_plan_items(meal_plan_id)`,
  `CREATE INDEX IF NOT EXISTS rc_meal_plan_items_recipe_idx ON rc_meal_plan_items(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS gd_plants_species_idx ON gd_plants(species)`,
  `CREATE INDEX IF NOT EXISTS gd_plant_care_logs_plant_idx ON gd_plant_care_logs(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_garden_journal_plant_idx ON gd_garden_journal(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_harvests_item_idx ON gd_harvests(item_name)`,
  `CREATE INDEX IF NOT EXISTS ev_events_date_idx ON ev_events(event_date)`,
  `CREATE INDEX IF NOT EXISTS ev_guests_event_idx ON ev_guests(event_id)`,
  `CREATE INDEX IF NOT EXISTS ev_rsvps_event_idx ON ev_rsvps(event_id)`,
  `CREATE INDEX IF NOT EXISTS ev_menu_items_event_idx ON ev_menu_items(event_id)`,
  `CREATE INDEX IF NOT EXISTS ev_potluck_event_idx ON ev_potluck_claims(event_id)`,
  `CREATE INDEX IF NOT EXISTS ev_timeline_event_idx ON ev_event_timeline(event_id)`,
];

export const ENHANCED_RECIPE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_ingredients_item_idx ON rc_ingredients(item)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_name_idx ON rc_pantry_items(name)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_storage_idx ON rc_pantry_items(storage_location)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_expiration_idx ON rc_pantry_items(expiration_date)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_barcode_idx ON rc_pantry_items(barcode)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_section_idx ON rc_pantry_items(grocery_section)`,
];

export const PANTRY_EVOLUTION_STATEMENTS = [
  ALTER_RC_INGREDIENTS_ADD_SECTION,
  ALTER_RC_INGREDIENTS_ADD_QUANTITY_VALUE,
  ALTER_RC_INGREDIENTS_ADD_ITEM,
  ALTER_RC_INGREDIENTS_ADD_PREP_NOTE,
  ALTER_RC_INGREDIENTS_ADD_IS_OPTIONAL,
  ALTER_RC_STEPS_ADD_SECTION,
  BACKFILL_RC_INGREDIENTS_ITEM,
  BACKFILL_RC_INGREDIENTS_QUANTITY_VALUE,
  CREATE_RC_PANTRY_ITEMS,
  CREATE_RC_PANTRY_STAPLES,
];

// -- V4: Collections --
export const CREATE_RC_COLLECTIONS = `
CREATE TABLE IF NOT EXISTS rc_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_recipe_id TEXT REFERENCES rc_recipes(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_RECIPE_COLLECTIONS = `
CREATE TABLE IF NOT EXISTS rc_recipe_collections (
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    collection_id TEXT NOT NULL REFERENCES rc_collections(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(recipe_id, collection_id)
)`;

// -- V4: Nutrition Data --
export const CREATE_RC_NUTRITION_DATA = `
CREATE TABLE IF NOT EXISTS rc_nutrition_data (
    id TEXT PRIMARY KEY,
    pantry_item_id TEXT REFERENCES rc_pantry_items(id) ON DELETE SET NULL,
    barcode TEXT,
    product_name TEXT,
    brand TEXT,
    serving_size_text TEXT,
    calories REAL,
    fat_g REAL,
    saturated_fat_g REAL,
    carbs_g REAL,
    fiber_g REAL,
    sugar_g REAL,
    protein_g REAL,
    sodium_mg REAL,
    source TEXT NOT NULL DEFAULT 'manual',
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_TABLES = [CREATE_RC_COLLECTIONS, CREATE_RC_RECIPE_COLLECTIONS, CREATE_RC_NUTRITION_DATA];

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_collections_sort_idx ON rc_collections(sort_order)`,
  `CREATE INDEX IF NOT EXISTS rc_recipe_collections_collection_idx ON rc_recipe_collections(collection_id)`,
  `CREATE INDEX IF NOT EXISTS rc_recipe_collections_recipe_idx ON rc_recipe_collections(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS rc_nutrition_data_pantry_item_idx ON rc_nutrition_data(pantry_item_id)`,
  `CREATE INDEX IF NOT EXISTS rc_nutrition_data_barcode_idx ON rc_nutrition_data(barcode)`,
];

export const SEED_PANTRY_STAPLES = [
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-salt', 'salt')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-pepper', 'black pepper')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-olive-oil', 'olive oil')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-vegetable-oil', 'vegetable oil')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-flour', 'all-purpose flour')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-sugar', 'sugar')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-butter', 'butter')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-garlic-powder', 'garlic powder')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-onion-powder', 'onion powder')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-paprika', 'paprika')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-cumin', 'cumin')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-oregano', 'oregano')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-baking-soda', 'baking soda')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-baking-powder', 'baking powder')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-soy-sauce', 'soy sauce')`,
  `INSERT OR IGNORE INTO rc_pantry_staples (id, item) VALUES ('staple-vinegar', 'vinegar')`,
];

/** Seed SQL for default settings */
export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO rc_settings (key, value) VALUES ('defaultServings', '4')`,
  `INSERT OR IGNORE INTO rc_settings (key, value) VALUES ('measurementSystem', 'us')`,
  `INSERT OR IGNORE INTO rc_settings (key, value) VALUES ('defaultDifficulty', 'medium')`,
];

// -- V5: Shopping Lists --

export const CREATE_RC_SHOPPING_LISTS = `
CREATE TABLE IF NOT EXISTS rc_shopping_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_SHOPPING_LIST_ITEMS = `
CREATE TABLE IF NOT EXISTS rc_shopping_list_items (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL REFERENCES rc_shopping_lists(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    grocery_section TEXT NOT NULL DEFAULT 'other' CHECK (grocery_section IN (
        'produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery',
        'beverages', 'snacks', 'condiments', 'other'
    )),
    recipe_id TEXT,
    recipe_multiplier REAL NOT NULL DEFAULT 1,
    is_checked INTEGER NOT NULL DEFAULT 0,
    is_custom INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V5_TABLES = [CREATE_RC_SHOPPING_LISTS, CREATE_RC_SHOPPING_LIST_ITEMS];

export const V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_shopping_lists_active_idx ON rc_shopping_lists(is_active)`,
  `CREATE INDEX IF NOT EXISTS rc_shopping_list_items_list_idx ON rc_shopping_list_items(list_id)`,
  `CREATE INDEX IF NOT EXISTS rc_shopping_list_items_recipe_idx ON rc_shopping_list_items(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS rc_shopping_list_items_checked_idx ON rc_shopping_list_items(is_checked)`,
];

// -- V6: Share Tokens --

export const CREATE_RC_SHARE_TOKENS = `
CREATE TABLE IF NOT EXISTS rc_share_tokens (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0
)`;

export const V6_TABLES = [CREATE_RC_SHARE_TOKENS];

export const V6_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_share_tokens_token_idx ON rc_share_tokens(token)`,
  `CREATE INDEX IF NOT EXISTS rc_share_tokens_recipe_idx ON rc_share_tokens(recipe_id)`,
];

// -- V7: Drop garden and events tables (data now owned by garden + rsvp modules) --

export const V7_DROP_GARDEN_EVENTS = [
  'DROP TABLE IF EXISTS ev_event_timeline',
  'DROP TABLE IF EXISTS ev_potluck_claims',
  'DROP TABLE IF EXISTS ev_menu_items',
  'DROP TABLE IF EXISTS ev_rsvps',
  'DROP TABLE IF EXISTS ev_guests',
  'DROP TABLE IF EXISTS ev_events',
  'DROP TABLE IF EXISTS gd_harvest_recipe_links',
  'DROP TABLE IF EXISTS gd_harvests',
  'DROP TABLE IF EXISTS gd_garden_journal',
  'DROP TABLE IF EXISTS gd_garden_layouts',
  'DROP TABLE IF EXISTS gd_plant_care_logs',
  'DROP TABLE IF EXISTS gd_plants',
];

/** Meal plan tables only (extracted from former MYGARDEN_TABLES) */
export const MEAL_PLAN_TABLES = [
  CREATE_RC_MEAL_PLANS,
  CREATE_RC_MEAL_PLAN_ITEMS,
];

export const MEAL_PLAN_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_meal_plans_week_idx ON rc_meal_plans(week_start_date)`,
  `CREATE INDEX IF NOT EXISTS rc_meal_plan_items_plan_idx ON rc_meal_plan_items(meal_plan_id)`,
  `CREATE INDEX IF NOT EXISTS rc_meal_plan_items_recipe_idx ON rc_meal_plan_items(recipe_id)`,
];

// -- V8: Local chef follows and follower update seeds --

export const CREATE_RC_CHEF_FOLLOWS = `
CREATE TABLE IF NOT EXISTS rc_chef_follows (
    chef_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    handle TEXT NOT NULL,
    location TEXT,
    top_cuisine TEXT,
    follower_count INTEGER NOT NULL DEFAULT 0,
    followed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_seed_at TEXT,
    seed_revision INTEGER NOT NULL DEFAULT 0,
    cached_payload_json TEXT NOT NULL DEFAULT '{}'
)`;

export const CREATE_RC_FOLLOWER_UPDATE_SEEDS = `
CREATE TABLE IF NOT EXISTS rc_follower_update_seeds (
    id TEXT PRIMARY KEY,
    chef_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    handle TEXT NOT NULL,
    revision INTEGER NOT NULL,
    follower_count INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'superseded')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT,
    UNIQUE (chef_id, revision)
)`;

export const V8_SOCIAL_TABLES = [
  CREATE_RC_CHEF_FOLLOWS,
  CREATE_RC_FOLLOWER_UPDATE_SEEDS,
];

export const V8_SOCIAL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_chef_follows_updated_idx ON rc_chef_follows(updated_at)`,
  `CREATE INDEX IF NOT EXISTS rc_follower_update_seeds_chef_idx ON rc_follower_update_seeds(chef_id, revision DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_follower_update_seeds_status_idx ON rc_follower_update_seeds(status, updated_at DESC)`,
];

// -- V9: BestChef standalone beta social activity --

export const CREATE_RC_BESTCHEF_SUBMISSIONS = `
CREATE TABLE IF NOT EXISTS rc_bestchef_submissions (
    id TEXT PRIMARY KEY,
    dish_id TEXT NOT NULL,
    dish_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    ingredients_json TEXT NOT NULL DEFAULT '[]',
    instructions_json TEXT NOT NULL DEFAULT '[]',
    photo_uri TEXT,
    videos_json TEXT NOT NULL DEFAULT '[]',
    chef_id TEXT NOT NULL,
    chef_name TEXT NOT NULL,
    chef_handle TEXT NOT NULL,
    vote_score INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    photo_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`;

export const CREATE_RC_BESTCHEF_COMMENTS = `
CREATE TABLE IF NOT EXISTS rc_bestchef_comments (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    text TEXT NOT NULL,
    comment_type TEXT NOT NULL DEFAULT 'comment' CHECK (comment_type IN ('comment', 'tried_this', 'chefs_tip')),
    helpful_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`;

export const CREATE_RC_BESTCHEF_VOTES = `
CREATE TABLE IF NOT EXISTS rc_bestchef_votes (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    tier INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (submission_id, voter_id)
)`;

// -- V10: Device-local media cache manifest --

export const CREATE_RC_BESTCHEF_MEDIA_CACHE = `
CREATE TABLE IF NOT EXISTS rc_bestchef_media_cache (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('dish', 'submission', 'video', 'recipe')),
    owner_id TEXT NOT NULL,
    media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video', 'recipe_bundle')),
    remote_uri TEXT NOT NULL,
    local_uri TEXT,
    bytes INTEGER,
    status TEXT NOT NULL DEFAULT 'available_remote' CHECK (status IN ('available_remote', 'downloaded', 'failed')),
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (owner_kind, owner_id, media_kind, remote_uri)
)`;

export const V9_BESTCHEF_SOCIAL_TABLES = [
  CREATE_RC_BESTCHEF_SUBMISSIONS,
  CREATE_RC_BESTCHEF_COMMENTS,
  CREATE_RC_BESTCHEF_VOTES,
];

export const V9_BESTCHEF_SOCIAL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_bestchef_submissions_dish_idx ON rc_bestchef_submissions(dish_id, vote_score DESC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_submissions_chef_idx ON rc_bestchef_submissions(chef_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_comments_submission_idx ON rc_bestchef_comments(submission_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_comments_author_idx ON rc_bestchef_comments(author_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_votes_submission_idx ON rc_bestchef_votes(submission_id, updated_at DESC)`,
];

export const V10_BESTCHEF_MEDIA_TABLES = [
  CREATE_RC_BESTCHEF_MEDIA_CACHE,
];

export const V10_BESTCHEF_MEDIA_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_bestchef_media_cache_owner_idx ON rc_bestchef_media_cache(owner_kind, owner_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_media_cache_status_idx ON rc_bestchef_media_cache(status, updated_at DESC)`,
];

// -- V11: Private recipe grocery flags --

export const CREATE_RC_RECIPE_GROCERY_FLAGS = `
CREATE TABLE IF NOT EXISTS rc_recipe_grocery_flags (
    recipe_id TEXT PRIMARY KEY REFERENCES rc_recipes(id) ON DELETE CASCADE,
    default_multiplier REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V11_RECIPE_GROCERY_FLAG_TABLES = [
  CREATE_RC_RECIPE_GROCERY_FLAGS,
];

export const V11_RECIPE_GROCERY_FLAG_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_recipe_grocery_flags_updated_idx ON rc_recipe_grocery_flags(updated_at DESC)`,
];

// -- V12: Canonical food identity, barcode aliases, and nutrition provenance --

export const CREATE_RC_FOOD_PRODUCTS = `
CREATE TABLE IF NOT EXISTS rc_food_products (
    id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    brand TEXT,
    manufacturer TEXT,
    product_type TEXT NOT NULL DEFAULT 'generic' CHECK (product_type IN (
        'generic', 'branded', 'raw_ingredient', 'prepared_food'
    )),
    grocery_section TEXT NOT NULL DEFAULT 'other' CHECK (grocery_section IN (
        'produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery',
        'beverages', 'snacks', 'condiments', 'other'
    )),
    default_storage_location TEXT CHECK (default_storage_location IN (
        'fridge', 'freezer', 'pantry', 'counter', 'other'
    )),
    image_uri TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    is_user_confirmed INTEGER NOT NULL DEFAULT 0,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_FOOD_PRODUCT_ALIASES = `
CREATE TABLE IF NOT EXISTS rc_food_product_aliases (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES rc_food_products(id) ON DELETE CASCADE,
    alias_type TEXT NOT NULL CHECK (alias_type IN (
        'barcode', 'name', 'receipt_line', 'ocr_label', 'source_id'
    )),
    alias_value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_user_confirmed INTEGER NOT NULL DEFAULT 0,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_FOOD_CONFIRMATIONS = `
CREATE TABLE IF NOT EXISTS rc_food_confirmations (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL CHECK (subject_type IN (
        'food_product', 'product_alias', 'nutrition_data', 'pantry_item'
    )),
    subject_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN (
        'confirmed', 'rejected', 'manual_override'
    )),
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const ALTER_RC_PANTRY_ITEMS_ADD_PRODUCT_ID = `
ALTER TABLE rc_pantry_items ADD COLUMN product_id TEXT REFERENCES rc_food_products(id) ON DELETE SET NULL
`;

export const ALTER_RC_PANTRY_ITEMS_ADD_NUTRITION_DATA_ID = `
ALTER TABLE rc_pantry_items ADD COLUMN nutrition_data_id TEXT REFERENCES rc_nutrition_data(id) ON DELETE SET NULL
`;

export const ALTER_RC_PANTRY_ITEMS_ADD_CONFIRMATION_STATUS = `
ALTER TABLE rc_pantry_items ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confirmation_status IN ('unconfirmed', 'confirmed', 'rejected', 'needs_review'))
`;

export const ALTER_RC_PANTRY_ITEMS_ADD_CONFIRMED_AT = `
ALTER TABLE rc_pantry_items ADD COLUMN confirmed_at TEXT
`;

export const ALTER_RC_NUTRITION_DATA_ADD_PRODUCT_ID = `
ALTER TABLE rc_nutrition_data ADD COLUMN product_id TEXT REFERENCES rc_food_products(id) ON DELETE SET NULL
`;

export const ALTER_RC_NUTRITION_DATA_ADD_SOURCE_ID = `
ALTER TABLE rc_nutrition_data ADD COLUMN source_id TEXT
`;

export const ALTER_RC_NUTRITION_DATA_ADD_SOURCE_URL = `
ALTER TABLE rc_nutrition_data ADD COLUMN source_url TEXT
`;

export const ALTER_RC_NUTRITION_DATA_ADD_CONFIDENCE = `
ALTER TABLE rc_nutrition_data ADD COLUMN confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
`;

export const ALTER_RC_NUTRITION_DATA_ADD_SERVING_BASIS = `
ALTER TABLE rc_nutrition_data ADD COLUMN serving_basis TEXT NOT NULL DEFAULT 'per_serving' CHECK (serving_basis IN ('per_serving', 'per_100g', 'per_100ml', 'per_package', 'per_item'))
`;

export const ALTER_RC_NUTRITION_DATA_ADD_SERVING_QUANTITY = `
ALTER TABLE rc_nutrition_data ADD COLUMN serving_quantity REAL
`;

export const ALTER_RC_NUTRITION_DATA_ADD_SERVING_UNIT = `
ALTER TABLE rc_nutrition_data ADD COLUMN serving_unit TEXT
`;

export const ALTER_RC_NUTRITION_DATA_ADD_PARENT_NUTRITION_DATA_ID = `
ALTER TABLE rc_nutrition_data ADD COLUMN parent_nutrition_data_id TEXT REFERENCES rc_nutrition_data(id) ON DELETE SET NULL
`;

export const ALTER_RC_NUTRITION_DATA_ADD_IS_USER_CONFIRMED = `
ALTER TABLE rc_nutrition_data ADD COLUMN is_user_confirmed INTEGER NOT NULL DEFAULT 0
`;

export const ALTER_RC_NUTRITION_DATA_ADD_CONFIRMED_AT = `
ALTER TABLE rc_nutrition_data ADD COLUMN confirmed_at TEXT
`;

export const V12_FOOD_IDENTITY_TABLES = [
  CREATE_RC_FOOD_PRODUCTS,
  CREATE_RC_FOOD_PRODUCT_ALIASES,
  CREATE_RC_FOOD_CONFIRMATIONS,
];

export const V12_FOOD_IDENTITY_ALTERS = [
  ALTER_RC_PANTRY_ITEMS_ADD_PRODUCT_ID,
  ALTER_RC_PANTRY_ITEMS_ADD_NUTRITION_DATA_ID,
  ALTER_RC_PANTRY_ITEMS_ADD_CONFIRMATION_STATUS,
  ALTER_RC_PANTRY_ITEMS_ADD_CONFIRMED_AT,
  ALTER_RC_NUTRITION_DATA_ADD_PRODUCT_ID,
  ALTER_RC_NUTRITION_DATA_ADD_SOURCE_ID,
  ALTER_RC_NUTRITION_DATA_ADD_SOURCE_URL,
  ALTER_RC_NUTRITION_DATA_ADD_CONFIDENCE,
  ALTER_RC_NUTRITION_DATA_ADD_SERVING_BASIS,
  ALTER_RC_NUTRITION_DATA_ADD_SERVING_QUANTITY,
  ALTER_RC_NUTRITION_DATA_ADD_SERVING_UNIT,
  ALTER_RC_NUTRITION_DATA_ADD_PARENT_NUTRITION_DATA_ID,
  ALTER_RC_NUTRITION_DATA_ADD_IS_USER_CONFIRMED,
  ALTER_RC_NUTRITION_DATA_ADD_CONFIRMED_AT,
];

export const V12_FOOD_IDENTITY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_food_products_name_idx ON rc_food_products(canonical_name)`,
  `CREATE INDEX IF NOT EXISTS rc_food_products_source_idx ON rc_food_products(source, source_id)`,
  `CREATE INDEX IF NOT EXISTS rc_food_product_aliases_product_idx ON rc_food_product_aliases(product_id)`,
  `CREATE INDEX IF NOT EXISTS rc_food_product_aliases_lookup_idx ON rc_food_product_aliases(alias_type, normalized_value)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rc_food_product_aliases_barcode_unique_idx ON rc_food_product_aliases(normalized_value) WHERE alias_type = 'barcode'`,
  `CREATE INDEX IF NOT EXISTS rc_food_confirmations_subject_idx ON rc_food_confirmations(subject_type, subject_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_product_idx ON rc_pantry_items(product_id)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_items_nutrition_data_idx ON rc_pantry_items(nutrition_data_id)`,
  `CREATE INDEX IF NOT EXISTS rc_nutrition_data_product_idx ON rc_nutrition_data(product_id)`,
  `CREATE INDEX IF NOT EXISTS rc_nutrition_data_source_idx ON rc_nutrition_data(source, source_id)`,
  `CREATE INDEX IF NOT EXISTS rc_nutrition_data_confidence_idx ON rc_nutrition_data(product_id, is_user_confirmed DESC, confidence DESC, fetched_at DESC)`,
];

// -- V13: Pantry batch and lot tracking --

export const CREATE_RC_PANTRY_BATCHES = `
CREATE TABLE IF NOT EXISTS rc_pantry_batches (
    id TEXT PRIMARY KEY,
    pantry_item_id TEXT NOT NULL REFERENCES rc_pantry_items(id) ON DELETE CASCADE,
    lot_code TEXT,
    quantity REAL,
    unit TEXT,
    expiration_date TEXT,
    purchase_date TEXT,
	    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
	        'manual', 'grocery_list', 'receipt_ocr', 'barcode_scan',
	        'food_recognition', 'expiration_ocr', 'import', 'migration'
	    )),
    receipt_link TEXT,
    photos_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const MIGRATE_RC_PANTRY_ITEMS_TO_BATCHES = `
INSERT INTO rc_pantry_batches (
    id,
    pantry_item_id,
    quantity,
    unit,
    expiration_date,
    purchase_date,
    source,
    photos_json,
    created_at,
    updated_at
)
SELECT
    'batch-' || id,
    id,
    quantity,
    unit,
    expiration_date,
    purchase_date,
    'migration',
    CASE
      WHEN photo_path IS NULL OR trim(photo_path) = '' THEN '[]'
      ELSE json_array(photo_path)
    END,
    created_at,
    updated_at
FROM rc_pantry_items item
WHERE NOT EXISTS (
    SELECT 1 FROM rc_pantry_batches batch WHERE batch.pantry_item_id = item.id
)`;

export const V13_PANTRY_BATCH_TABLES = [
  CREATE_RC_PANTRY_BATCHES,
];

export const V13_PANTRY_BATCH_MIGRATIONS = [
  MIGRATE_RC_PANTRY_ITEMS_TO_BATCHES,
];

export const V13_PANTRY_BATCH_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_pantry_batches_item_idx ON rc_pantry_batches(pantry_item_id)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_batches_expiration_idx ON rc_pantry_batches(expiration_date)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_batches_purchase_idx ON rc_pantry_batches(purchase_date)`,
  `CREATE INDEX IF NOT EXISTS rc_pantry_batches_source_idx ON rc_pantry_batches(source)`,
];

// -- V14: Shopping list organization metadata --

export const ALTER_RC_SHOPPING_LISTS_ADD_STORE_NAME = `
ALTER TABLE rc_shopping_lists ADD COLUMN store_name TEXT
`;

export const ALTER_RC_SHOPPING_LISTS_ADD_EVENT_NAME = `
ALTER TABLE rc_shopping_lists ADD COLUMN event_name TEXT
`;

export const ALTER_RC_SHOPPING_LISTS_ADD_EVENT_DATE = `
ALTER TABLE rc_shopping_lists ADD COLUMN event_date TEXT
`;

export const ALTER_RC_SHOPPING_LISTS_ADD_ARCHIVED_AT = `
ALTER TABLE rc_shopping_lists ADD COLUMN archived_at TEXT
`;

export const BACKFILL_RC_SHOPPING_LISTS_ARCHIVED_AT = `
UPDATE rc_shopping_lists
SET archived_at = updated_at
WHERE is_active = 0 AND archived_at IS NULL
`;

export const V14_SHOPPING_LIST_ORGANIZATION_ALTERS = [
  ALTER_RC_SHOPPING_LISTS_ADD_STORE_NAME,
  ALTER_RC_SHOPPING_LISTS_ADD_EVENT_NAME,
  ALTER_RC_SHOPPING_LISTS_ADD_EVENT_DATE,
  ALTER_RC_SHOPPING_LISTS_ADD_ARCHIVED_AT,
  BACKFILL_RC_SHOPPING_LISTS_ARCHIVED_AT,
];

export const V14_SHOPPING_LIST_ORGANIZATION_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_shopping_lists_status_updated_idx ON rc_shopping_lists(is_active, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_shopping_lists_archived_idx ON rc_shopping_lists(archived_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_shopping_lists_store_idx ON rc_shopping_lists(store_name)`,
  `CREATE INDEX IF NOT EXISTS rc_shopping_lists_event_date_idx ON rc_shopping_lists(event_date)`,
];

// -- V15: Receipt OCR import review, matching, and pantry confirmation --

export const CREATE_RC_RECEIPT_IMPORTS = `
CREATE TABLE IF NOT EXISTS rc_receipt_imports (
    id TEXT PRIMARY KEY,
    attachment_id TEXT,
    photo_uri TEXT NOT NULL,
    photo_mime TEXT NOT NULL DEFAULT 'image/jpeg',
    ocr_provider TEXT NOT NULL,
    provider_status TEXT NOT NULL CHECK (provider_status IN (
        'pending', 'parsed', 'failed', 'manual'
    )),
    provider_error TEXT,
    merchant TEXT,
    receipt_date TEXT,
    subtotal_cents INTEGER,
    tax_cents INTEGER,
    total_cents INTEGER,
    currency TEXT,
    raw_ocr_text TEXT,
    redacted_ocr_text TEXT,
    redactions_json TEXT NOT NULL DEFAULT '[]',
    parsed_json TEXT NOT NULL DEFAULT '{}',
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN (
        'needs_review', 'confirmed', 'dismissed', 'failed'
    )),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RC_RECEIPT_IMPORT_LINES = `
CREATE TABLE IF NOT EXISTS rc_receipt_import_lines (
    id TEXT PRIMARY KEY,
    receipt_import_id TEXT NOT NULL REFERENCES rc_receipt_imports(id) ON DELETE CASCADE,
    line_index INTEGER NOT NULL,
    raw_description TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    quantity REAL,
    unit_price_cents INTEGER,
    total_cents INTEGER,
    product_id TEXT REFERENCES rc_food_products(id) ON DELETE SET NULL,
    pantry_item_id TEXT REFERENCES rc_pantry_items(id) ON DELETE SET NULL,
    nutrition_data_id TEXT REFERENCES rc_nutrition_data(id) ON DELETE SET NULL,
    match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN (
        'unmatched', 'matched', 'ambiguous', 'confirmed', 'ignored'
    )),
    match_confidence REAL CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
    match_reason TEXT,
    candidate_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(receipt_import_id, line_index)
)`;

export const V15_RECEIPT_IMPORT_TABLES = [
  CREATE_RC_RECEIPT_IMPORTS,
  CREATE_RC_RECEIPT_IMPORT_LINES,
];

export const V15_RECEIPT_IMPORT_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_receipt_imports_review_idx ON rc_receipt_imports(review_status, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_receipt_imports_attachment_idx ON rc_receipt_imports(attachment_id)`,
  `CREATE INDEX IF NOT EXISTS rc_receipt_import_lines_import_idx ON rc_receipt_import_lines(receipt_import_id, line_index)`,
  `CREATE INDEX IF NOT EXISTS rc_receipt_import_lines_status_idx ON rc_receipt_import_lines(match_status)`,
  `CREATE INDEX IF NOT EXISTS rc_receipt_import_lines_product_idx ON rc_receipt_import_lines(product_id)`,
  `CREATE INDEX IF NOT EXISTS rc_receipt_import_lines_pantry_idx ON rc_receipt_import_lines(pantry_item_id)`,
  `CREATE INDEX IF NOT EXISTS rc_receipt_import_lines_nutrition_idx ON rc_receipt_import_lines(nutrition_data_id)`,
];

// -- V16: Expiration OCR batch source --

export const CREATE_RC_PANTRY_BATCHES_V16 = `
CREATE TABLE IF NOT EXISTS rc_pantry_batches_v16 (
    id TEXT PRIMARY KEY,
    pantry_item_id TEXT NOT NULL REFERENCES rc_pantry_items(id) ON DELETE CASCADE,
    lot_code TEXT,
    quantity REAL,
    unit TEXT,
    expiration_date TEXT,
    purchase_date TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
        'manual', 'grocery_list', 'receipt_ocr', 'barcode_scan',
        'food_recognition', 'expiration_ocr', 'import', 'migration'
    )),
    receipt_link TEXT,
    photos_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const COPY_RC_PANTRY_BATCHES_TO_V16 = `
INSERT OR IGNORE INTO rc_pantry_batches_v16 (
    id,
    pantry_item_id,
    lot_code,
    quantity,
    unit,
    expiration_date,
    purchase_date,
    source,
    receipt_link,
    photos_json,
    created_at,
    updated_at
)
SELECT
    id,
    pantry_item_id,
    lot_code,
    quantity,
    unit,
    expiration_date,
    purchase_date,
    source,
    receipt_link,
    photos_json,
    created_at,
    updated_at
FROM rc_pantry_batches`;

export const DROP_RC_PANTRY_BATCHES_FOR_V16 = `
DROP TABLE IF EXISTS rc_pantry_batches`;

export const RENAME_RC_PANTRY_BATCHES_V16 = `
ALTER TABLE rc_pantry_batches_v16 RENAME TO rc_pantry_batches`;

export const V16_EXPIRATION_OCR_BATCH_SOURCE_MIGRATIONS = [
  CREATE_RC_PANTRY_BATCHES_V16,
  COPY_RC_PANTRY_BATCHES_TO_V16,
  DROP_RC_PANTRY_BATCHES_FOR_V16,
  RENAME_RC_PANTRY_BATCHES_V16,
];

// -- V17: Reusable nutrition unit conversion corrections --

export const CREATE_RC_UNIT_CONVERSION_CORRECTIONS = `
CREATE TABLE IF NOT EXISTS rc_unit_conversion_corrections (
    id TEXT PRIMARY KEY,
    ingredient_name TEXT NOT NULL,
    normalized_ingredient_name TEXT NOT NULL,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    factor REAL NOT NULL CHECK (factor > 0),
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
        'manual', 'recipe_review', 'nutrition_review', 'migration'
    )),
    is_user_confirmed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V17_UNIT_CONVERSION_CORRECTION_TABLES = [
  CREATE_RC_UNIT_CONVERSION_CORRECTIONS,
];

export const V17_UNIT_CONVERSION_CORRECTION_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_unit_conversion_corrections_lookup_idx ON rc_unit_conversion_corrections(normalized_ingredient_name, from_unit, to_unit)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rc_unit_conversion_corrections_unique_idx ON rc_unit_conversion_corrections(normalized_ingredient_name, from_unit, to_unit)`,
  `CREATE INDEX IF NOT EXISTS rc_unit_conversion_corrections_updated_idx ON rc_unit_conversion_corrections(updated_at DESC)`,
];

// -- V18: Device-local BestChef vote proof drafts --

export const CREATE_RC_LOCAL_VOTE_PROOFS = `
CREATE TABLE IF NOT EXISTS rc_local_vote_proofs (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('gold', 'silver', 'bronze', 'like')),
    local_image_uri TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN (
        'draft', 'uploading', 'committing', 'committed', 'failed', 'expired'
    )),
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
)`;

export const V18_LOCAL_VOTE_PROOF_TABLES = [
  CREATE_RC_LOCAL_VOTE_PROOFS,
];

export const V18_LOCAL_VOTE_PROOF_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_local_vote_proofs_submission_idx ON rc_local_vote_proofs(submission_id, state)`,
  `CREATE INDEX IF NOT EXISTS rc_local_vote_proofs_state_idx ON rc_local_vote_proofs(state, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_local_vote_proofs_expires_idx ON rc_local_vote_proofs(expires_at)`,
];

// -- V19: Recipe cook history for pantry decrement review --

export const CREATE_RC_RECIPE_COOK_HISTORY = `
CREATE TABLE IF NOT EXISTS rc_recipe_cook_history (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    cooked_at TEXT NOT NULL,
    servings REAL NOT NULL DEFAULT 1,
    pantry_decrements_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V19_RECIPE_COOK_HISTORY_TABLES = [
  CREATE_RC_RECIPE_COOK_HISTORY,
];

export const V19_RECIPE_COOK_HISTORY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_recipe_cook_history_recipe_idx ON rc_recipe_cook_history(recipe_id, cooked_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_recipe_cook_history_cooked_idx ON rc_recipe_cook_history(cooked_at DESC)`,
];

// -- V20: Source attribution for recipes saved from public BestChef submissions --

export const ALTER_RC_RECIPES_ADD_SOURCE_SUBMISSION_ID = `
ALTER TABLE rc_recipes ADD COLUMN source_submission_id TEXT
`;

export const ALTER_RC_RECIPES_ADD_SOURCE_CHEF_ID = `
ALTER TABLE rc_recipes ADD COLUMN source_chef_id TEXT
`;

export const ALTER_RC_RECIPES_ADD_SOURCE_CHEF_NAME = `
ALTER TABLE rc_recipes ADD COLUMN source_chef_name TEXT
`;

export const ALTER_RC_RECIPES_ADD_SOURCE_CHEF_HANDLE = `
ALTER TABLE rc_recipes ADD COLUMN source_chef_handle TEXT
`;

export const V20_RECIPE_SOURCE_ATTRIBUTION_ALTERS = [
  ALTER_RC_RECIPES_ADD_SOURCE_SUBMISSION_ID,
  ALTER_RC_RECIPES_ADD_SOURCE_CHEF_ID,
  ALTER_RC_RECIPES_ADD_SOURCE_CHEF_NAME,
  ALTER_RC_RECIPES_ADD_SOURCE_CHEF_HANDLE,
];

export const V20_RECIPE_SOURCE_ATTRIBUTION_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS rc_recipes_source_submission_unique_idx ON rc_recipes(source_submission_id) WHERE source_submission_id IS NOT NULL`,
];

// -- V21: Device-local submission like cache and cloud sync queue --

export const CREATE_RC_BESTCHEF_SUBMISSION_LIKES = `
CREATE TABLE IF NOT EXISTS rc_bestchef_submission_likes (
    target_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    cloud_submission_id TEXT,
    liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1)),
    like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    pending INTEGER NOT NULL DEFAULT 0 CHECK (pending IN (0, 1)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (target_id, viewer_id)
)`;

export const CREATE_RC_BESTCHEF_SUBMISSION_LIKE_QUEUE = `
CREATE TABLE IF NOT EXISTS rc_bestchef_submission_like_queue (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    cloud_submission_id TEXT,
    desired_liked INTEGER NOT NULL CHECK (desired_liked IN (0, 1)),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (target_id, viewer_id)
)`;

export const V21_BESTCHEF_SUBMISSION_LIKE_TABLES = [
  CREATE_RC_BESTCHEF_SUBMISSION_LIKES,
  CREATE_RC_BESTCHEF_SUBMISSION_LIKE_QUEUE,
];

export const V21_BESTCHEF_SUBMISSION_LIKE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_bestchef_submission_likes_target_idx ON rc_bestchef_submission_likes(target_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_submission_like_queue_target_idx ON rc_bestchef_submission_like_queue(target_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_submission_like_queue_cloud_idx ON rc_bestchef_submission_like_queue(cloud_submission_id, updated_at DESC)`,
];

// -- V22: Pending submission cloud sync queue (B-005) --

export const CREATE_RC_PENDING_SUBMISSIONS = `
CREATE TABLE IF NOT EXISTS rc_pending_submissions (
    local_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    last_error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`;

export const V22_PENDING_SUBMISSIONS_TABLES = [
  CREATE_RC_PENDING_SUBMISSIONS,
];

export const V22_PENDING_SUBMISSIONS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_pending_submissions_next_attempt_idx ON rc_pending_submissions(next_attempt_at)`,
];

// V23 (P11-B / F-034): structured ingredient parity. Most structured columns
// (section, quantity_value, item, prep_note, is_optional) were added in earlier
// migrations; V23 adds raw_line so we can round-trip the original author input
// exactly and re-parse on edit.
export const V23_INGREDIENT_RAW_LINE_ALTERS = [
  `ALTER TABLE rc_ingredients ADD COLUMN raw_line TEXT`,
];

export const V23_INGREDIENT_RAW_LINE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_ingredients_item_idx ON rc_ingredients(item)`,
];

// V24 (P12-A / F-033): persisted helpful state cache.
// Cloud is the source of truth for which comments the current viewer has marked
// helpful, but we cache a per-comment flag locally so optimistic UI survives a
// reload before the cloud read returns. Mirrors the V21 like-cache shape.
export const CREATE_RC_BESTCHEF_COMMENT_HELPFUL = `
CREATE TABLE IF NOT EXISTS rc_bestchef_comment_helpful (
    comment_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL CHECK (is_helpful IN (0, 1)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (comment_id, viewer_id)
)`;

export const V24_BESTCHEF_COMMENT_HELPFUL_TABLES = [
  CREATE_RC_BESTCHEF_COMMENT_HELPFUL,
];

export const V24_BESTCHEF_COMMENT_HELPFUL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_bestchef_comment_helpful_viewer_idx ON rc_bestchef_comment_helpful(viewer_id, updated_at DESC)`,
];

// V25 (P14-A / F-014): saved recipe media editing.
// Multiple photos can be attached to a saved recipe with author-controlled
// ordering. The legacy single image_uri column on rc_recipes stays in place
// as the hero/thumbnail for back-compat; the media table holds the full
// reorderable gallery and is the source of truth for any galleries shown
// on the saved recipe detail screen.
export const CREATE_RC_SAVED_RECIPE_MEDIA = `
CREATE TABLE IF NOT EXISTS rc_saved_recipe_media (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
    uri TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V25_SAVED_RECIPE_MEDIA_TABLES = [
  CREATE_RC_SAVED_RECIPE_MEDIA,
];

export const V25_SAVED_RECIPE_MEDIA_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_saved_recipe_media_recipe_idx ON rc_saved_recipe_media(recipe_id, sort_order)`,
];

// V26 (P14-B / F-016): grocery list media attachments.
// Lists can hold reference photos (a fridge shelf, a written list, a meal
// plan) alongside their items. Stored as a JSON-encoded TEXT column for the
// shared SQLite adapter, mirroring the rc_pantry_batches.photos pattern.
export const V26_GROCERY_LIST_MEDIA_ALTERS = [
  `ALTER TABLE rc_shopping_lists ADD COLUMN media_uris_json TEXT NOT NULL DEFAULT '[]'`,
];

export const V26_GROCERY_LIST_MEDIA_INDEXES: string[] = [];

// V27 (P15-C / F-029, F-030): named custom theme profiles.
// Local mirror of bc_custom_themes (cloud). Holds user-named saved themes
// with full ThemeProfile JSON in token_overrides_json so they survive a
// relaunch and surface in the theme browser alongside presets.
export const CREATE_RC_CUSTOM_THEMES = `
CREATE TABLE IF NOT EXISTS rc_custom_themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    token_overrides_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V27_CUSTOM_THEMES_TABLES = [
  CREATE_RC_CUSTOM_THEMES,
];

export const V27_CUSTOM_THEMES_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_custom_themes_created_idx ON rc_custom_themes(created_at DESC)`,
];

// V28 (P15-D / B-003): pending moderation reports queue.
// When a user submits a report and the cloud insert fails (offline,
// transient outage, RLS denial), the payload is stashed locally so the
// sweeper can retry on app foreground. Mirrors the V22 pending submission
// queue shape; cloud counterpart is bc_pending_reports.
export const CREATE_RC_PENDING_REPORTS = `
CREATE TABLE IF NOT EXISTS rc_pending_reports (
    local_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    last_error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`;

export const V28_PENDING_REPORTS_TABLES = [
  CREATE_RC_PENDING_REPORTS,
];

export const V28_PENDING_REPORTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_pending_reports_next_attempt_idx ON rc_pending_reports(next_attempt_at) WHERE synced = 0`,
  `CREATE INDEX IF NOT EXISTS rc_pending_reports_created_idx ON rc_pending_reports(created_at DESC)`,
];

// V29: migration-managed local moderation history and block list.
// Older app code created these lazily; keeping them in migrations ensures a
// fresh TestFlight install has every tester-write table before first use.
export const CREATE_RC_BESTCHEF_REPORTS = `
CREATE TABLE IF NOT EXISTS rc_bestchef_reports (
    id TEXT PRIMARY KEY,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
)`;

export const CREATE_RC_BESTCHEF_BLOCKS = `
CREATE TABLE IF NOT EXISTS rc_bestchef_blocks (
    id TEXT PRIMARY KEY,
    blocker_id TEXT NOT NULL,
    blocked_handle TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(blocker_id, blocked_handle)
)`;

export const V29_BESTCHEF_MODERATION_LOCAL_TABLES = [
  CREATE_RC_BESTCHEF_REPORTS,
  CREATE_RC_BESTCHEF_BLOCKS,
];

export const V29_BESTCHEF_MODERATION_LOCAL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_bestchef_reports_target_idx ON rc_bestchef_reports(target_kind, target_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_reports_reporter_idx ON rc_bestchef_reports(reporter_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_blocks_blocker_idx ON rc_bestchef_blocks(blocker_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS rc_bestchef_blocks_handle_idx ON rc_bestchef_blocks(blocked_handle)`,
];

// -- V30: Vote proof drafts carry the review payload and a resumable media asset --

export const V30_LOCAL_VOTE_PROOF_REVIEW_COLUMNS = [
  `ALTER TABLE rc_local_vote_proofs ADD COLUMN media_asset_id TEXT`,
  `ALTER TABLE rc_local_vote_proofs ADD COLUMN verdict TEXT`,
  `ALTER TABLE rc_local_vote_proofs ADD COLUMN rating INTEGER`,
  `ALTER TABLE rc_local_vote_proofs ADD COLUMN notes TEXT`,
];

// -- V31: Authoring-time UGC language on local submissions (plan 33 Phase 3.3).
// The cloud alias bridge tags with this instead of the CURRENT app language,
// so switching the app language after authoring cannot mislabel a recipe. --

export const V31_LOCAL_SUBMISSION_LANGUAGE_COLUMNS = [
  `ALTER TABLE rc_bestchef_submissions ADD COLUMN language TEXT`,
];

// -- V32: Local mirror of cloud bookmarks (plan 33 Phase 5.6 F-010).
// Instant/offline saved state + a pending-op queue swept on foreground. --

export const CREATE_RC_SAVED_SUBMISSIONS_CACHE = `
CREATE TABLE IF NOT EXISTS rc_saved_submissions_cache (
    submission_id TEXT PRIMARY KEY,
    saved_at TEXT NOT NULL DEFAULT (datetime('now')),
    pending_op TEXT CHECK (pending_op IN ('save', 'unsave')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V32_SAVED_SUBMISSIONS_CACHE_TABLES = [
  CREATE_RC_SAVED_SUBMISSIONS_CACHE,
];

export const V32_SAVED_SUBMISSIONS_CACHE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_saved_submissions_cache_pending_idx ON rc_saved_submissions_cache(pending_op) WHERE pending_op IS NOT NULL`,
];

// -- V33: Submission media upload queue (plan 33 Phase 4.4, BCSERVER-P0-04).
// Durable jobs with compression state, byte-level progress, attempts, and
// cancellation so media survives app death and retries on foreground. --

export const CREATE_RC_MEDIA_UPLOAD_JOBS = `
CREATE TABLE IF NOT EXISTS rc_media_upload_jobs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
    local_uri TEXT NOT NULL,
    compressed_uri TEXT,
    mime_type TEXT NOT NULL,
    byte_size INTEGER,
    content_hash TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued', 'compressing', 'uploading', 'finalizing', 'done', 'failed', 'cancelled'
    )),
    progress INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    asset_id TEXT,
    public_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V33_MEDIA_UPLOAD_QUEUE_TABLES = [
  CREATE_RC_MEDIA_UPLOAD_JOBS,
];

export const V33_MEDIA_UPLOAD_QUEUE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS rc_media_upload_jobs_owner_idx ON rc_media_upload_jobs(owner_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS rc_media_upload_jobs_status_idx ON rc_media_upload_jobs(status, updated_at)`,
];

// V34: carry client-known media dimensions so finalize can persist
// bc_media_assets.duration_ms/width/height (audit M2). Without these the
// video feed could never show a clip duration.
export const V34_MEDIA_UPLOAD_QUEUE_DIMENSIONS = [
  `ALTER TABLE rc_media_upload_jobs ADD COLUMN duration_ms INTEGER`,
  `ALTER TABLE rc_media_upload_jobs ADD COLUMN width INTEGER`,
  `ALTER TABLE rc_media_upload_jobs ADD COLUMN height INTEGER`,
];
