import type { ModuleDefinition } from '@mylife/module-registry';
import { crossModule as trailsCrossModule } from './cross-module';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  V2_TABLES,
  V2_INDEXES,
  V3_TABLES,
  V3_INDEXES,
  V4_TABLES,
  V4_INDEXES,
  V5_TABLES,
  V5_INDEXES,
  V6_TABLES,
  V6_INDEXES,
  V7_TABLES,
  V7_INDEXES,
  V8_TABLES,
  V8_INDEXES,
  V9_TABLES,
  V9_INDEXES,
  V10_TABLES,
  V10_INDEXES,
  V11_TABLES,
  V11_INDEXES,
  V12_TABLES,
  V12_INDEXES,
  V13_TABLES,
  V13_INDEXES,
} from './db/schema';
import {
  ADD_HUB_PLACE_ID_V14,
  V14_INDEXES,
} from './db/schema-v14';

import type { Migration } from '@mylife/db';

export const TRAILS_MIGRATION_V14: Migration = {
  version: 14,
  description: 'Shadow-write pointer: add hub_place_id on tr_trails for hub_places adoption',
  up: [...ADD_HUB_PLACE_ID_V14, ...V14_INDEXES],
  down: [],
};

export const TRAILS_MODULE: ModuleDefinition = {
  id: 'trails',
  name: 'MyTrails',
  tagline: 'Offline hiking and trail guide',
  icon: '\uD83E\uDD7E',
  accentColor: '#65A30D',
  tier: 'premium',
  storageType: 'sqlite',
  schemaVersion: 14,
  tablePrefix: 'tr_',
  syncPolicy: {
    defaultScope: 'shared_workspace',
    shareable: true,
    entityRules: [
      {
        tableName: 'trails',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'recordings',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'waypoints',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'photos',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'reviews',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'planned_routes',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description: 'Create trails tables: trails, recordings, waypoints, photos',
      up: [...ALL_TABLES, ...CREATE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS tr_photos',
        'DROP TABLE IF EXISTS tr_waypoints',
        'DROP TABLE IF EXISTS tr_recordings',
        'DROP TABLE IF EXISTS tr_trails',
      ],
    },
    {
      version: 2,
      description: 'Add offline map regions table for tile download management',
      up: [...V2_TABLES, ...V2_INDEXES],
      down: ['DROP TABLE IF EXISTS tr_offline_regions'],
    },
    {
      version: 3,
      description: 'Add alert settings and deviation events tables for wrong-turn alerts',
      up: [...V3_TABLES, ...V3_INDEXES],
      down: [
        'DROP TABLE IF EXISTS tr_deviation_events',
        'DROP TABLE IF EXISTS tr_alert_settings',
      ],
    },
    {
      version: 4,
      description: 'Add weather cache table for weather overlay',
      up: [...V4_TABLES, ...V4_INDEXES],
      down: ['DROP TABLE IF EXISTS tr_weather_cache'],
    },
    {
      version: 5,
      description: 'Add segments and segment efforts tables for segment tracking',
      up: [...V5_TABLES, ...V5_INDEXES],
      down: [
        'DROP TABLE IF EXISTS tr_segment_efforts',
        'DROP TABLE IF EXISTS tr_segments',
      ],
    },
    {
      version: 6,
      description: 'Add packing templates and items tables for packing lists',
      up: [...V6_TABLES, ...V6_INDEXES],
      down: [
        'DROP TABLE IF EXISTS tr_packing_items',
        'DROP TABLE IF EXISTS tr_packing_templates',
      ],
    },
    {
      version: 7,
      description: 'Add trips, trip days, and trip activities tables for trip itinerary',
      up: [...V7_TABLES, ...V7_INDEXES],
      down: [
        'DROP TABLE IF EXISTS tr_trip_activities',
        'DROP TABLE IF EXISTS tr_trip_days',
        'DROP TABLE IF EXISTS tr_trips',
      ],
    },
    {
      version: 8,
      description: 'Add trail database table for trail database integration',
      up: [...V8_TABLES, ...V8_INDEXES],
      down: ['DROP TABLE IF EXISTS tr_trail_database'],
    },
    {
      version: 9,
      description: 'Add planned routes and route waypoints tables for route planning',
      up: [...V9_TABLES, ...V9_INDEXES],
      down: [
        'DROP TABLE IF EXISTS tr_route_waypoints',
        'DROP TABLE IF EXISTS tr_planned_routes',
      ],
    },
    {
      version: 10,
      description: 'Add reviews table for community reviews',
      up: [...V10_TABLES, ...V10_INDEXES],
      down: ['DROP TABLE IF EXISTS tr_reviews'],
    },
    {
      version: 11,
      description: 'Add optional review photo attachments',
      up: [...V11_TABLES, ...V11_INDEXES],
      down: [],
    },
    {
      version: 12,
      description: 'Add persistent MyTrails module settings',
      up: [...V12_TABLES, ...V12_INDEXES],
      down: ['DROP TABLE IF EXISTS tr_settings'],
    },
    {
      version: 13,
      description: 'Add recording notes, privacy, and quick rating metadata',
      up: [...V13_TABLES, ...V13_INDEXES],
      down: [],
    },
    TRAILS_MIGRATION_V14,
  ],
  navigation: {
    tabs: [
      { key: 'map', label: 'Map', icon: 'map' },
      { key: 'trails', label: 'Trails', icon: 'navigation' },
      { key: 'recordings', label: 'Recordings', icon: 'activity' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'trail-detail', title: 'Trail' },
      { name: 'recording', title: 'Recording' },
      { name: 'elevation-profile', title: 'Elevation' },
      { name: 'offline-regions', title: 'Offline Maps' },
      { name: 'alert-settings', title: 'Alert Settings' },
      { name: 'segment-detail', title: 'Segment' },
      { name: 'packing', title: 'Packing Lists' },
      { name: 'packing-checklist', title: 'Checklist' },
      { name: 'trips', title: 'Trips' },
      { name: 'trip-detail', title: 'Trip' },
      { name: 'discover', title: 'Discover Trails' },
      { name: 'route-builder', title: 'Route Builder' },
      { name: 'write-review', title: 'Write Review' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '1.0.0',
  crossModule: trailsCrossModule,
};
