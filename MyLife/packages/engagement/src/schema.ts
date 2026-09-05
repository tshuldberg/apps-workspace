/**
 * Engagement system SQLite schema.
 *
 * Uses the hub_ prefix since engagement is a hub-level feature,
 * not a standalone module.
 */

export const CREATE_HUB_ENGAGEMENT_STREAKS = `
CREATE TABLE IF NOT EXISTS hub_engagement_streaks (
  date TEXT PRIMARY KEY NOT NULL,
  modules_active INTEGER NOT NULL DEFAULT 0 CHECK (modules_active >= 0),
  module_ids TEXT NOT NULL DEFAULT '[]',
  streak_count INTEGER NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_ENGAGEMENT_STREAKS_INDEX = `
CREATE INDEX IF NOT EXISTS hub_engagement_streaks_streak_idx
  ON hub_engagement_streaks (streak_count DESC, date DESC);`;

export const ENGAGEMENT_TABLES = [
  CREATE_HUB_ENGAGEMENT_STREAKS,
  CREATE_HUB_ENGAGEMENT_STREAKS_INDEX,
] as const;

/**
 * Initialize engagement tables. Safe to call multiple times.
 */
export function ensureEngagementTables(db: { execute(sql: string): void }): void {
  for (const ddl of ENGAGEMENT_TABLES) {
    db.execute(ddl);
  }
}
