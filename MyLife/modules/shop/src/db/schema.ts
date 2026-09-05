import type { Migration } from '@mylife/module-registry';

/**
 * SQLite schema for MyShop module.
 * All table names use the sh_ prefix to avoid collisions in the shared hub database.
 */

// ── V1: Settings foundation ──────────────────────────────────────────

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS sh_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const BASE_TABLES: string[] = [CREATE_SETTINGS];

// ── V2: Universal Wishlist ────────────────────────────────────────────

export const CREATE_WISHLISTS = `
CREATE TABLE IF NOT EXISTS sh_wishlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  occasion TEXT,
  person_id TEXT,
  is_shareable INTEGER NOT NULL DEFAULT 0,
  share_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export const CREATE_WISHLIST_ITEMS = `
CREATE TABLE IF NOT EXISTS sh_wishlist_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES sh_wishlists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description_md TEXT,
  price_cents INTEGER,
  price_range_low INTEGER,
  price_range_high INTEGER,
  priority TEXT NOT NULL,
  url TEXT,
  photo_id TEXT,
  store TEXT,
  brand TEXT,
  occasion_tag TEXT,
  notes_md TEXT,
  size_notes TEXT,
  is_purchased INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT,
  purchase_id TEXT,
  is_gift_for TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export const CREATE_PHOTOS = `
CREATE TABLE IF NOT EXISTS sh_photos (
  id TEXT PRIMARY KEY,
  purchase_id TEXT,
  wishlist_item_id TEXT,
  warranty_id TEXT,
  kind TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL
)`;

export const WISHLIST_TABLES: string[] = [
  CREATE_WISHLISTS,
  CREATE_WISHLIST_ITEMS,
  CREATE_PHOTOS,
];

export const WISHLIST_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_wishlist_items_list_idx ON sh_wishlist_items(list_id)`,
  `CREATE INDEX IF NOT EXISTS sh_wishlist_items_category_idx ON sh_wishlist_items(category)`,
  `CREATE INDEX IF NOT EXISTS sh_wishlist_items_priority_idx ON sh_wishlist_items(priority)`,
  `CREATE INDEX IF NOT EXISTS sh_wishlist_items_purchased_idx ON sh_wishlist_items(is_purchased)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sh_wishlists_share_token_idx ON sh_wishlists(share_token) WHERE share_token IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS sh_photos_wishlist_item_idx ON sh_photos(wishlist_item_id)`,
  `CREATE INDEX IF NOT EXISTS sh_photos_purchase_idx ON sh_photos(purchase_id)`,
];

// ── V3: Purchase Journal ──────────────────────────────────────────────

export const CREATE_PURCHASES = `
CREATE TABLE IF NOT EXISTS sh_purchases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  purchase_date TEXT NOT NULL,
  store TEXT,
  payment_method TEXT,
  brand TEXT,
  url TEXT,
  receipt_photo_id TEXT REFERENCES sh_photos(id) ON DELETE SET NULL,
  satisfaction_initial INTEGER,
  satisfaction_30day INTEGER,
  satisfaction_90day INTEGER,
  is_impulse INTEGER NOT NULL DEFAULT 0,
  research_notes_md TEXT,
  return_deadline TEXT,
  returned INTEGER NOT NULL DEFAULT 0,
  return_reason TEXT,
  wishlist_item_id TEXT REFERENCES sh_wishlist_items(id) ON DELETE SET NULL,
  notes_md TEXT,
  photo_id TEXT REFERENCES sh_photos(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export const PURCHASES_TABLES: string[] = [CREATE_PURCHASES];

export const PURCHASES_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_purchases_date_idx ON sh_purchases(purchase_date)`,
  `CREATE INDEX IF NOT EXISTS sh_purchases_category_idx ON sh_purchases(category)`,
  `CREATE INDEX IF NOT EXISTS sh_purchases_store_idx ON sh_purchases(store)`,
  `CREATE INDEX IF NOT EXISTS sh_purchases_impulse_idx ON sh_purchases(is_impulse)`,
  `CREATE INDEX IF NOT EXISTS sh_purchases_return_deadline_idx ON sh_purchases(return_deadline)`,
  `CREATE INDEX IF NOT EXISTS sh_purchases_wishlist_item_idx ON sh_purchases(wishlist_item_id)`,
];

// ── V3 (extended): Usage Log for cost-per-use tracking ────────────────
// Lands in the same v3 migration alongside sh_purchases. Do not bump to v4.

export const CREATE_USAGE_LOG = `
CREATE TABLE IF NOT EXISTS sh_usage_log (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES sh_purchases(id) ON DELETE CASCADE,
  used_at INTEGER NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
)`;

export const USAGE_LOG_TABLES: string[] = [CREATE_USAGE_LOG];

export const USAGE_LOG_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_usage_log_purchase_idx ON sh_usage_log(purchase_id)`,
  `CREATE INDEX IF NOT EXISTS sh_usage_log_used_at_idx ON sh_usage_log(used_at DESC)`,
];

