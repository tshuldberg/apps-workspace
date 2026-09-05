/**
 * Cross-module interface implementation for MyJournal.
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

const MODULE_ID = 'journal';

const MAX_CARDS = 3;
const MIN_STREAK_FOR_CARD = 3;

interface CountRow {
  count: number;
}

interface DateRow {
  dt: string;
}

interface OnThisDayRow {
  id: string;
  body: string;
  title: string | null;
  entry_date: string;
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

function buildTodaysEntryCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'jn_entries')) return null;

  // Only nudge users who have written before. An empty journal should
  // surface no Today cards (onboarding owns that flow).
  const totalRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM jn_entries`,
  );
  const total = totalRows[0]?.count ?? 0;
  if (total === 0) return null;

  const today = isoDate(context.now);
  const rows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM jn_entries WHERE DATE(created_at) = ?`,
    [today],
  );
  const todayCount = rows[0]?.count ?? 0;
  if (todayCount > 0) return null;

  return {
    id: 'journal.todays-entry',
    moduleId: MODULE_ID,
    kind: 'action',
    priority: 50,
    title: 'Reflect on your day',
    subtitle: 'Capture a quick journal entry',
    cta: { label: 'Reflect', route: '/journal/new' },
    dismissible: true,
  };
}

function buildOnThisDayCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'jn_entries')) return null;

  const monthDay = isoDate(context.now).slice(5); // "MM-DD"
  const todayIso = isoDate(context.now);

  // Match same MM-DD on entry_date but exclude entries from today's exact date.
  const rows = db.query<OnThisDayRow>(
    `SELECT id, body, title, entry_date
     FROM jn_entries
     WHERE substr(entry_date, 6, 5) = ?
       AND entry_date <> ?
     ORDER BY entry_date DESC
     LIMIT 1`,
    [monthDay, todayIso],
  );
  const entry = rows[0];
  if (!entry) return null;

  // Compute year delta (positive => years ago).
  const todayYear = context.now.getUTCFullYear();
  const entryYear = Number(entry.entry_date.slice(0, 4));
  if (!Number.isFinite(entryYear) || entryYear >= todayYear) return null;
  const yearsAgo = todayYear - entryYear;

  const snippetSource = entry.title ?? entry.body ?? '';
  const snippet =
    snippetSource.length > 80 ? `${snippetSource.slice(0, 77)}...` : snippetSource;

  const yearWord = yearsAgo === 1 ? 'year' : 'years';

  return {
    id: 'journal.on-this-day',
    moduleId: MODULE_ID,
    kind: 'insight',
    priority: 40,
    title: `${yearsAgo} ${yearWord} ago`,
    subtitle: snippet || 'You wrote on this day',
    cta: { label: 'Open entry', route: '/journal/entry-detail' },
    dismissible: true,
  };
}

function buildStreakCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'jn_entries')) return null;

  const dateRows = db.query<DateRow>(
    `SELECT DISTINCT DATE(created_at) as dt
     FROM jn_entries
     ORDER BY dt DESC
     LIMIT 365`,
  );
  if (dateRows.length === 0) return null;

  const today = isoDate(context.now);
  const yesterday = isoDate(new Date(context.now.getTime() - 86400000));

  const newest = dateRows[0].dt;
  if (newest !== today && newest !== yesterday) return null;

  let streak = 1;
  for (let i = 1; i < dateRows.length; i++) {
    const prev = new Date(`${dateRows[i - 1].dt}T00:00:00.000Z`).getTime();
    const curr = new Date(`${dateRows[i].dt}T00:00:00.000Z`).getTime();
    const diffDays = Math.round((prev - curr) / 86400000);
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  if (streak < MIN_STREAK_FOR_CARD) return null;

  // Streak at risk if newest is yesterday (still need to log today).
  const atRisk = newest === yesterday;
  const priority = atRisk ? 60 : 35;

  return {
    id: 'journal.streak',
    moduleId: MODULE_ID,
    kind: 'progress',
    priority,
    title: `${streak} day journal streak`,
    subtitle: atRisk ? 'Write today to keep it alive' : 'Keep going',
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const today = buildTodaysEntryCard(db, context);
  if (today) cards.push(today);

  const onThisDay = buildOnThisDayCard(db, context);
  if (onThisDay) cards.push(onThisDay);

  const streak = buildStreakCard(db, context);
  if (streak) cards.push(streak);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_CARDS);
}

export const crossModule: CrossModuleInterface = {
  getTodayCards: (db, context) =>
    getTodayCards(db as DatabaseAdapter, context),
};
