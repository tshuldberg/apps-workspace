export const CREATE_FOODS = `
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

export const CREATE_NUTRIENTS = `
CREATE TABLE IF NOT EXISTS nu_nutrients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL,
    rda_value REAL,
    rda_unit TEXT,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('vitamin', 'mineral', 'amino_acid', 'fatty_acid', 'other')),
    sort_order INTEGER NOT NULL DEFAULT 0
)`;

export const CREATE_FOOD_NUTRIENTS = `
CREATE TABLE IF NOT EXISTS nu_food_nutrients (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL REFERENCES nu_foods(id) ON DELETE CASCADE,
    nutrient_id TEXT NOT NULL REFERENCES nu_nutrients(id) ON DELETE CASCADE,
    amount REAL NOT NULL DEFAULT 0
)`;

export const CREATE_FOOD_LOG = `
CREATE TABLE IF NOT EXISTS nu_food_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FOOD_LOG_ITEMS = `
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

export const CREATE_DAILY_GOALS = `
CREATE TABLE IF NOT EXISTS nu_daily_goals (
    id TEXT PRIMARY KEY,
    calories REAL NOT NULL,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    effective_date TEXT NOT NULL
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS nu_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_BARCODE_CACHE = `
CREATE TABLE IF NOT EXISTS nu_barcode_cache (
    barcode TEXT PRIMARY KEY,
    food_id TEXT REFERENCES nu_foods(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    raw_json TEXT,
    expires_at TEXT
)`;

// -- Water log (V4) ----------------------------------------------------------

export const CREATE_WATER_LOG = `
CREATE TABLE IF NOT EXISTS nu_water_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount_ml REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'quick_add', 'healthkit')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Energy log (V4) ---------------------------------------------------------

export const CREATE_ENERGY_LOG = `
CREATE TABLE IF NOT EXISTS nu_energy_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    basal_calories REAL NOT NULL DEFAULT 0,
    active_calories REAL NOT NULL DEFAULT 0,
    total_expenditure REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'healthkit', 'calculated')),
    synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Daily notes (V4) --------------------------------------------------------

export const CREATE_DAILY_NOTES = `
CREATE TABLE IF NOT EXISTS nu_daily_notes (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Restaurants (V4) --------------------------------------------------------

export const CREATE_RESTAURANTS = `
CREATE TABLE IF NOT EXISTS nu_restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('fast_food', 'casual', 'fine_dining', 'cafe', 'pizza', 'asian', 'mexican', 'other')),
    chain INTEGER NOT NULL DEFAULT 0,
    logo_emoji TEXT,
    website TEXT,
    source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'user', 'api')),
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MENU_ITEMS = `
CREATE TABLE IF NOT EXISTS nu_menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES nu_restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    serving_size TEXT,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    fiber_g REAL NOT NULL DEFAULT 0,
    sodium_mg REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'user', 'official')),
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RESTAURANTS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS nu_restaurants_fts USING fts5(
    name, content='nu_restaurants', content_rowid='rowid'
)`;

export const CREATE_MENU_ITEMS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS nu_menu_items_fts USING fts5(
    name, description, category, content='nu_menu_items', content_rowid='rowid'
)`;

export const CREATE_RESTAURANT_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS nu_restaurants_ai AFTER INSERT ON nu_restaurants BEGIN
    INSERT INTO nu_restaurants_fts(rowid, name) VALUES (new.rowid, new.name);
  END`,
  `CREATE TRIGGER IF NOT EXISTS nu_restaurants_ad AFTER DELETE ON nu_restaurants BEGIN
    INSERT INTO nu_restaurants_fts(nu_restaurants_fts, rowid, name) VALUES('delete', old.rowid, old.name);
  END`,
  `CREATE TRIGGER IF NOT EXISTS nu_restaurants_au AFTER UPDATE ON nu_restaurants BEGIN
    INSERT INTO nu_restaurants_fts(nu_restaurants_fts, rowid, name) VALUES('delete', old.rowid, old.name);
    INSERT INTO nu_restaurants_fts(rowid, name) VALUES (new.rowid, new.name);
  END`,
];

