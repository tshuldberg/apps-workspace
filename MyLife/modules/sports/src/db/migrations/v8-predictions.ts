import type { Migration } from '@mylife/module-registry';
import { V8_INDEXES, V8_TABLES } from '../schema';

/**
 * V8 migration -- predictions journal.
 *
 * Additive only. Adds a single table, `sp_predictions`, for the user's
 * private prediction + award-pick log (champion, MVP, ROTY, division
 * winners, over/under, custom picks). Accuracy is computed by a pure
 * engine (`computePredictionAccuracy`) from already-fetched rows.
 *
 * No brackets table -- the JSON tree UI is deferred to a future
 * P7-B2 card. V1-V7 replay intact on a pre-V8 database; a V7 database
 * upgrades in place with no data loss.
 */
export const SPORTS_MIGRATION_V8: Migration = {
  version: 8,
  description:
    'Sports V8 -- predictions journal (sp_predictions)',
  up: [...V8_TABLES, ...V8_INDEXES],
  down: ['DROP TABLE IF EXISTS sp_predictions'],
};
