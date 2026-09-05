import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  ENHANCED_RECIPE_INDEXES,
  MEAL_PLAN_TABLES,
  MEAL_PLAN_INDEXES,
  PANTRY_EVOLUTION_STATEMENTS,
  SEED_PANTRY_STAPLES,
  SEED_SETTINGS,
  V4_TABLES,
  V4_INDEXES,
  V5_TABLES,
  V5_INDEXES,
  V6_TABLES,
  V6_INDEXES,
  V7_DROP_GARDEN_EVENTS,
  V8_SOCIAL_TABLES,
  V8_SOCIAL_INDEXES,
  V9_BESTCHEF_SOCIAL_TABLES,
  V9_BESTCHEF_SOCIAL_INDEXES,
  V10_BESTCHEF_MEDIA_TABLES,
  V10_BESTCHEF_MEDIA_INDEXES,
  V11_RECIPE_GROCERY_FLAG_TABLES,
  V11_RECIPE_GROCERY_FLAG_INDEXES,
  V12_FOOD_IDENTITY_TABLES,
  V12_FOOD_IDENTITY_ALTERS,
  V12_FOOD_IDENTITY_INDEXES,
  V13_PANTRY_BATCH_TABLES,
  V13_PANTRY_BATCH_MIGRATIONS,
  V13_PANTRY_BATCH_INDEXES,
  V14_SHOPPING_LIST_ORGANIZATION_ALTERS,
  V14_SHOPPING_LIST_ORGANIZATION_INDEXES,
  V15_RECEIPT_IMPORT_TABLES,
  V15_RECEIPT_IMPORT_INDEXES,
  V16_EXPIRATION_OCR_BATCH_SOURCE_MIGRATIONS,
  V17_UNIT_CONVERSION_CORRECTION_TABLES,
  V17_UNIT_CONVERSION_CORRECTION_INDEXES,
  V18_LOCAL_VOTE_PROOF_TABLES,
  V18_LOCAL_VOTE_PROOF_INDEXES,
  V19_RECIPE_COOK_HISTORY_TABLES,
  V19_RECIPE_COOK_HISTORY_INDEXES,
  V20_RECIPE_SOURCE_ATTRIBUTION_ALTERS,
  V20_RECIPE_SOURCE_ATTRIBUTION_INDEXES,
  V21_BESTCHEF_SUBMISSION_LIKE_TABLES,
  V21_BESTCHEF_SUBMISSION_LIKE_INDEXES,
  V22_PENDING_SUBMISSIONS_TABLES,
  V22_PENDING_SUBMISSIONS_INDEXES,
  V23_INGREDIENT_RAW_LINE_ALTERS,
  V23_INGREDIENT_RAW_LINE_INDEXES,
  V24_BESTCHEF_COMMENT_HELPFUL_TABLES,
  V24_BESTCHEF_COMMENT_HELPFUL_INDEXES,
  V25_SAVED_RECIPE_MEDIA_TABLES,
  V25_SAVED_RECIPE_MEDIA_INDEXES,
  V26_GROCERY_LIST_MEDIA_ALTERS,
  V26_GROCERY_LIST_MEDIA_INDEXES,
  V27_CUSTOM_THEMES_TABLES,
  V27_CUSTOM_THEMES_INDEXES,
  V28_PENDING_REPORTS_TABLES,
  V28_PENDING_REPORTS_INDEXES,
  V29_BESTCHEF_MODERATION_LOCAL_TABLES,
  V29_BESTCHEF_MODERATION_LOCAL_INDEXES,
  V30_LOCAL_VOTE_PROOF_REVIEW_COLUMNS,
  V31_LOCAL_SUBMISSION_LANGUAGE_COLUMNS,
  V32_SAVED_SUBMISSIONS_CACHE_TABLES,
  V32_SAVED_SUBMISSIONS_CACHE_INDEXES,
  V33_MEDIA_UPLOAD_QUEUE_TABLES,
  V33_MEDIA_UPLOAD_QUEUE_INDEXES,
  V34_MEDIA_UPLOAD_QUEUE_DIMENSIONS,
} from './db/schema';

const RECIPES_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial recipe schema and settings',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_recipe_tags',
    'DROP TABLE IF EXISTS rc_steps',
    'DROP TABLE IF EXISTS rc_ingredients',
    'DROP TABLE IF EXISTS rc_settings',
    'DROP TABLE IF EXISTS rc_recipes',
  ],
};

const RECIPES_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Meal planning tables (historical garden/events tables are owned by their modules)',
  up: [
    ...MEAL_PLAN_TABLES,
    ...MEAL_PLAN_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_meal_plan_items',
    'DROP TABLE IF EXISTS rc_meal_plans',
  ],
};

