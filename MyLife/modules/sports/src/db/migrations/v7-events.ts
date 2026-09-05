import type { Migration } from '@mylife/module-registry';
import { V7_INDEXES, V7_TABLES } from '../schema';

/**
 * V7 migration -- events + experiences surface.
 *
 * Additive only. Adds three independent tables for the P6 events surface:
 *   * sp_attendance   -- "I attended this game" journal
 *   * sp_venues       -- stadium registry + bucket list
 *   * sp_memorabilia  -- collection tracker (cards, jerseys, signed items, etc.)
 *
 * No FKs between these tables and V1-V6. V1-V6 replay intact on a
 * pre-V7 database. Down drops all three tables (order does not matter --
 * they are independent).
 *
 * Photos are deferred to the later photo pipeline. `photo_ids_json`
 * columns on sp_attendance and sp_memorabilia reserve the shape so the
 * future pipeline can populate them without another migration.
 */
export const SPORTS_MIGRATION_V7: Migration = {
  version: 7,
  description:
    'Sports V7 -- events + venues + memorabilia (sp_attendance, sp_venues, sp_memorabilia)',
  up: [...V7_TABLES, ...V7_INDEXES],
  down: [
    'DROP TABLE IF EXISTS sp_attendance',
    'DROP TABLE IF EXISTS sp_venues',
    'DROP TABLE IF EXISTS sp_memorabilia',
  ],
};
