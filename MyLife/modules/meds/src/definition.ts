import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { medsCrossModule } from './cross-module';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  SEED_SETTINGS,
  V3_TABLES,
  V3_INDEXES,
  V4_TABLES,
  V4_INDEXES,
  V5_TABLES,
  V5_INDEXES,
  V6_TABLES,
  V6_INDEXES,
} from './db/schema';
import { MEDS_MIGRATION_V2 } from './db/migrations';
import { SEED_FODMAP_FOODS } from './fodmap/seed';

const MEDS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial meds schema -- medications, doses, settings + indexes + seeds',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS md_doses',
    'DROP TABLE IF EXISTS md_settings',
    'DROP TABLE IF EXISTS md_medications',
  ],
};

const MEDS_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Blood pressure, blood glucose, and insulin tracking tables + indexes',
  up: [
    ...V3_TABLES,
    ...V3_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS md_injection_sites',
    'DROP TABLE IF EXISTS md_insulin_entries',
    'DROP TABLE IF EXISTS md_glucose_readings',
    'DROP TABLE IF EXISTS md_bp_readings',
  ],
};

const MEDS_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Caregiver alerts, A1c records, FODMAP tracking, weather correlation, pain map, CGM integration',
  up: [
    ...V4_TABLES,
    ...V4_INDEXES,
    ...SEED_FODMAP_FOODS,
  ],
  down: [
    'DROP TABLE IF EXISTS md_cgm_sync_state',
    'DROP TABLE IF EXISTS md_cgm_readings',
    'DROP TABLE IF EXISTS md_pain_entries',
    'DROP TABLE IF EXISTS md_weather_symptom_links',
    'DROP TABLE IF EXISTS md_weather_snapshots',
    'DROP TABLE IF EXISTS md_stool_logs',
    'DROP TABLE IF EXISTS md_food_diary',
    'DROP TABLE IF EXISTS md_fodmap_foods',
    'DROP TABLE IF EXISTS md_a1c_records',
    'DROP TABLE IF EXISTS md_caregiver_alerts',
    'DROP TABLE IF EXISTS md_caregiver_alert_config',
    'DROP TABLE IF EXISTS md_caregivers',
  ],
};

const MEDS_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Healthcare contacts and appointments tables + indexes',
  up: [
    ...V5_TABLES,
    ...V5_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS md_appointments',
    'DROP TABLE IF EXISTS md_contacts',
  ],
};

const MEDS_MIGRATION_V6: Migration = {
  version: 6,
  description: 'Medication diary entries with linked dose logs and journaling insights',
  up: [
    ...V6_TABLES,
    ...V6_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS md_diary_entries',
  ],
};

export const MEDS_MODULE: ModuleDefinition = {
  id: 'meds',
  name: 'MyMeds',
  tagline: 'Your private health command center',
  icon: '\u{1F48A}',
  accentColor: '#06B6D4',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [
    MEDS_MIGRATION_V1,
    MEDS_MIGRATION_V2,
    MEDS_MIGRATION_V3,
    MEDS_MIGRATION_V4,
    MEDS_MIGRATION_V5,
    MEDS_MIGRATION_V6,
  ],
  schemaVersion: 6,
  tablePrefix: 'md_',
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'clock' },
      { key: 'medications', label: 'Medications', icon: 'pill' },
      { key: 'vitals', label: 'Vitals', icon: 'activity' },
      { key: 'insights', label: 'Insights', icon: 'trending-up' },
      { key: 'more', label: 'More', icon: 'more-horizontal' },
    ],
    screens: [
      { name: 'med-detail', title: 'Medication' },
      { name: 'add-med', title: 'Add Medication' },
      { name: 'schedule', title: 'Schedule' },
      { name: 'mood-check-in', title: 'Mood Check-In' },
      { name: 'measurement-log', title: 'Log Measurement' },
      { name: 'correlation', title: 'Correlations' },
      { name: 'export', title: 'Export Data' },
      { name: 'interactions', title: 'Interactions' },
      { name: 'refills', title: 'Refills' },
      { name: 'diary', title: 'Medication Diary' },
      { name: 'log-bp', title: 'Log Blood Pressure' },
      { name: 'bp-history', title: 'BP History' },
      { name: 'log-glucose', title: 'Log Glucose' },
      { name: 'glucose-history', title: 'Glucose History' },
      { name: 'log-insulin', title: 'Log Insulin' },
      { name: 'insulin-history', title: 'Insulin History' },
      { name: 'caregivers', title: 'Caregiver Alerts' },
      { name: 'bp-trends', title: 'BP Trends' },
      { name: 'a1c', title: 'A1c Dashboard' },
      { name: 'fodmap', title: 'FODMAP Tracker' },
      { name: 'weather', title: 'Weather Correlation' },
      { name: 'pain-map', title: 'Pain Map' },
      { name: 'cgm', title: 'CGM Dashboard' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.6.0',
  crossModule: medsCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      {
        tableName: 'medications',
        defaultScope: 'personal_replica',
        conflictStrategy: 'manual_review',
        requiresManualResolver: true,
        resolverComponent: 'MedsConflictResolver',
      },
      {
        tableName: 'schedules',
        defaultScope: 'personal_replica',
        conflictStrategy: 'manual_review',
        requiresManualResolver: true,
        resolverComponent: 'MedsScheduleConflictResolver',
      },
      {
        tableName: 'history',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'settings',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
    ],
  },
};