const RECIPES_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Structured ingredients, pantry inventory, and grocery planning support',
  up: [
    ...PANTRY_EVOLUTION_STATEMENTS,
    ...ENHANCED_RECIPE_INDEXES,
    ...SEED_PANTRY_STAPLES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_pantry_staples',
    'DROP TABLE IF EXISTS rc_pantry_items',
  ],
};

const RECIPES_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Collections and nutrition data',
  up: [...V4_TABLES, ...V4_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_nutrition_data',
    'DROP TABLE IF EXISTS rc_recipe_collections',
    'DROP TABLE IF EXISTS rc_collections',
  ],
};

const RECIPES_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Custom shopping lists with recipe integration',
  up: [...V5_TABLES, ...V5_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_shopping_list_items',
    'DROP TABLE IF EXISTS rc_shopping_lists',
  ],
};

const RECIPES_MIGRATION_V6: Migration = {
  version: 6,
  description: 'Recipe sharing with share tokens',
  up: [...V6_TABLES, ...V6_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_share_tokens',
  ],
};

const RECIPES_MIGRATION_V7: Migration = {
  version: 7,
  description: 'Drop garden and events tables (data now owned by garden + rsvp modules)',
  up: V7_DROP_GARDEN_EVENTS,
  down: [
    // V7 is a destructive DROP. Re-creating these tables would require re-running V2.
    // Garden and RSVP modules independently own this data now.
  ],
};

const RECIPES_MIGRATION_V8: Migration = {
  version: 8,
  description: 'Local chef follows and follower update seed payloads',
  up: [...V8_SOCIAL_TABLES, ...V8_SOCIAL_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_follower_update_seeds',
    'DROP TABLE IF EXISTS rc_chef_follows',
  ],
};

const RECIPES_MIGRATION_V9: Migration = {
  version: 9,
  description: 'BestChef beta submissions, votes, and comment activity',
  up: [...V9_BESTCHEF_SOCIAL_TABLES, ...V9_BESTCHEF_SOCIAL_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_bestchef_votes',
    'DROP TABLE IF EXISTS rc_bestchef_comments',
    'DROP TABLE IF EXISTS rc_bestchef_submissions',
  ],
};

const RECIPES_MIGRATION_V10: Migration = {
  version: 10,
  description: 'Device-local BestChef media cache manifest',
  up: [...V10_BESTCHEF_MEDIA_TABLES, ...V10_BESTCHEF_MEDIA_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_bestchef_media_cache',
  ],
};

const RECIPES_MIGRATION_V11: Migration = {
  version: 11,
  description: 'Private recipe grocery flags for saved shopping-list workflows',
  up: [...V11_RECIPE_GROCERY_FLAG_TABLES, ...V11_RECIPE_GROCERY_FLAG_INDEXES],
  down: [
    'DROP TABLE IF EXISTS rc_recipe_grocery_flags',
  ],
};

const RECIPES_MIGRATION_V12: Migration = {
  version: 12,
  description: 'Canonical food identity, barcode aliases, and nutrition provenance',
  up: [
    ...V12_FOOD_IDENTITY_TABLES,
    ...V12_FOOD_IDENTITY_ALTERS,
    ...V12_FOOD_IDENTITY_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_food_confirmations',
    'DROP TABLE IF EXISTS rc_food_product_aliases',
    'DROP TABLE IF EXISTS rc_food_products',
  ],
};

const RECIPES_MIGRATION_V13: Migration = {
  version: 13,
  description: 'Pantry batch and lot tracking',
  up: [
    ...V13_PANTRY_BATCH_TABLES,
    ...V13_PANTRY_BATCH_MIGRATIONS,
    ...V13_PANTRY_BATCH_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_pantry_batches',
  ],
};

const RECIPES_MIGRATION_V14: Migration = {
  version: 14,
  description: 'Shopping list organization metadata and archive timestamps',
  up: [
    ...V14_SHOPPING_LIST_ORGANIZATION_ALTERS,
    ...V14_SHOPPING_LIST_ORGANIZATION_INDEXES,
  ],
  down: [
    // SQLite cannot drop added columns safely without rebuilding the table.
  ],
};

const RECIPES_MIGRATION_V15: Migration = {
  version: 15,
  description: 'Receipt OCR import review, product matching, and pantry confirmation',
  up: [
    ...V15_RECEIPT_IMPORT_TABLES,
    ...V15_RECEIPT_IMPORT_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_receipt_import_lines',
    'DROP TABLE IF EXISTS rc_receipt_imports',
  ],
};