// ── V4: Warranty + Return Tracker ─────────────────────────────────────

export const CREATE_WARRANTIES = `
CREATE TABLE IF NOT EXISTS sh_warranties (
  id TEXT PRIMARY KEY,
  purchase_id TEXT REFERENCES sh_purchases(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  coverage_type TEXT NOT NULL CHECK(coverage_type IN ('manufacturer','extended','protection')),
  start_date INTEGER NOT NULL,
  expiry_date INTEGER NOT NULL,
  coverage_details_md TEXT,
  serial_number TEXT,
  registration_number TEXT,
  claim_filed INTEGER NOT NULL DEFAULT 0,
  claim_notes TEXT,
  reminder_days_before INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const WARRANTIES_TABLES: string[] = [CREATE_WARRANTIES];

export const WARRANTIES_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_warranties_purchase_idx ON sh_warranties(purchase_id)`,
  `CREATE INDEX IF NOT EXISTS sh_warranties_expiry_idx ON sh_warranties(expiry_date ASC)`,
  `CREATE INDEX IF NOT EXISTS sh_warranties_coverage_type_idx ON sh_warranties(coverage_type)`,
];

// ── V5: Size + Preference Memory ──────────────────────────────────────

export const CREATE_SIZES = `
CREATE TABLE IF NOT EXISTS sh_sizes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('clothing','shoe','ring','other')),
  brand TEXT NOT NULL,
  size_value TEXT NOT NULL,
  fit_notes TEXT,
  last_verified INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const SIZES_TABLES: string[] = [CREATE_SIZES];

export const SIZES_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_sizes_type_brand_idx ON sh_sizes(type, brand)`,
  `CREATE INDEX IF NOT EXISTS sh_sizes_brand_idx ON sh_sizes(brand)`,
];

export const CREATE_PREFERENCES = `
CREATE TABLE IF NOT EXISTS sh_preferences (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('tech','household','color','brand','material','allergy')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(category, key)
)`;

export const PREFERENCES_TABLES: string[] = [CREATE_PREFERENCES];

export const PREFERENCES_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_preferences_category_idx ON sh_preferences(category)`,
];

// ── V6: Gift Shopping ─────────────────────────────────────────────────

export const CREATE_GIFT_PEOPLE = `
CREATE TABLE IF NOT EXISTS sh_gift_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relationship TEXT,
  next_occasion TEXT,
  next_occasion_date INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const CREATE_GIFTS_GIVEN = `
CREATE TABLE IF NOT EXISTS sh_gifts_given (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  person_name TEXT NOT NULL,
  item_description TEXT NOT NULL,
  occasion TEXT NOT NULL CHECK(occasion IN ('birthday','holiday','graduation','housewarming','thank_you','other')),
  occasion_label TEXT,
  purchase_id TEXT REFERENCES sh_purchases(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  gift_date INTEGER NOT NULL,
  reaction_notes TEXT,
  photo_id TEXT,
  is_group_gift INTEGER NOT NULL DEFAULT 0,
  group_total_cents INTEGER,
  my_share_cents INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const CREATE_GIFT_BUDGETS = `
