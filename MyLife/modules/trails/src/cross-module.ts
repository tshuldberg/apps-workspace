/**
 * Cross-module interface implementation for MyTrails.
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

const MODULE_ID = 'trails';
const MAX_CARDS = 3;

interface RecentCompletedRow {
  id: string;
  name: string;
  distance_meters: number;
  elevation_gain_meters: number;
  ended_at: string;
}

interface InProgressRow {
  id: string;
  name: string;
  started_at: string;
}

function tableExists(db: DatabaseAdapter, name: string): boolean {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    [name],
  );
  return rows.length > 0;
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 mi';
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
}

function formatElevation(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 ft';
  const feet = Math.round(meters * 3.28084);
  return `${feet} ft`;
}

function buildLastHikeCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'tr_recordings')) return null;

  const cutoff = new Date(context.now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const rows = db.query<RecentCompletedRow>(
    `SELECT id, name, distance_meters, elevation_gain_meters, ended_at
     FROM tr_recordings
     WHERE ended_at IS NOT NULL AND ended_at >= ?
     ORDER BY ended_at DESC
     LIMIT 1`,
    [cutoff],
  );
  const recent = rows[0];
  if (!recent) return null;

  const subtitle = `${formatDistance(recent.distance_meters)} \u2022 ${formatElevation(recent.elevation_gain_meters)}`;

  return {
    id: `trails.last-hike.${recent.id}`,
    moduleId: MODULE_ID,
    kind: 'progress',
    priority: 40,
    title: recent.name || 'Last hike',
    subtitle,
    cta: { label: 'View hike', route: `/trails/recording?id=${recent.id}` },
    dismissible: true,
  };
}

function buildInProgressCard(db: DatabaseAdapter): TodayCard | null {
  if (!tableExists(db, 'tr_recordings')) return null;

  const rows = db.query<InProgressRow>(
    `SELECT id, name, started_at
     FROM tr_recordings
     WHERE started_at IS NOT NULL AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
  );
  const active = rows[0];
  if (!active) return null;

  return {
    id: `trails.recording.in-progress.${active.id}`,
    moduleId: MODULE_ID,
    kind: 'action',
    priority: 90,
    title: 'Recording in progress',
    subtitle: active.name ? `${active.name}` : 'Pick up where you left off',
    cta: { label: 'Resume recording', route: '/trails/record' },
    dismissible: false,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const inProgress = buildInProgressCard(db);
  if (inProgress) cards.push(inProgress);

  const lastHike = buildLastHikeCard(db, context);
  if (lastHike) cards.push(lastHike);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_CARDS);
}

export const crossModule: CrossModuleInterface = {
  getTodayCards: (db, context) =>
    getTodayCards(db as DatabaseAdapter, context),
};
