import type { Migration } from '@mylife/module-registry';
import { V4_INDEXES, V4_TABLES } from '../schema';

/**
 * V4 migration -- betting journal + bankroll.
 *
 * Additive only. Adds three normalized tables:
 *   * sp_bets           -- parent row (single + parlay)
 *   * sp_bet_legs       -- normalized parlay legs (cascade-deleted)
 *   * sp_bankroll       -- single-row-per-profile bookkeeping tracker
 *
 * Does NOT touch sp_teams, sp_games, sp_settings, or sp_notifications_log.
 * Down reverses in dependency order (child -> parent -> bankroll).
 */
export const SPORTS_MIGRATION_V4: Migration = {
  version: 4,
  description:
    'Sports V4 -- betting journal + bankroll (sp_bets, sp_bet_legs, sp_bankroll)',
  up: [...V4_TABLES, ...V4_INDEXES],
  down: [
    'DROP TABLE IF EXISTS sp_bet_legs',
    'DROP TABLE IF EXISTS sp_bets',
    'DROP TABLE IF EXISTS sp_bankroll',
  ],
};
