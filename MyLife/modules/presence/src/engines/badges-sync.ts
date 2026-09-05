import type { DatabaseAdapter } from '@mylife/db';
import {
  getAllActiveIntentions,
  getDailyUsageRange,
  getEarnedBadges,
  getFocusSessions,
  getTotalXP,
  recordBadgeEarned,
} from '../db';
import {
  BADGE_DEFS,
  buildBadgeStatsSnapshotFromData,
  computeEarnedBadges,
  type BadgeDef,
  type BadgeStatsSnapshot,
} from './badges';

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function buildBadgeStatsSnapshot(db: DatabaseAdapter): BadgeStatsSnapshot {
  const totalXP = getTotalXP(db);
  const usageRecords = getDailyUsageRange(db, isoDateDaysAgo(365), new Date().toISOString().slice(0, 10), 500);
  const sessions = getFocusSessions(db, 1000);
  const activeIntentions = getAllActiveIntentions(db, 1000).length;
  const mindfulOpenCount = db.query<{ count: number }>(
    "SELECT COUNT(*) as count FROM pr_app_opens WHERE intention_text IS NOT NULL AND TRIM(intention_text) <> ''",
    [],
  )[0]?.count ?? 0;
  const hubVisits = db.query<{ value: string }>(
    "SELECT value FROM pr_settings WHERE key = 'hub_visit_count'",
    [],
  )[0]?.value;

  return buildBadgeStatsSnapshotFromData({
    dailyUsage: usageRecords,
    sessions,
    totalXP,
    activeIntentions,
    mindfulOpenCount,
    hubVisits: hubVisits == null ? 0 : parseInt(hubVisits, 10) || 0,
  });
}

export async function syncBadges(
  db: DatabaseAdapter,
  stats: BadgeStatsSnapshot = buildBadgeStatsSnapshot(db),
): Promise<{ newlyEarned: BadgeDef[] }> {
  const existing = new Set(getEarnedBadges(db).map((badge) => badge.badgeId));
  const earned = computeEarnedBadges(stats);
  const newlyEarned = earned.filter((badge) => !existing.has(badge.id));

  newlyEarned.forEach((badge) => {
    recordBadgeEarned(db, badge.id, badge.category);
  });

  return { newlyEarned };
}

export function getBadgeDefinitionById(id: string): BadgeDef | undefined {
  return BADGE_DEFS.find((badge) => badge.id === id);
}
