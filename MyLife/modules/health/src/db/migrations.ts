import type { Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, V2_ALL_TABLES, V2_INDEXES, V2_SEEDS, V3_ALL_TABLES, V3_INDEXES } from './schema';

/**
 * MyHealth migration v1 -- additive only.
 *
 * Creates 8 new hl_-prefixed tables + indexes + default settings.
 * Does NOT touch existing md_*, ft_*, or cy_* tables from absorbed modules.
 * Those tables are read/written directly by MyHealth business logic.
 */
export const HEALTH_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial health schema -- documents, vitals, sleep, sync log, goals, emergency info, settings',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS hl_goal_progress',
    'DROP TABLE IF EXISTS hl_goals',
    'DROP TABLE IF EXISTS hl_sleep_sessions',
    'DROP TABLE IF EXISTS hl_sync_log',
    'DROP TABLE IF EXISTS hl_vitals',
    'DROP TABLE IF EXISTS hl_documents',
    'DROP TABLE IF EXISTS hl_emergency_info',
    'DROP TABLE IF EXISTS hl_settings',
  ],
};

/**
 * MyHealth migration v2 -- 14 A-tier features.
 *
 * Adds 9 new tables: breathing sessions, readiness scores, activity summaries,
 * CBT entries, meditation sessions, body measurements, SOS sessions,
 * sleep routines, and import log.
 */
export const HEALTH_MIGRATION_V2: Migration = {
  version: 2,
  description: 'A-tier features -- breathing, readiness, activity, CBT, meditation, body, SOS, sleep aids, aggregation',
  up: [
    ...V2_ALL_TABLES,
    ...V2_INDEXES,
    ...V2_SEEDS,
  ],
  down: [
    'DROP TABLE IF EXISTS hl_import_log',
    'DROP TABLE IF EXISTS hl_sleep_routines',
    'DROP TABLE IF EXISTS hl_sos_sessions',
    'DROP TABLE IF EXISTS hl_body_measurements',
    'DROP TABLE IF EXISTS hl_meditation_sessions',
    'DROP TABLE IF EXISTS hl_cbt_entries',
    'DROP TABLE IF EXISTS hl_activity_summaries',
    'DROP TABLE IF EXISTS hl_readiness_scores',
    'DROP TABLE IF EXISTS hl_breathing_sessions',
  ],
};

/**
 * MyHealth migration v3 -- 3 B+C features.
 *
 * Adds 4 new tables: smart alarms, alarm history, snore sessions, snore events.
 */
export const HEALTH_MIGRATION_V3: Migration = {
  version: 3,
  description: 'B+C features -- smart alarm, snore detection',
  up: [
    ...V3_ALL_TABLES,
    ...V3_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hl_snore_events',
    'DROP TABLE IF EXISTS hl_snore_sessions',
    'DROP TABLE IF EXISTS hl_alarm_history',
    'DROP TABLE IF EXISTS hl_smart_alarms',
  ],
};
