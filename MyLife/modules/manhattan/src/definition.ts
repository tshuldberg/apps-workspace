import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS } from './db/schema';
import { manhattanCrossModule } from './cross-module';

const MANHATTAN_MIGRATION_V1: Migration = {
  version: 1,
  description:
    'Initial Manhattan schema - events, event_facets, pins, plans, plan_members, sources, source_cache, settings',
  up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS mh_source_cache',
    'DROP TABLE IF EXISTS mh_sources',
    'DROP TABLE IF EXISTS mh_plan_members',
    'DROP TABLE IF EXISTS mh_plans',
    'DROP TABLE IF EXISTS mh_pins',
    'DROP TABLE IF EXISTS mh_event_facets',
    'DROP TABLE IF EXISTS mh_events',
    'DROP TABLE IF EXISTS mh_settings',
  ],
};

const MANHATTAN_MIGRATION_V2: Migration = {
  version: 2,
  description:
    'Add partial unique index on (source_id, external_id) for external event upserts',
  up: [
    `CREATE UNIQUE INDEX IF NOT EXISTS mh_events_source_ext_idx ON mh_events(source_id, external_id) WHERE external_id IS NOT NULL`,
  ],
  down: ['DROP INDEX IF EXISTS mh_events_source_ext_idx'],
};

const MANHATTAN_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Phase 3: index plan calendar linkage',
  up: ['CREATE INDEX IF NOT EXISTS mh_plans_calendar_event_idx ON mh_plans(calendar_event_id)'],
  down: ['DROP INDEX IF EXISTS mh_plans_calendar_event_idx'],
};

export const MANHATTAN_MODULE: ModuleDefinition = {
  id: 'manhattan',
  name: 'Manhattan',
  tagline: 'Your city, planned',
  icon: '\u{1F5FD}',
  accentColor: '#E4572E',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [MANHATTAN_MIGRATION_V1, MANHATTAN_MIGRATION_V2, MANHATTAN_MIGRATION_V3],
  schemaVersion: 3,
  tablePrefix: 'mh_',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: true,
    isSensitive: true,
    entityRules: [
      { tableName: 'events', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'event_facets', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      {
        tableName: 'pins',
        defaultScope: 'personal_replica',
        maxScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      { tableName: 'plans', defaultScope: 'shared_workspace', conflictStrategy: 'lww' },
      { tableName: 'plan_members', defaultScope: 'shared_workspace', conflictStrategy: 'or_set' },
      { tableName: 'sources', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'source_cache', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
  navigation: {
    tabs: [
      { key: 'discover', label: 'Discover', icon: 'compass' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'pins', label: 'Pins', icon: 'map-pin' },
      { key: 'plans', label: 'Plans', icon: 'list' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'event-detail', title: 'Event' },
      { name: 'pin-detail', title: 'Pin' },
      { name: 'plan-detail', title: 'Plan' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  crossModule: manhattanCrossModule,
};
