import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  SEED_PROTOCOLS,
  SEED_SETTINGS,
  SEED_NOTIFICATIONS_CONFIG,
  MIGRATION_V3_UP,
  MIGRATION_V4_TABLES,
  MIGRATION_V4_INDEXES,
  SEED_BEVERAGE_TYPES,
  SEED_CONTAINER_PRESETS,
  SEED_CAFFEINE_SETTINGS,
} from './db/schema';

const FAST_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial fast schema',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_PROTOCOLS,
    ...SEED_SETTINGS,
    ...SEED_NOTIFICATIONS_CONFIG,
  ],
  down: [
    'DROP TABLE IF EXISTS ft_notifications_config',
    'DROP TABLE IF EXISTS ft_goal_progress',
    'DROP TABLE IF EXISTS ft_goals',
    'DROP TABLE IF EXISTS ft_water_intake',
    'DROP TABLE IF EXISTS ft_active_fast',
    'DROP TABLE IF EXISTS ft_streak_cache',
    'DROP TABLE IF EXISTS ft_settings',
    'DROP TABLE IF EXISTS ft_protocols',
    'DROP TABLE IF EXISTS ft_weight_entries',
    'DROP TABLE IF EXISTS ft_fasts',
  ],
};

const FAST_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Feature set 1 additions - water, goals, notifications defaults',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
    ...SEED_NOTIFICATIONS_CONFIG,
  ],
  down: [
    'DELETE FROM ft_notifications_config',
  ],
};

const FAST_MIGRATION_V3: Migration = {
  version: 3,
  description: 'HealthKit sync source column + water reminder + watch settings seeds',
  up: [
    ...MIGRATION_V3_UP,
    ...SEED_SETTINGS,
  ],
  down: [
    // SQLite does not support DROP COLUMN, so this is a no-op for the column.
    // Settings are INSERT OR IGNORE, so re-running is safe.
  ],
};

const FAST_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Multi-beverage types, caffeine tracking, container presets',
  up: [
    ...MIGRATION_V4_TABLES,
    ...MIGRATION_V4_INDEXES,
    ...SEED_BEVERAGE_TYPES,
    ...SEED_CONTAINER_PRESETS,
    ...SEED_CAFFEINE_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS ft_container_presets',
    'DROP TABLE IF EXISTS ft_beverage_log',
    'DROP TABLE IF EXISTS ft_beverage_types',
    `DELETE FROM ft_settings WHERE key IN ('caffeineTrackingEnabled', 'caffeineCutoffTime', 'caffeineDailyLimitMg')`,
  ],
};

export const FAST_MODULE: ModuleDefinition = {
  id: 'fast',
  name: 'MyFast',
  tagline: 'Fasting & hydration, completely private',
  icon: '\u23F1\uFE0F',
  accentColor: '#14B8A6',
  tier: 'free',
  storageType: 'sqlite',
  migrations: [FAST_MIGRATION_V1, FAST_MIGRATION_V2, FAST_MIGRATION_V3, FAST_MIGRATION_V4],
  schemaVersion: 4,
  tablePrefix: 'ft_',
  navigation: {
    tabs: [
      { key: 'timer', label: 'Timer', icon: 'clock' },
      { key: 'hydration', label: 'Hydration', icon: 'droplet' },
      { key: 'history', label: 'History', icon: 'list' },
      { key: 'stats', label: 'Stats', icon: 'bar-chart' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '1.0.0',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      { tableName: 'fasts', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'active_fast', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'weight_entries', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'protocols', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'streak_cache', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'water_intake', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'goals', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'goal_progress', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'beverage_types', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'beverage_log', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'container_presets', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'notifications_config', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
