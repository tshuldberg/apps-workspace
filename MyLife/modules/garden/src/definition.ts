import type { ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES } from './db/schema';
import { ALTER_ZONES, V2_TABLES, V2_INDEXES, V2_DOWN, MIGRATE_HARVESTS } from './db/schema-v2';

const GARDEN_MIGRATION_V1 = {
  version: 1,
  description: 'Create garden tables: plants, entries, zones, seeds, settings',
  up: [...ALL_TABLES, ...CREATE_INDEXES],
  down: [
    'DROP TABLE IF EXISTS gd_settings',
    'DROP TABLE IF EXISTS gd_seeds',
    'DROP TABLE IF EXISTS gd_zones',
    'DROP TABLE IF EXISTS gd_entries',
    'DROP TABLE IF EXISTS gd_plants',
  ],
};

const GARDEN_MIGRATION_V2 = {
  version: 2,
  description: 'Add 11 B+C features: identification, zones v2, seasonal tasks, harvests, diagnoses, wishlist, propagations, light readings, layouts, frost config',
  up: [
    // Drop any pre-existing tables with incompatible schemas from older V1 migrations
    ...V2_DOWN,
    ...ALTER_ZONES,
    ...V2_TABLES,
    ...V2_INDEXES,
    MIGRATE_HARVESTS,
  ],
  down: V2_DOWN,
};

export const GARDEN_MODULE: ModuleDefinition = {
  id: 'garden',
  name: 'MyGarden',
  tagline: 'Plant care and garden planner',
  icon: '🌱',
  accentColor: '#84CC16',
  tier: 'premium',
  storageType: 'sqlite',
  schemaVersion: 2,
  tablePrefix: 'gd_',
  migrations: [GARDEN_MIGRATION_V1, GARDEN_MIGRATION_V2],
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'plants',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'entries',
        defaultScope: 'personal_replica',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'zones',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'seeds',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'garden', label: 'Garden', icon: 'flower-2' },
      { key: 'tasks', label: 'Tasks', icon: 'check-circle' },
      { key: 'journal', label: 'Journal', icon: 'book-open' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'plant-detail', title: 'Plant' },
      { name: 'add-plant', title: 'Add Plant' },
      { name: 'journal-entry', title: 'Journal Entry' },
      { name: 'identify', title: 'Identify Plant' },
      { name: 'diagnose', title: 'Diagnose Problem' },
      { name: 'companions', title: 'Companion Guide' },
      { name: 'wishlist', title: 'Wish List' },
      { name: 'propagations', title: 'Propagations' },
      { name: 'light-meter', title: 'Light Levels' },
      { name: 'layout', title: 'Layout Planner' },
      { name: 'frost', title: 'Weather & Frost' },
      { name: 'seasonal', title: 'Calendar' },
      { name: 'harvests', title: 'Harvests' },
      { name: 'photos', title: 'Garden Photos' },
      { name: 'export', title: 'Export Data' },
      { name: 'zone-detail', title: 'Zone' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.2.0',
};
