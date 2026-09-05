/**
 * Cross-module interface implementation for MyHealth.
 *
 * Currently implements only `getTodayCards` for the hub's unified Today view
 * (Phase 2 anchor). The remaining `CrossModuleInterface` methods (search,
 * summary, activity feed, correlation) will land in the broader Phase 2 rollout.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';

const MODULE_ID = 'health';

const MAX_CARDS = 3;
const DEFAULT_SLEEP_TARGET_MINUTES = 480; // 8 hours

interface VitalsCountRow {
  count: number;
}

interface VitalsLastRow {
  last_recorded: string | null;
}

interface SleepRow {
  duration_minutes: number;
  end_time: string;
}

interface SettingsRow {
  value: string;
}

interface ReadinessRow {
  date: string;
  score: number;
  recommendation: string;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function tableExists(db: DatabaseAdapter, name: string): boolean {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    [name],
  );
  return rows.length > 0;
}

function getSleepTargetMinutes(db: DatabaseAdapter): number {
  if (!tableExists(db, 'hl_settings')) return DEFAULT_SLEEP_TARGET_MINUTES;
  const rows = db.query<SettingsRow>(
    `SELECT value FROM hl_settings WHERE key = 'sleep.targetHours'`,
  );
  const raw = rows[0]?.value;
  if (!raw) return DEFAULT_SLEEP_TARGET_MINUTES;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_SLEEP_TARGET_MINUTES;
  return Math.round(hours * 60);
}

function buildNextVitalCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'hl_vitals')) return null;

  const totalRows = db.query<VitalsCountRow>(
    `SELECT COUNT(*) as count FROM hl_vitals`,
  );
  const total = totalRows[0]?.count ?? 0;
  if (total === 0) return null;

  const today = isoDate(context.now);
  const todayCountRows = db.query<VitalsCountRow>(
    `SELECT COUNT(*) as count FROM hl_vitals WHERE DATE(recorded_at) = ?`,
    [today],
  );
  const loggedToday = todayCountRows[0]?.count ?? 0;
  if (loggedToday > 0) return null;

  const lastRows = db.query<VitalsLastRow>(
    `SELECT MAX(recorded_at) as last_recorded FROM hl_vitals`,
  );
  const lastRecorded = lastRows[0]?.last_recorded;
  if (!lastRecorded) return null;

  const isMorning = context.now.getHours() < 12;
  const priority = isMorning ? 60 : 40;

  return {
    id: 'health.vital.next-due',
    moduleId: MODULE_ID,
    kind: 'reminder',
    priority,
    title: 'Log a vital today',
    subtitle: 'Keep your vitals streak going',
    cta: { label: 'Log vital', route: '/health/measurement-log' },
    dismissible: true,
  };
}

function buildSleepDebtCard(db: DatabaseAdapter): TodayCard | null {
  if (!tableExists(db, 'hl_sleep_sessions')) return null;

  const rows = db.query<SleepRow>(
    `SELECT duration_minutes, end_time FROM hl_sleep_sessions
     ORDER BY end_time DESC
     LIMIT 1`,
  );
  const last = rows[0];
  if (!last) return null;

  const targetMinutes = getSleepTargetMinutes(db);
  const debt = targetMinutes - last.duration_minutes;
  if (debt <= 0) return null;

  return {
    id: 'health.sleep.debt',
    moduleId: MODULE_ID,
    kind: 'insight',
    priority: 45,
    title: `Sleep debt ${debt} min`,
    subtitle: `Last night fell short of your ${Math.round(targetMinutes / 60)}h target`,
    cta: { label: 'Sleep details', route: '/health/sleep-detail' },
    dismissible: true,
  };
}

function buildReadinessCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'hl_readiness_scores')) return null;

  const today = isoDate(context.now);
  const rows = db.query<ReadinessRow>(
    `SELECT date, score, recommendation FROM hl_readiness_scores WHERE date = ?`,
    [today],
  );
  const entry = rows[0];
  if (!entry) return null;

  const score = Math.max(0, Math.min(100, Math.round(entry.score)));

  return {
    id: 'health.readiness.today',
    moduleId: MODULE_ID,
    kind: 'progress',
    priority: 55,
    title: `Readiness ${score}/100`,
    subtitle: entry.recommendation,
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const vital = buildNextVitalCard(db, context);
  if (vital) cards.push(vital);

  const sleep = buildSleepDebtCard(db);
  if (sleep) cards.push(sleep);

  const readiness = buildReadinessCard(db, context);
  if (readiness) cards.push(readiness);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_CARDS);
}

export const crossModule: CrossModuleInterface = {
  getTodayCards: (db, context) =>
    getTodayCards(db as DatabaseAdapter, context),
};
