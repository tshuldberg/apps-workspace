/**
 * Cross-module interface implementation for MyHomes.
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

const MODULE_ID = 'homes';
const MAX_CARDS = 3;

const TASK_TYPE_LABELS: Record<string, string> = {
  hvac_filter: 'HVAC filter change',
  hvac_service: 'HVAC service',
  gutter_cleaning: 'Gutter cleaning',
  roof_inspection: 'Roof inspection',
  smoke_detector: 'Smoke detector check',
  water_heater_flush: 'Water heater flush',
  dryer_vent: 'Dryer vent cleaning',
  pest_control: 'Pest control',
  exterior_paint: 'Exterior paint',
  lawn_mower_service: 'Lawn mower service',
  window_cleaning: 'Window cleaning',
  plumbing_inspection: 'Plumbing inspection',
  appliance_service: 'Appliance service',
  chimney_sweep: 'Chimney sweep',
  custom: 'Maintenance task',
};

interface MaintenanceDueRow {
  id: string;
  task_type: string;
  task_type_custom: string | null;
  next_due_date: string;
  property_name: string;
}

interface ActiveProjectRow {
  id: string;
  name: string;
  status: string;
  budget_cents: number;
  actual_cost_cents: number;
}

interface MonthlyCostRow {
  total: number | null;
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

function monthBounds(now: Date): { current: { start: string; end: string }; previous: { start: string; end: string } } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  const currentStart = new Date(Date.UTC(year, month, 1));
  const currentEnd = new Date(Date.UTC(year, month + 1, 1));
  const prevStart = new Date(Date.UTC(year, month - 1, 1));
  const prevEnd = currentStart;

  return {
    current: { start: isoDate(currentStart), end: isoDate(currentEnd) },
    previous: { start: isoDate(prevStart), end: isoDate(prevEnd) },
  };
}

function taskLabel(taskType: string, custom: string | null): string {
  if (taskType === 'custom' && custom) return custom;
  return TASK_TYPE_LABELS[taskType] ?? 'Maintenance task';
}

function buildMaintenanceCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'hm_maintenance_schedules') || !tableExists(db, 'hm_properties')) {
    return null;
  }

  const today = isoDate(context.now);
  const rows = db.query<MaintenanceDueRow>(
    `SELECT s.id, s.task_type, s.task_type_custom, s.next_due_date,
            p.name AS property_name
     FROM hm_maintenance_schedules s
     JOIN hm_properties p ON s.property_id = p.id
     WHERE s.is_active = 1
       AND s.next_due_date IS NOT NULL
       AND s.next_due_date <= ?
     ORDER BY s.next_due_date ASC
     LIMIT 1`,
    [today],
  );
  const row = rows[0];
  if (!row) return null;

  const label = taskLabel(row.task_type, row.task_type_custom);

  return {
    id: `homes.maintenance.${row.id}`,
    moduleId: MODULE_ID,
    kind: 'reminder',
    priority: 70,
    title: `${label} due for ${row.property_name}`,
    subtitle: `Scheduled for ${row.next_due_date}`,
    cta: { label: 'View task', route: '/homes/schedule-detail' },
    dismissible: true,
  };
}

function buildOpenProjectCard(db: DatabaseAdapter): TodayCard | null {
  if (!tableExists(db, 'hm_projects')) return null;

  const rows = db.query<ActiveProjectRow>(
    `SELECT id, name, status, budget_cents, actual_cost_cents
     FROM hm_projects
     WHERE status = 'in_progress'
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
  const project = rows[0];
  if (!project) return null;

  let subtitle: string | undefined;
  if (project.budget_cents > 0) {
    const pct = Math.max(
      0,
      Math.min(100, Math.round((project.actual_cost_cents / project.budget_cents) * 100)),
    );
    subtitle = `${pct}% of budget spent`;
  } else if (project.actual_cost_cents > 0) {
    subtitle = `$${(project.actual_cost_cents / 100).toFixed(2)} spent`;
  } else {
    subtitle = 'In progress';
  }

  return {
    id: `homes.project.${project.id}`,
    moduleId: MODULE_ID,
    kind: 'progress',
    priority: 40,
    title: `${project.name}: ${subtitle}`,
    cta: { label: 'Open project', route: '/homes/project-detail' },
    dismissible: true,
  };
}

function buildCostInsightCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'hm_cost_entries')) return null;

  const { current, previous } = monthBounds(context.now);

  const currentRow = db.query<MonthlyCostRow>(
    `SELECT SUM(amount_cents) AS total
     FROM hm_cost_entries
     WHERE cost_date >= ? AND cost_date < ?`,
    [current.start, current.end],
  )[0];
  const previousRow = db.query<MonthlyCostRow>(
    `SELECT SUM(amount_cents) AS total
     FROM hm_cost_entries
     WHERE cost_date >= ? AND cost_date < ?`,
    [previous.start, previous.end],
  )[0];

  const currentTotal = currentRow?.total ?? 0;
  const previousTotal = previousRow?.total ?? 0;
  if (currentTotal === 0 || previousTotal === 0) return null;

  const ratio = currentTotal / previousTotal;
  if (ratio >= 0.75 && ratio <= 1.25) return null;

  const direction = ratio > 1 ? 'up' : 'down';
  const pctChange = Math.round(Math.abs(ratio - 1) * 100);
  const dollars = (currentTotal / 100).toFixed(2);

  return {
    id: 'homes.cost.month-trend',
    moduleId: MODULE_ID,
    kind: 'insight',
    priority: 35,
    title: `Home costs ${direction} ${pctChange}% this month`,
    subtitle: `$${dollars} so far vs prior month`,
    cta: { label: 'See costs', route: '/homes/cost-list' },
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const maintenance = buildMaintenanceCard(db, context);
  if (maintenance) cards.push(maintenance);

  const project = buildOpenProjectCard(db);
  if (project) cards.push(project);

  const cost = buildCostInsightCard(db, context);
  if (cost) cards.push(cost);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_CARDS);
}

export const crossModule: CrossModuleInterface = {
  getTodayCards: (db, context) =>
    getTodayCards(db as DatabaseAdapter, context),
};
