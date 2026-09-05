import type { Migration } from '@mylife/module-registry';
import {
  CREATE_FTS_TRIGGERS,
  CREATE_PHOTO_LOG,
  CREATE_WATER_LOG,
  CREATE_ENERGY_LOG,
  CREATE_DAILY_NOTES,
  CREATE_RESTAURANTS,
  CREATE_MENU_ITEMS,
  CREATE_RESTAURANTS_FTS,
  CREATE_MENU_ITEMS_FTS,
  CREATE_RESTAURANT_FTS_TRIGGERS,
  CREATE_MENU_ITEMS_FTS_TRIGGERS,
  CREATE_V4_INDEXES,
  SEED_V4_SETTINGS,
  CREATE_COMMUNITY_PROFILES,
  CREATE_COMMUNITY_CONNECTIONS,
  CREATE_COMMUNITY_FEED,
  CREATE_COMMUNITY_CHALLENGES,
  CREATE_COMMUNITY_CHALLENGE_MEMBERS,
  CREATE_V5_INDEXES,
  CREATE_FAVORITES,
  CREATE_MEAL_TEMPLATES,
  CREATE_MEAL_TEMPLATE_ITEMS,
  CREATE_V6_INDEXES,
  ALTER_FOOD_LOG_ITEMS_ADD_LOGGED_AT,
  ALTER_DAILY_NOTES_ADD_MEAL_TYPES,
  ALTER_DAILY_NOTES_ADD_LINKED_FOOD_IDS,
  ALTER_RESTAURANTS_ADD_LOGO_URI,
} from './schema';
import { getNutrientInserts } from '../data/usda-nutrients';
import { getUSDAFoodInserts, getUSDAFTSInserts } from '../data/usda-seed';
import { getRestaurantSeedInserts } from '../restaurant/seed';

/**
 * Migration V2: Seed USDA nutrients + common foods, add FTS triggers.
 */
export const NUTRITION_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Seed 84 nutrient definitions, ~100 USDA foods, add FTS sync triggers',
  up: [
    ...CREATE_FTS_TRIGGERS,
    ...getNutrientInserts(),
    ...getUSDAFoodInserts(),
    ...getUSDAFTSInserts(),
  ],
  down: [
    'DROP TRIGGER IF EXISTS nu_foods_ai',
    'DROP TRIGGER IF EXISTS nu_foods_ad',
    'DROP TRIGGER IF EXISTS nu_foods_au',
    'DELETE FROM nu_food_nutrients WHERE food_id LIKE \'usda-%\'',
    'DELETE FROM nu_foods WHERE source = \'usda\'',
    'DELETE FROM nu_nutrients',
  ],
};

/**
 * Migration V3: Add photo log table for AI food identification.
 */
export const NUTRITION_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add nu_photo_log table for AI-powered food identification from photos',
  up: [CREATE_PHOTO_LOG],
  down: ['DROP TABLE IF EXISTS nu_photo_log'],
};

/**
 * Migration V4: Water tracking, energy balance, daily notes, restaurant menus.
 *
 * Adds 6 tables (nu_water_log, nu_energy_log, nu_daily_notes, nu_restaurants,
 * nu_menu_items) + 2 FTS tables + triggers + seed data for 20 chain restaurants
 * with ~100 menu items.
 */
export const NUTRITION_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Add water tracking, energy balance, daily notes, and restaurant menus with seed data',
  up: [
    // Core tables
    CREATE_WATER_LOG,
    CREATE_ENERGY_LOG,
    CREATE_DAILY_NOTES,
    CREATE_RESTAURANTS,
    CREATE_MENU_ITEMS,
    // FTS tables
    CREATE_RESTAURANTS_FTS,
    CREATE_MENU_ITEMS_FTS,
    // FTS sync triggers
    ...CREATE_RESTAURANT_FTS_TRIGGERS,
    ...CREATE_MENU_ITEMS_FTS_TRIGGERS,
    // Indexes
    ...CREATE_V4_INDEXES,
    // Seed settings
    ...SEED_V4_SETTINGS,
    // Seed restaurant data
    ...getRestaurantSeedInserts(),
  ],
  down: [
    'DROP TRIGGER IF EXISTS nu_menu_items_au',
    'DROP TRIGGER IF EXISTS nu_menu_items_ad',
    'DROP TRIGGER IF EXISTS nu_menu_items_ai',
    'DROP TRIGGER IF EXISTS nu_restaurants_au',
    'DROP TRIGGER IF EXISTS nu_restaurants_ad',
    'DROP TRIGGER IF EXISTS nu_restaurants_ai',
    'DROP TABLE IF EXISTS nu_menu_items_fts',
    'DROP TABLE IF EXISTS nu_restaurants_fts',
    'DROP TABLE IF EXISTS nu_menu_items',
    'DROP TABLE IF EXISTS nu_restaurants',
    'DROP TABLE IF EXISTS nu_daily_notes',
    'DROP TABLE IF EXISTS nu_energy_log',
    'DROP TABLE IF EXISTS nu_water_log',
    "DELETE FROM nu_settings WHERE key IN ('waterGoalMl', 'waterContainersMl', 'waterUnit', 'syncEnabled', 'syncDirection')",
  ],
};

/**
 * Migration V5: Community/social features.
 */
export const NUTRITION_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Add community profiles, connections, feed, challenges, and challenge members',
  up: [
    CREATE_COMMUNITY_PROFILES,
    CREATE_COMMUNITY_CONNECTIONS,
    CREATE_COMMUNITY_FEED,
    CREATE_COMMUNITY_CHALLENGES,
    CREATE_COMMUNITY_CHALLENGE_MEMBERS,
    ...CREATE_V5_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS nu_community_challenge_members',
    'DROP TABLE IF EXISTS nu_community_challenges',
    'DROP TABLE IF EXISTS nu_community_feed',
    'DROP TABLE IF EXISTS nu_community_connections',
    'DROP TABLE IF EXISTS nu_community_profiles',
  ],
};

/**
 * Migration V6: Favorites, meal templates, and related indexes.
 */
export const NUTRITION_MIGRATION_V6: Migration = {
  version: 6,
  description: 'Add favorites, meal templates, and meal template items',
  up: [
    CREATE_FAVORITES,
    CREATE_MEAL_TEMPLATES,
    CREATE_MEAL_TEMPLATE_ITEMS,
    ...CREATE_V6_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS nu_meal_template_items',
    'DROP TABLE IF EXISTS nu_meal_templates',
    'DROP TABLE IF EXISTS nu_favorites',
  ],
};

export const NUTRITION_MIGRATION_V7: Migration = {
  version: 7,
  description: 'Add logged_at timestamp to food log items',
  up: [ALTER_FOOD_LOG_ITEMS_ADD_LOGGED_AT],
  down: [],
};

export const NUTRITION_MIGRATION_V8: Migration = {
  version: 8,
  description: 'Add Phase 3 note metadata fields and restaurant artwork support',
  up: [
    ALTER_DAILY_NOTES_ADD_MEAL_TYPES,
    ALTER_DAILY_NOTES_ADD_LINKED_FOOD_IDS,
    ALTER_RESTAURANTS_ADD_LOGO_URI,
  ],
  down: [],
};
