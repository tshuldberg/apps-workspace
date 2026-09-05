import type { Migration } from '@mylife/module-registry';
import { V2_INDEXES, V2_TABLES } from '../schema';

/**
 * V2 migration -- live-scores cache.
 *
 * Additive only. Adds `sp_games` + supporting indexes. Does NOT touch
 * sp_teams or sp_settings. Attendance columns are deferred to P6.
 */
export const SPORTS_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Sports V2 -- live scores cache (sp_games)',
  up: [...V2_TABLES, ...V2_INDEXES],
  down: ['DROP TABLE IF EXISTS sp_games'],
};
