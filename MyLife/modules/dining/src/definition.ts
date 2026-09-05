import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { diningCrossModule } from './cross-module';
import { ALL_TABLES, CREATE_INDEXES, V2_TABLES, V2_INDEXES, V3_TABLES, V3_INDEXES, V4_TABLES, V4_INDEXES, V5_TABLES, V5_INDEXES, V6_TABLES, V6_INDEXES } from './db/schema';

const DINING_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial dining schema -- settings table',
  up: [...ALL_TABLES, ...CREATE_INDEXES],
  down: ['DROP TABLE IF EXISTS dn_settings'],
};

const DINING_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Restaurants, tags, and restaurant-tag join tables',
  up: [...V2_TABLES, ...V2_INDEXES],
  down: [
    'DROP TABLE IF EXISTS dn_restaurant_tags',
    'DROP TABLE IF EXISTS dn_tags',
    'DROP TABLE IF EXISTS dn_restaurants',
  ],
};

const DINING_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Visits, photos, and companions tables',
  up: [...V3_TABLES, ...V3_INDEXES],
  down: [
    'DROP TABLE IF EXISTS dn_companions',
    'DROP TABLE IF EXISTS dn_photos',
    'DROP TABLE IF EXISTS dn_visits',
  ],
};

const DINING_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Watchlist table for reservation tracking',
  up: [...V4_TABLES, ...V4_INDEXES],
  down: ['DROP TABLE IF EXISTS dn_watchlist'],
};

const DINING_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Dishes and wines tables',
  up: [...V5_TABLES, ...V5_INDEXES],
  down: [
    'DROP TABLE IF EXISTS dn_wines',
    'DROP TABLE IF EXISTS dn_dishes',
  ],
};

const DINING_MIGRATION_V6: Migration = {
  version: 6,
  description: 'Reservations and imports tables',
  up: [...V6_TABLES, ...V6_INDEXES],
  down: [
    'DROP TABLE IF EXISTS dn_imports',
    'DROP TABLE IF EXISTS dn_reservations',
  ],
};

export const DINING_MODULE: ModuleDefinition = {
  id: 'dining',
  name: 'MyDining',
  tagline: 'Remember every meal',
  icon: '\u{1F37D}\u{FE0F}',
  accentColor: '#DC2626',
  tier: 'premium',
  storageType: 'sqlite',
  schemaVersion: 6,
  tablePrefix: 'dn_',
  migrations: [DINING_MIGRATION_V1, DINING_MIGRATION_V2, DINING_MIGRATION_V3, DINING_MIGRATION_V4, DINING_MIGRATION_V5, DINING_MIGRATION_V6],
  crossModule: diningCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'visits',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'restaurants',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'restaurant_tags',
        defaultScope: 'personal_replica',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'dishes',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'wines',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'utensils-crossed' },
      { key: 'restaurants', label: 'Restaurants', icon: 'map-pin' },
      { key: 'lists', label: 'Lists', icon: 'list' },
      { key: 'stats', label: 'Stats', icon: 'bar-chart' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'restaurant-detail', title: 'Restaurant' },
      { name: 'add-restaurant', title: 'Add Restaurant' },
      { name: 'visit-detail', title: 'Visit' },
      { name: 'add-visit', title: 'Log Visit' },
      { name: 'dish-detail', title: 'Dish' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