const RECIPES_MIGRATION_V16: Migration = {
  version: 16,
  description: 'Expiration OCR pantry batch source',
  up: [
    ...V16_EXPIRATION_OCR_BATCH_SOURCE_MIGRATIONS,
    ...V13_PANTRY_BATCH_INDEXES,
  ],
  down: [
    // SQLite cannot remove a CHECK value without rebuilding the table.
  ],
};

const RECIPES_MIGRATION_V17: Migration = {
  version: 17,
  description: 'Reusable recipe nutrition unit conversion corrections',
  up: [
    ...V17_UNIT_CONVERSION_CORRECTION_TABLES,
    ...V17_UNIT_CONVERSION_CORRECTION_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_unit_conversion_corrections',
  ],
};

const RECIPES_MIGRATION_V18: Migration = {
  version: 18,
  description: 'Device-local vote proof drafts for proof-gated public voting',
  up: [
    ...V18_LOCAL_VOTE_PROOF_TABLES,
    ...V18_LOCAL_VOTE_PROOF_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_local_vote_proofs',
  ],
};

const RECIPES_MIGRATION_V19: Migration = {
  version: 19,
  description: 'Recipe cook history for pantry decrement review',
  up: [
    ...V19_RECIPE_COOK_HISTORY_TABLES,
    ...V19_RECIPE_COOK_HISTORY_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_recipe_cook_history',
  ],
};

const RECIPES_MIGRATION_V20: Migration = {
  version: 20,
  description: 'Source attribution for recipes saved from public submissions',
  up: [
    ...V20_RECIPE_SOURCE_ATTRIBUTION_ALTERS,
    ...V20_RECIPE_SOURCE_ATTRIBUTION_INDEXES,
  ],
  down: [
    // SQLite cannot drop added columns safely without rebuilding the table.
  ],
};

const RECIPES_MIGRATION_V21: Migration = {
  version: 21,
  description: 'Device-local submission like cache and cloud sync queue',
  up: [
    ...V21_BESTCHEF_SUBMISSION_LIKE_TABLES,
    ...V21_BESTCHEF_SUBMISSION_LIKE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_bestchef_submission_like_queue',
    'DROP TABLE IF EXISTS rc_bestchef_submission_likes',
  ],
};

const RECIPES_MIGRATION_V22: Migration = {
  version: 22,
  description: 'Pending submission cloud sync queue (B-005 retry path)',
  up: [
    ...V22_PENDING_SUBMISSIONS_TABLES,
    ...V22_PENDING_SUBMISSIONS_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_pending_submissions',
  ],
};

const RECIPES_MIGRATION_V23: Migration = {
  version: 23,
  description: 'Structured ingredient raw_line for round-trip parity (F-034)',
  up: [
    ...V23_INGREDIENT_RAW_LINE_ALTERS,
    ...V23_INGREDIENT_RAW_LINE_INDEXES,
  ],
  down: [
    // SQLite cannot drop added columns safely without rebuilding the table.
  ],
};

const RECIPES_MIGRATION_V24: Migration = {
  version: 24,
  description: 'BestChef comment helpful state cache (F-033 persisted helpful)',
  up: [
    ...V24_BESTCHEF_COMMENT_HELPFUL_TABLES,
    ...V24_BESTCHEF_COMMENT_HELPFUL_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_bestchef_comment_helpful',
  ],
};

const RECIPES_MIGRATION_V25: Migration = {
  version: 25,
  description: 'Saved recipe media gallery (F-014 saved recipe media editing)',
  up: [
    ...V25_SAVED_RECIPE_MEDIA_TABLES,
    ...V25_SAVED_RECIPE_MEDIA_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_saved_recipe_media',
  ],
};

const RECIPES_MIGRATION_V26: Migration = {
  version: 26,
  description: 'Grocery list media attachments (F-016 reference photos on lists)',
  up: [
    ...V26_GROCERY_LIST_MEDIA_ALTERS,
    ...V26_GROCERY_LIST_MEDIA_INDEXES,
  ],
  down: [
    // SQLite cannot drop added columns safely without rebuilding the table.
  ],
};

const RECIPES_MIGRATION_V27: Migration = {
  version: 27,
  description: 'Named custom theme profiles (F-029 save, F-030 share/import)',
  up: [
    ...V27_CUSTOM_THEMES_TABLES,
    ...V27_CUSTOM_THEMES_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_custom_themes',
  ],
};

