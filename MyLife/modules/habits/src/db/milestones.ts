import type { DatabaseAdapter } from '@mylife/db';
import type { Milestone, MilestoneType } from '../types';

export interface MilestoneProgressSummary {
  total: number;
  achievedCount: number;
  pendingCount: number;
  recentAchievements: Milestone[];
  byType: Record<MilestoneType, { total: number; achieved: number }>;
}

// ── Row mapper ──────────────────────────────────────────────────────────

function rowToMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    milestoneType: row.milestone_type as MilestoneType,
    threshold: row.threshold as number,
    label: row.label as string,
    emoji: (row.emoji as string) ?? null,
    achievedAt: (row.achieved_at as string) ?? null,
    dismissed: !!(row.dismissed as number),
    createdAt: row.created_at as string,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────

export function createMilestone(
  db: DatabaseAdapter,
  id: string,
  habitId: string,
  milestoneType: MilestoneType,
  threshold: number,
  label: string,
  emoji: string | null,
): void {
  db.execute(
    `INSERT OR IGNORE INTO hb_milestones (id, habit_id, milestone_type, threshold, label, emoji)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, habitId, milestoneType, threshold, label, emoji],
  );
}

export function getMilestonesForHabit(db: DatabaseAdapter, habitId: string): Milestone[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_milestones WHERE habit_id = ? ORDER BY milestone_type, threshold ASC',
    [habitId],
  ).map(rowToMilestone);
}

export function getMilestones(db: DatabaseAdapter): Milestone[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM hb_milestones
     ORDER BY CASE WHEN achieved_at IS NULL THEN 1 ELSE 0 END ASC, achieved_at DESC, milestone_type ASC, threshold ASC`,
  ).map(rowToMilestone);
}

export function getAchievedMilestones(db: DatabaseAdapter, habitId?: string): Milestone[] {
  if (habitId) {
    return db.query<Record<string, unknown>>(
      'SELECT * FROM hb_milestones WHERE habit_id = ? AND achieved_at IS NOT NULL ORDER BY achieved_at DESC',
      [habitId],
    ).map(rowToMilestone);
  }
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_milestones WHERE achieved_at IS NOT NULL ORDER BY achieved_at DESC',
  ).map(rowToMilestone);
}

export function getUnachievedMilestones(db: DatabaseAdapter, habitId: string): Milestone[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_milestones WHERE habit_id = ? AND achieved_at IS NULL ORDER BY milestone_type, threshold ASC',
    [habitId],
  ).map(rowToMilestone);
}

export function markMilestoneAchieved(db: DatabaseAdapter, id: string, achievedAt?: string): void {
  db.execute(
    'UPDATE hb_milestones SET achieved_at = ? WHERE id = ?',
    [achievedAt ?? new Date().toISOString(), id],
  );
}

export function dismissMilestone(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE hb_milestones SET dismissed = 1 WHERE id = ?', [id]);
}

export function getMilestoneProgress(db: DatabaseAdapter): MilestoneProgressSummary {
  const milestones = getMilestones(db);
  const achieved = milestones.filter((milestone) => milestone.achievedAt != null);

  const byType = milestones.reduce<MilestoneProgressSummary['byType']>((acc, milestone) => {
    const bucket = acc[milestone.milestoneType] ?? { total: 0, achieved: 0 };
    bucket.total += 1;
    if (milestone.achievedAt != null) {
      bucket.achieved += 1;
    }
    acc[milestone.milestoneType] = bucket;
    return acc;
  }, {
    streak: { total: 0, achieved: 0 },
    total_completions: { total: 0, achieved: 0 },
    sobriety_days: { total: 0, achieved: 0 },
    sobriety_money: { total: 0, achieved: 0 },
    custom: { total: 0, achieved: 0 },
  });

  return {
    total: milestones.length,
    achievedCount: achieved.length,
    pendingCount: Math.max(0, milestones.length - achieved.length),
    recentAchievements: achieved.slice(0, 8),
    byType,
  };
}

export function seedMilestonesForHabit(
  db: DatabaseAdapter,
  habitId: string,
  milestones: Array<{ id: string; type: MilestoneType; threshold: number; label: string; emoji: string }>,
): void {
  for (const m of milestones) {
    createMilestone(db, m.id, habitId, m.type, m.threshold, m.label, m.emoji);
  }
}
