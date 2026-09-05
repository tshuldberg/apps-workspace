import type { Migration } from '@mylife/module-registry';
import { V3_INDEXES, V3_TABLES } from '../schema';

/**
 * V3 migration -- local notification dedupe log.
 *
 * Additive only. Adds `sp_notifications_log` + its unique dedupe index.
 * Does NOT touch sp_teams or sp_games. Game-start scheduling and
 * foreground live dispatch both write here via INSERT OR IGNORE so
 * duplicates get swallowed by the composite unique index.
 */
export const SPORTS_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Sports V3 -- local notifications dedupe log (sp_notifications_log)',
  up: [...V3_TABLES, ...V3_INDEXES],
  down: ['DROP TABLE IF EXISTS sp_notifications_log'],
};