const RECIPES_MIGRATION_V28: Migration = {
  version: 28,
  description: 'Pending moderation reports queue (B-003 trust-and-safety fallback)',
  up: [
    ...V28_PENDING_REPORTS_TABLES,
    ...V28_PENDING_REPORTS_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_pending_reports',
  ],
};

const RECIPES_MIGRATION_V29: Migration = {
  version: 29,
  description: 'Migration-managed local moderation reports and blocks',
  up: [
    ...V29_BESTCHEF_MODERATION_LOCAL_TABLES,
    ...V29_BESTCHEF_MODERATION_LOCAL_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_bestchef_blocks',
    'DROP TABLE IF EXISTS rc_bestchef_reports',
  ],
};

const RECIPES_MIGRATION_V30: Migration = {
  version: 30,
  description: 'Vote proof drafts: review payload + resumable media asset id',
  up: [
    ...V30_LOCAL_VOTE_PROOF_REVIEW_COLUMNS,
  ],
  down: [
    'ALTER TABLE rc_local_vote_proofs DROP COLUMN notes',
    'ALTER TABLE rc_local_vote_proofs DROP COLUMN rating',
    'ALTER TABLE rc_local_vote_proofs DROP COLUMN verdict',
    'ALTER TABLE rc_local_vote_proofs DROP COLUMN media_asset_id',
  ],
};

const RECIPES_MIGRATION_V31: Migration = {
  version: 31,
  description: 'Authoring-time UGC language on local submissions',
  up: [
    ...V31_LOCAL_SUBMISSION_LANGUAGE_COLUMNS,
  ],
  down: [
    'ALTER TABLE rc_bestchef_submissions DROP COLUMN language',
  ],
};

const RECIPES_MIGRATION_V32: Migration = {
  version: 32,
  description: 'Local mirror + pending-op queue for cloud bookmarks',
  up: [
    ...V32_SAVED_SUBMISSIONS_CACHE_TABLES,
    ...V32_SAVED_SUBMISSIONS_CACHE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_saved_submissions_cache',
  ],
};

const RECIPES_MIGRATION_V33: Migration = {
  version: 33,
  description: 'Submission media upload queue (compression, progress, retry, cancel)',
  up: [
    ...V33_MEDIA_UPLOAD_QUEUE_TABLES,
    ...V33_MEDIA_UPLOAD_QUEUE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS rc_media_upload_jobs',
  ],
};

const RECIPES_MIGRATION_V34: Migration = {
  version: 34,
  description: 'Media upload queue carries duration_ms/width/height for finalize (audit M2)',
  up: [
    ...V34_MEDIA_UPLOAD_QUEUE_DIMENSIONS,
  ],
  down: [
    // SQLite pre-3.35 cannot DROP COLUMN; a down migration recreates the
    // table without the dimension columns to stay reversible.
    'ALTER TABLE rc_media_upload_jobs RENAME TO rc_media_upload_jobs_v34_old',
    `CREATE TABLE rc_media_upload_jobs (
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
    )`,
    `INSERT INTO rc_media_upload_jobs (
      id, owner_id, media_kind, local_uri, compressed_uri, mime_type, byte_size,
      content_hash, status, progress, attempts, last_error, asset_id, public_url,
      created_at, updated_at
    ) SELECT
      id, owner_id, media_kind, local_uri, compressed_uri, mime_type, byte_size,
      content_hash, status, progress, attempts, last_error, asset_id, public_url,
      created_at, updated_at
    FROM rc_media_upload_jobs_v34_old`,
    'DROP TABLE rc_media_upload_jobs_v34_old',
    `CREATE INDEX IF NOT EXISTS rc_media_upload_jobs_owner_idx ON rc_media_upload_jobs(owner_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS rc_media_upload_jobs_status_idx ON rc_media_upload_jobs(status, updated_at)`,
  ],
};

