import type { Migration } from '@mylife/module-registry';
import { V5_INDEXES, V5_TABLES } from '../schema';

/**
 * V5 migration -- fantasy leagues + transactions journal.
 *
 * Additive only. Adds two normalized tables:
 *   * sp_fantasy_leagues       -- one row per league-season (platform label only)
 *   * sp_fantasy_transactions  -- draft / trade / waiver / fa journal
 *
 * Does NOT touch any V1-V4 table. No external OAuth in this phase --
 * users enter leagues manually; CSV import lands later.
 *
 * Down reverses in dependency order (child -> parent).
 */
export const SPORTS_MIGRATION_V5: Migration = {
  version: 5,
  description:
    'Sports V5 -- fantasy leagues + transactions (sp_fantasy_leagues, sp_fantasy_transactions)',
  up: [...V5_TABLES, ...V5_INDEXES],
  down: [
    'DROP TABLE IF EXISTS sp_fantasy_transactions',
    'DROP TABLE IF EXISTS sp_fantasy_leagues',
  ],
};