CREATE TABLE IF NOT EXISTS sh_gift_budgets (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  occasion TEXT,
  amount_cents INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(person_id, occasion)
)`;

export const GIFTS_TABLES: string[] = [
  CREATE_GIFT_PEOPLE,
  CREATE_GIFTS_GIVEN,
  CREATE_GIFT_BUDGETS,
];

export const GIFTS_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_gift_people_next_occasion_idx ON sh_gift_people(next_occasion_date ASC)`,
  `CREATE INDEX IF NOT EXISTS sh_gifts_given_person_idx ON sh_gifts_given(person_id)`,
  `CREATE INDEX IF NOT EXISTS sh_gifts_given_date_idx ON sh_gifts_given(gift_date DESC)`,
  `CREATE INDEX IF NOT EXISTS sh_gifts_given_occasion_idx ON sh_gifts_given(occasion)`,
  `CREATE INDEX IF NOT EXISTS sh_gifts_given_person_date_idx ON sh_gifts_given(person_id, gift_date DESC)`,
  `CREATE INDEX IF NOT EXISTS sh_gift_budgets_person_idx ON sh_gift_budgets(person_id)`,
  `CREATE INDEX IF NOT EXISTS sh_wishlist_items_gift_for_person_idx ON sh_wishlist_items(gift_for_person_id)`,
];

export const ALTER_WISHLIST_ITEMS_GIFT_FOR_PERSON = `
ALTER TABLE sh_wishlist_items ADD COLUMN gift_for_person_id TEXT REFERENCES sh_gift_people(id) ON DELETE SET NULL`;

// ── V7: 30-Day Rule (Spending Awareness) ──────────────────────────────

export const CREATE_THIRTY_DAY_RULE = `
CREATE TABLE IF NOT EXISTS sh_thirty_day_rule (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  reason_md TEXT,
  added_at INTEGER NOT NULL,
  decision TEXT NOT NULL DEFAULT 'waiting' CHECK(decision IN ('waiting','bought','skipped')),
  decided_at INTEGER,
  purchase_id TEXT REFERENCES sh_purchases(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const THIRTY_DAY_RULE_TABLES: string[] = [CREATE_THIRTY_DAY_RULE];

export const THIRTY_DAY_RULE_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_thirty_day_rule_decision_idx ON sh_thirty_day_rule(decision)`,
  `CREATE INDEX IF NOT EXISTS sh_thirty_day_rule_added_at_idx ON sh_thirty_day_rule(added_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sh_thirty_day_rule_decision_added_idx ON sh_thirty_day_rule(decision, added_at)`,
];

// ── V8: Research Comparisons + Store Notes ────────────────────────────

export const CREATE_COMPARISONS = `
CREATE TABLE IF NOT EXISTS sh_comparisons (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  items_json TEXT NOT NULL,
  winner TEXT,
  reasoning_md TEXT,
  decided_at INTEGER,
  purchase_id TEXT REFERENCES sh_purchases(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const COMPARISONS_TABLES: string[] = [CREATE_COMPARISONS];

export const COMPARISONS_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_comparisons_category_idx ON sh_comparisons(category)`,
  `CREATE INDEX IF NOT EXISTS sh_comparisons_decided_at_idx ON sh_comparisons(decided_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sh_comparisons_created_at_idx ON sh_comparisons(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sh_comparisons_purchase_idx ON sh_comparisons(purchase_id)`,
];