export const RECIPES_MODULE: ModuleDefinition = {
  id: 'recipes',
  name: 'BestChef',
  tagline: 'Find the best recipe for every dish',
  icon: '\u{1F373}',
  accentColor: '#22C55E',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [
    RECIPES_MIGRATION_V1,
    RECIPES_MIGRATION_V2,
    RECIPES_MIGRATION_V3,
    RECIPES_MIGRATION_V4,
    RECIPES_MIGRATION_V5,
    RECIPES_MIGRATION_V6,
    RECIPES_MIGRATION_V7,
    RECIPES_MIGRATION_V8,
    RECIPES_MIGRATION_V9,
    RECIPES_MIGRATION_V10,
    RECIPES_MIGRATION_V11,
    RECIPES_MIGRATION_V12,
    RECIPES_MIGRATION_V13,
    RECIPES_MIGRATION_V14,
    RECIPES_MIGRATION_V15,
    RECIPES_MIGRATION_V16,
    RECIPES_MIGRATION_V17,
    RECIPES_MIGRATION_V18,
    RECIPES_MIGRATION_V19,
    RECIPES_MIGRATION_V20,
    RECIPES_MIGRATION_V21,
    RECIPES_MIGRATION_V22,
    RECIPES_MIGRATION_V23,
    RECIPES_MIGRATION_V24,
    RECIPES_MIGRATION_V25,
    RECIPES_MIGRATION_V26,
    RECIPES_MIGRATION_V27,
    RECIPES_MIGRATION_V28,
    RECIPES_MIGRATION_V29,
    RECIPES_MIGRATION_V30,
    RECIPES_MIGRATION_V31,
    RECIPES_MIGRATION_V32,
    RECIPES_MIGRATION_V33,
    RECIPES_MIGRATION_V34,
  ],
  schemaVersion: 34,
  tablePrefix: 'rc_',
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'recipes', label: 'Recipes', icon: 'book-open' },
      { key: 'meal-plan', label: 'Meal Planner', icon: 'calendar' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'recipe-detail', title: 'Recipe' },
      { name: 'add-recipe', title: 'Add Recipe' },
      { name: 'cooking-mode', title: 'Cooking Mode' },
      { name: 'import-url', title: 'Import from URL' },
      { name: 'scan-recipe', title: 'Scan Recipe' },
      { name: 'import-video', title: 'Import from Video' },
      { name: 'print-preview', title: 'Print Preview' },
    ],
  },
  requiresAuth: false,
  // BestChef's headline function is the cloud competitive layer: dish catalog,
  // recipe submissions, voting, leaderboards, chef profiles, comments, and the
  // video feed all require network (Supabase, server-backed per the launch
  // exception). The local kitchen subset (saved recipes, pantry, meal plan,
  // shopping lists, cooking mode) does work fully offline, but the module as a
  // product cannot deliver its core value without a connection, so this is true.
  requiresNetwork: true,
  version: '0.2.0',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: true,
    entityRules: [
      { tableName: 'recipes', defaultScope: 'personal_replica', conflictStrategy: 'document_crdt' },
      { tableName: 'recipe_tags', defaultScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'chef_follows', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'follower_update_seeds', defaultScope: 'published_blob', conflictStrategy: 'lww' },
      {
        tableName: 'bestchef_submissions',
        defaultScope: 'shared_workspace',
        maxScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
        stripColumns: ['photo_uri', 'videos_json'],
      },
      { tableName: 'bestchef_comments', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
      { tableName: 'bestchef_votes', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
      { tableName: 'bestchef_media_cache', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'bestchef_submission_likes', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'bestchef_submission_like_queue', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      // V28-V33 device-local tables. These are per-device queues, caches, and
      // moderation state that must never leave the device. Without an explicit
      // entity rule, the outbound ChangeTracker would inherit the module-level
      // defaultScope (personal_replica) and sync them (mesh fails OPEN outbound;
      // only inbound fails closed). Explicit device_local rules keep them off the
      // wire. Mesh is off for BestChef GA (server-backed launch exception), so
      // this is latent, but the root CLAUDE.md mesh policy requires explicit rules.
      { tableName: 'pending_reports', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'bestchef_reports', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'bestchef_blocks', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'saved_submissions_cache', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'media_upload_jobs', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'pantry_staples', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
      {
        tableName: 'local_vote_proofs',
        defaultScope: 'device_local',
        maxScope: 'device_local',
        conflictStrategy: 'lww',
        stripColumns: ['local_image_uri', 'content_hash', 'failure_reason'],
      },
      { tableName: 'shopping_lists', defaultScope: 'personal_replica', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
      { tableName: 'shopping_list_items', defaultScope: 'personal_replica', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
      { tableName: 'recipe_grocery_flags', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'recipe_cook_history', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'food_products', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'food_product_aliases', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'food_confirmations', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'nutrition_data', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'unit_conversion_corrections', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'pantry_items', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'pantry_batches', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      {
        tableName: 'receipt_imports',
        defaultScope: 'personal_replica',
        maxScope: 'personal_replica',
        conflictStrategy: 'lww',
        stripColumns: ['photo_uri', 'raw_ocr_text'],
      },
      {
        tableName: 'receipt_import_lines',
        defaultScope: 'personal_replica',
        maxScope: 'personal_replica',
        conflictStrategy: 'lww',
        stripColumns: ['candidate_json'],
      },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