export const CREATE_MENU_ITEMS_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS nu_menu_items_ai AFTER INSERT ON nu_menu_items BEGIN
    INSERT INTO nu_menu_items_fts(rowid, name, description, category) VALUES (new.rowid, new.name, new.description, new.category);
  END`,
  `CREATE TRIGGER IF NOT EXISTS nu_menu_items_ad AFTER DELETE ON nu_menu_items BEGIN
    INSERT INTO nu_menu_items_fts(nu_menu_items_fts, rowid, name, description, category) VALUES('delete', old.rowid, old.name, old.description, old.category);
  END`,
  `CREATE TRIGGER IF NOT EXISTS nu_menu_items_au AFTER UPDATE ON nu_menu_items BEGIN
    INSERT INTO nu_menu_items_fts(nu_menu_items_fts, rowid, name, description, category) VALUES('delete', old.rowid, old.name, old.description, old.category);
    INSERT INTO nu_menu_items_fts(rowid, name, description, category) VALUES (new.rowid, new.name, new.description, new.category);
  END`,
];

// -- V4 indexes --------------------------------------------------------------

export const CREATE_V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS nu_water_log_date_idx ON nu_water_log(date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS nu_energy_log_date_idx ON nu_energy_log(date)`,
  `CREATE INDEX IF NOT EXISTS nu_daily_notes_date_idx ON nu_daily_notes(date)`,
  `CREATE INDEX IF NOT EXISTS nu_restaurants_category_idx ON nu_restaurants(category)`,
  `CREATE INDEX IF NOT EXISTS nu_restaurants_chain_idx ON nu_restaurants(chain)`,
  `CREATE INDEX IF NOT EXISTS nu_menu_items_restaurant_idx ON nu_menu_items(restaurant_id)`,
  `CREATE INDEX IF NOT EXISTS nu_menu_items_category_idx ON nu_menu_items(category)`,
];

// -- V4 seed settings --------------------------------------------------------

