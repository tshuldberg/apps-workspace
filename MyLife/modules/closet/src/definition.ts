import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  BASE_INDEXES,
  BASE_SETTINGS,
  BASE_TABLES,
  EXPANDED_INDEXES,
  EXPANDED_SETTINGS,
  EXPANDED_TABLES,
  V3_TABLES,
  V3_INDEXES,
  V3_SETTINGS,
} from './db/schema';

const CLOSET_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Create closet items, outfits, wear logs, tags, and settings',
  up: [...BASE_TABLES, ...BASE_INDEXES, ...BASE_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS cl_settings',
    'DROP TABLE IF EXISTS cl_item_tags',
    'DROP TABLE IF EXISTS cl_tags',
    'DROP TABLE IF EXISTS cl_wear_log_items',
    'DROP TABLE IF EXISTS cl_wear_logs',
    'DROP TABLE IF EXISTS cl_outfit_items',
    'DROP TABLE IF EXISTS cl_outfits',
    'DROP TABLE IF EXISTS cl_items',
  ],
};

const CLOSET_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add laundry tracking, packing lists, and expanded closet settings',
  up: [...EXPANDED_TABLES, ...EXPANDED_INDEXES, ...EXPANDED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS cl_packing_list_items',
    'DROP TABLE IF EXISTS cl_packing_lists',
    'DROP TABLE IF EXISTS cl_laundry_events',
  ],
};

const CLOSET_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add wishlist, capsule wardrobes, outfit suggestion feedback, weather cache, and seasonal settings',
  up: [...V3_TABLES, ...V3_INDEXES, ...V3_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS cl_weather_cache',
    'DROP TABLE IF EXISTS cl_suggestion_feedback',
    'DROP TABLE IF EXISTS cl_capsule_items',
    'DROP TABLE IF EXISTS cl_capsules',
    'DROP TABLE IF EXISTS cl_wishlist_items',
  ],
};

export const CLOSET_MODULE: ModuleDefinition = {
  id: 'closet',
  name: 'MyCloset',
  tagline: 'Your wardrobe, fully private',
  icon: '👗',
  accentColor: '#E879A8',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [CLOSET_MIGRATION_V1, CLOSET_MIGRATION_V2, CLOSET_MIGRATION_V3],
  schemaVersion: 3,
  tablePrefix: 'cl_',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'items',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'outfits',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'wear_logs',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'capsules',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'wardrobe', label: 'Wardrobe', icon: 'shirt' },
      { key: 'outfits', label: 'Outfits', icon: 'layers' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'item-detail', title: 'Item' },
      { name: 'outfit-detail', title: 'Outfit' },
      { name: 'add-item', title: 'Add Item' },
      { name: 'packing-list', title: 'Packing List' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
