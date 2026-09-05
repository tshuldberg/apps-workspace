import type { Migration } from '@mylife/module-registry';
import { V6_INDEXES, V6_TABLES } from '../schema';

/**
 * V6 migration -- personal sports participation + rec leagues.
 *
 * Additive only. Adds two independent tables for the P5 Play surface:
 *   * sp_participation_sessions -- session journal (game/practice/pickup/training)
 *   * sp_rec_leagues            -- amateur/rec leagues the user plays in
 *
 * No FKs between these tables and V1-V5. V1-V5 replay intact on a
 * pre-V6 database. Down drops both tables (order does not matter --
 * they are independent).
 */
export const SPORTS_MIGRATION_V6: Migration = {
  version: 6,
  description:
    'Sports V6 -- personal participation + rec leagues (sp_participation_sessions, sp_rec_leagues)',
  up: [...V6_TABLES, ...V6_INDEXES],
  down: [
    'DROP TABLE IF EXISTS sp_participation_sessions',
    'DROP TABLE IF EXISTS sp_rec_leagues',
  ],
};