export const CREATE_STORE_NOTES = `
CREATE TABLE IF NOT EXISTS sh_store_notes (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL UNIQUE,
  returns_policy TEXT,
  shipping_notes TEXT,
  rewards_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export const STORE_NOTES_TABLES: string[] = [CREATE_STORE_NOTES];

export const STORE_NOTES_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sh_store_notes_name_idx ON sh_store_notes(store_name)`,
];

/**
 * Ordered migration list for the MyShop module. Each entry is a contiguous
 * version starting at 1; the migration runner in `@mylife/db` records applied
 * versions in `hub_schema_versions`.
 */
export function getMigrations(): Migration[] {
  return [
    {
      version: 1,
      description: 'Create sh_settings',
      up: [...BASE_TABLES],
      down: ['DROP TABLE IF EXISTS sh_settings'],
    },
    {
      version: 2,
      description: 'Universal wishlist: sh_wishlists, sh_wishlist_items, sh_photos',
      up: [...WISHLIST_TABLES, ...WISHLIST_INDEXES],
      down: [
        'DROP TABLE IF EXISTS sh_photos',
        'DROP TABLE IF EXISTS sh_wishlist_items',
        'DROP TABLE IF EXISTS sh_wishlists',
      ],
    },
    {
      version: 3,
      description:
        'Purchase journal: sh_purchases with satisfaction + return tracking; sh_usage_log for cost-per-use',
      up: [
        ...PURCHASES_TABLES,
        ...PURCHASES_INDEXES,
        ...USAGE_LOG_TABLES,
        ...USAGE_LOG_INDEXES,
      ],
      down: [
        'DROP TABLE IF EXISTS sh_usage_log',
        'DROP TABLE IF EXISTS sh_purchases',
      ],
    },
    {
      version: 4,
      description:
        'Warranty tracker: sh_warranties for coverage, expiry, and claim history',
      up: [...WARRANTIES_TABLES, ...WARRANTIES_INDEXES],
      down: ['DROP TABLE IF EXISTS sh_warranties'],
    },
    {
      version: 5,
      description:
        'Size + preference memory: sh_sizes for clothing/shoe/ring fit history, sh_preferences for category key/value prefs',
      up: [
        ...SIZES_TABLES,
        ...SIZES_INDEXES,
        ...PREFERENCES_TABLES,
        ...PREFERENCES_INDEXES,
      ],
      down: [
        'DROP TABLE IF EXISTS sh_preferences',
        'DROP TABLE IF EXISTS sh_sizes',
      ],
    },
    {
      version: 6,
      description:
        'Gift shopping: sh_gift_people registry, sh_gifts_given log, sh_gift_budgets per person/occasion, plus wishlist gift_for_person_id linkage',
      up: [
        ...GIFTS_TABLES,
        ALTER_WISHLIST_ITEMS_GIFT_FOR_PERSON,
        ...GIFTS_INDEXES,
      ],
      down: [
        'DROP TABLE IF EXISTS sh_gift_budgets',
        'DROP TABLE IF EXISTS sh_gifts_given',
        'DROP TABLE IF EXISTS sh_gift_people',
      ],
    },
    {
      version: 7,
      description:
        'Spending awareness: sh_thirty_day_rule wait list with decision tracking and purchase linkage',
      up: [...THIRTY_DAY_RULE_TABLES, ...THIRTY_DAY_RULE_INDEXES],
      down: ['DROP TABLE IF EXISTS sh_thirty_day_rule'],
    },
    {
      version: 8,
      description:
        'Research comparisons + store loyalty notes: sh_comparisons stores side-by-side product evaluations with optional purchase linkage; sh_store_notes captures returns/shipping/rewards per store',
      up: [
        ...COMPARISONS_TABLES,
        ...COMPARISONS_INDEXES,
        ...STORE_NOTES_TABLES,
        ...STORE_NOTES_INDEXES,
      ],
      down: [
        'DROP TABLE IF EXISTS sh_store_notes',
        'DROP TABLE IF EXISTS sh_comparisons',
      ],
    },
  ];
}