export const SEED_V4_SETTINGS = [
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('waterGoalMl', '2500')`,
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('waterContainersMl', '[250, 500, 750]')`,
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('waterUnit', 'ml')`,
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('syncEnabled', 'false')`,
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('syncDirection', 'read')`,
];

// -- Photo log (V3) ----------------------------------------------------------

export const CREATE_PHOTO_LOG = `
CREATE TABLE IF NOT EXISTS nu_photo_log (
    id TEXT PRIMARY KEY,
    image_uri TEXT NOT NULL,
    ai_response_json TEXT,
    accepted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Full-text search --------------------------------------------------------

export const CREATE_FOODS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS nu_foods_fts USING fts5(
    name, brand, content='nu_foods', content_rowid='rowid'
)`;

// -- FTS sync triggers -------------------------------------------------------

export const CREATE_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS nu_foods_ai AFTER INSERT ON nu_foods BEGIN
    INSERT INTO nu_foods_fts(rowid, name, brand) VALUES (new.rowid, new.name, new.brand);
  END`,
  `CREATE TRIGGER IF NOT EXISTS nu_foods_ad AFTER DELETE ON nu_foods BEGIN
    INSERT INTO nu_foods_fts(nu_foods_fts, rowid, name, brand) VALUES('delete', old.rowid, old.name, old.brand);
  END`,
  `CREATE TRIGGER IF NOT EXISTS nu_foods_au AFTER UPDATE ON nu_foods BEGIN
    INSERT INTO nu_foods_fts(nu_foods_fts, rowid, name, brand) VALUES('delete', old.rowid, old.name, old.brand);
    INSERT INTO nu_foods_fts(rowid, name, brand) VALUES (new.rowid, new.name, new.brand);
  END`,
];

// -- Indexes -----------------------------------------------------------------

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS nu_foods_barcode_idx ON nu_foods(barcode)`,
  `CREATE INDEX IF NOT EXISTS nu_foods_source_idx ON nu_foods(source)`,
  `CREATE INDEX IF NOT EXISTS nu_food_nutrients_food_idx ON nu_food_nutrients(food_id)`,
  `CREATE INDEX IF NOT EXISTS nu_food_nutrients_nutrient_idx ON nu_food_nutrients(nutrient_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS nu_food_nutrients_pair_idx ON nu_food_nutrients(food_id, nutrient_id)`,
  `CREATE INDEX IF NOT EXISTS nu_food_log_date_idx ON nu_food_log(date)`,
  `CREATE INDEX IF NOT EXISTS nu_food_log_meal_idx ON nu_food_log(date, meal_type)`,
  `CREATE INDEX IF NOT EXISTS nu_food_log_items_log_idx ON nu_food_log_items(log_id)`,
  `CREATE INDEX IF NOT EXISTS nu_food_log_items_food_idx ON nu_food_log_items(food_id)`,
  `CREATE INDEX IF NOT EXISTS nu_daily_goals_date_idx ON nu_daily_goals(effective_date)`,
  `CREATE INDEX IF NOT EXISTS nu_barcode_cache_food_idx ON nu_barcode_cache(food_id)`,
];

// -- All tables (V1) ---------------------------------------------------------

export const ALL_TABLES = [
  CREATE_FOODS,
  CREATE_NUTRIENTS,
  CREATE_FOOD_NUTRIENTS,
  CREATE_FOOD_LOG,
  CREATE_FOOD_LOG_ITEMS,
  CREATE_DAILY_GOALS,
  CREATE_SETTINGS,
  CREATE_BARCODE_CACHE,
  CREATE_FOODS_FTS,
];


// -- Community profiles (V5) -------------------------------------------------

export const CREATE_COMMUNITY_PROFILES = `
CREATE TABLE IF NOT EXISTS nu_community_profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar_emoji TEXT NOT NULL DEFAULT '\U0001F966',
    bio TEXT,
    share_streaks INTEGER NOT NULL DEFAULT 1,
    share_goals INTEGER NOT NULL DEFAULT 0,
    share_calories INTEGER NOT NULL DEFAULT 0,
    share_macros INTEGER NOT NULL DEFAULT 0,
    share_weight INTEGER NOT NULL DEFAULT 0,
    profile_visibility TEXT NOT NULL DEFAULT 'connections'
        CHECK (profile_visibility IN ('private', 'connections', 'public')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMMUNITY_CONNECTIONS = `
CREATE TABLE IF NOT EXISTS nu_community_connections (
    id TEXT PRIMARY KEY,
    from_profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    to_profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMMUNITY_FEED = `
CREATE TABLE IF NOT EXISTS nu_community_feed (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL
        CHECK (activity_type IN ('streak', 'goal_hit', 'challenge_joined', 'challenge_complete', 'milestone', 'custom')),
    title TEXT NOT NULL,
    body TEXT,
    metadata_json TEXT,
    visibility TEXT NOT NULL DEFAULT 'connections'
        CHECK (visibility IN ('private', 'connections', 'public')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMMUNITY_CHALLENGES = `
CREATE TABLE IF NOT EXISTS nu_community_challenges (
    id TEXT PRIMARY KEY,
    creator_profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL
        CHECK (challenge_type IN ('streak', 'calorie_target', 'protein_target', 'water_target', 'log_streak', 'custom')),
    target_value REAL,
    target_unit TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    max_participants INTEGER DEFAULT 50,
    join_type TEXT NOT NULL DEFAULT 'invite'
        CHECK (join_type IN ('open', 'invite', 'approval')),
    status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMMUNITY_CHALLENGE_MEMBERS = `
CREATE TABLE IF NOT EXISTS nu_community_challenge_members (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES nu_community_challenges(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('creator', 'member')),
    current_value REAL NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
)`;

export const CREATE_V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS nu_cc_from_idx ON nu_community_connections(from_profile_id)`,
  `CREATE INDEX IF NOT EXISTS nu_cc_to_idx ON nu_community_connections(to_profile_id)`,
  `CREATE INDEX IF NOT EXISTS nu_cc_status_idx ON nu_community_connections(status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS nu_cc_pair_idx ON nu_community_connections(from_profile_id, to_profile_id)`,
  `CREATE INDEX IF NOT EXISTS nu_cf_profile_idx ON nu_community_feed(profile_id)`,
  `CREATE INDEX IF NOT EXISTS nu_cf_created_idx ON nu_community_feed(created_at)`,
  `CREATE INDEX IF NOT EXISTS nu_cf_type_idx ON nu_community_feed(activity_type)`,
  `CREATE INDEX IF NOT EXISTS nu_cch_status_idx ON nu_community_challenges(status)`,
  `CREATE INDEX IF NOT EXISTS nu_cch_dates_idx ON nu_community_challenges(start_date, end_date)`,
  `CREATE INDEX IF NOT EXISTS nu_ccm_challenge_idx ON nu_community_challenge_members(challenge_id)`,
  `CREATE INDEX IF NOT EXISTS nu_ccm_profile_idx ON nu_community_challenge_members(profile_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS nu_ccm_pair_idx ON nu_community_challenge_members(challenge_id, profile_id)`,
];

// -- Seed settings -----------------------------------------------------------

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('defaultMealType', 'lunch')`,
  `INSERT OR IGNORE INTO nu_settings (key, value) VALUES ('calorieGoal', '2000')`,
];

// V6: Favorites and meal templates
export const CREATE_FAVORITES = `
CREATE TABLE IF NOT EXISTS nu_favorites (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL REFERENCES nu_foods(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(food_id)
)`;

export const CREATE_MEAL_TEMPLATES = `
CREATE TABLE IF NOT EXISTS nu_meal_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'breakfast' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MEAL_TEMPLATE_ITEMS = `
CREATE TABLE IF NOT EXISTS nu_meal_template_items (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES nu_meal_templates(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL REFERENCES nu_foods(id) ON DELETE CASCADE,
    serving_count REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_V6_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_nu_favorites_food_id ON nu_favorites(food_id)',
  'CREATE INDEX IF NOT EXISTS idx_nu_meal_template_items_template_id ON nu_meal_template_items(template_id)',
];

// V7: Add logged_at timestamp to food log items for diary timestamps
export const ALTER_FOOD_LOG_ITEMS_ADD_LOGGED_AT =
  `ALTER TABLE nu_food_log_items ADD COLUMN logged_at TEXT DEFAULT NULL`;

// V8: Add richer Phase 3 note metadata and restaurant artwork support
export const ALTER_DAILY_NOTES_ADD_MEAL_TYPES =
  `ALTER TABLE nu_daily_notes ADD COLUMN meal_types TEXT`;

export const ALTER_DAILY_NOTES_ADD_LINKED_FOOD_IDS =
  `ALTER TABLE nu_daily_notes ADD COLUMN linked_food_ids TEXT`;

export const ALTER_RESTAURANTS_ADD_LOGO_URI =
  `ALTER TABLE nu_restaurants ADD COLUMN logo_uri TEXT`;
