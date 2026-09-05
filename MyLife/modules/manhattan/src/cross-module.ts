/**
 * Cross-module interface implementation for Manhattan.
 *
 * Exposes saved events, pins, and plans for hub-level search, dashboard
 * summaries, and the unified Today view. All reads are pure and run through
 * an injected DatabaseAdapter over mh_events / mh_plans / mh_pins /
 * mh_event_facets.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';
import { getEvents } from './db/crud/events';
import { getPins } from './db/crud/pins';
import { getPlans, getPlansOnDay } from './db/crud/plans';
import { getFacets } from './db/crud/facets';
import { planStartMs } from './engines/reminders';

const MODULE_ID = 'manhattan';
const MAX_CARDS = 3;

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  const ms = planStartMs(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// getTodayCards
// ---------------------------------------------------------------------------

function buildPlanTodayCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  const today = isoDay(context.now);
  const plans = getPlansOnDay(db, today);
  const plan = plans[0];
  if (!plan) return null;

  const time = formatTime(plan.start_at);
  const reservation = plan.has_reservation ? 'Reservation' : undefined;
  const subtitleParts = [time, reservation].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );

  return {
    id: `manhattan.plan.today.${plan.id}`,
    moduleId: MODULE_ID,
    kind: plan.has_reservation ? 'reminder' : 'event',
    priority: 80,
    title: plan.title,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined,
    cta: { label: 'View plan', route: `/manhattan/plan/${plan.id}` },
    dismissible: true,
    expiresAt: plan.end_at ?? undefined,
  };
}

function buildTonightSavedCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  const today = isoDay(context.now);
  const events = getEvents(db);
  const tonight = events.filter(
    (e) => e.saved === 1 && e.start_at != null && e.start_at.slice(0, 10) === today,
  );
  if (tonight.length === 0) return null;

  const count = tonight.length;
  const endOfDay = `${today}T23:59:59.999Z`;

  return {
    id: `manhattan.tonight.saved.${today}`,
    moduleId: MODULE_ID,
    kind: 'insight',
    priority: 60,
    title: count === 1 ? '1 saved event tonight' : `${count} saved events tonight`,
    subtitle: 'Happening in the city today',
    cta: { label: 'Browse', route: '/manhattan/saved' },
    dismissible: true,
    expiresAt: endOfDay,
  };
}

function buildNextReminderCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  const nowMs = context.now.getTime();
  const plans = getPlans(db);
  const upcoming = plans
    .filter((p) => p.reminder_minutes != null && p.start_at != null)
    .filter((p) => {
      const t = planStartMs(p.start_at);
      return !Number.isNaN(t) && t > nowMs;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const plan = upcoming[0];
  if (!plan) return null;

  const time = formatTime(plan.start_at);
  const mins = plan.reminder_minutes ?? 0;

  return {
    id: `manhattan.plan.reminder.${plan.id}`,
    moduleId: MODULE_ID,
    kind: 'reminder',
    priority: 45,
    title: `Upcoming: ${plan.title}`,
    subtitle: time
      ? `${time} • reminder ${mins} min before`
      : `Reminder ${mins} min before`,
    cta: { label: 'View plan', route: `/manhattan/plan/${plan.id}` },
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const planToday = buildPlanTodayCard(db, context);
  if (planToday) cards.push(planToday);

  const tonight = buildTonightSavedCard(db, context);
  if (tonight) cards.push(tonight);

  const reminder = buildNextReminderCard(db, context);
  if (reminder) cards.push(reminder);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_CARDS);
}

// ---------------------------------------------------------------------------
// getSearchableContent
// ---------------------------------------------------------------------------

export function getSearchableContent(db: DatabaseAdapter): SearchableItem[] {
  const items: SearchableItem[] = [];

  const events = getEvents(db).filter((e) => e.saved === 1);
  for (const event of events) {
    const facets = getFacets(db, event.id);
    const tags = facets.map((f) => f.value).filter(Boolean);
    const bodyParts = [event.venue_name, event.neighborhood, event.description].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    items.push({
      moduleId: MODULE_ID,
      type: 'event',
      title: event.title,
      body: bodyParts.length > 0 ? bodyParts.join(' • ') : undefined,
      tags: tags.length > 0 ? tags : undefined,
      itemId: event.id,
      updatedAt: event.updated_at,
    });
  }

  const pins = getPins(db);
  for (const pin of pins) {
    const bodyParts = [pin.category, pin.neighborhood].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    items.push({
      moduleId: MODULE_ID,
      type: 'pin',
      title: pin.name,
      body: bodyParts.length > 0 ? bodyParts.join(' • ') : undefined,
      itemId: pin.id,
      updatedAt: pin.updated_at,
    });
  }

  const plans = getPlans(db);
  for (const plan of plans) {
    items.push({
      moduleId: MODULE_ID,
      type: 'plan',
      title: plan.title,
      body: plan.start_at,
      itemId: plan.id,
      updatedAt: plan.updated_at,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// getDataSummary
// ---------------------------------------------------------------------------

function maxUpdatedAt(rows: { updated_at: string }[]): string | undefined {
  let max: string | undefined;
  for (const row of rows) {
    if (row.updated_at && (max === undefined || row.updated_at > max)) {
      max = row.updated_at;
    }
  }
  return max;
}

export function getDataSummary(db: DatabaseAdapter): ModuleSummary {
  const events = getEvents(db);
  const pins = getPins(db);
  const plans = getPlans(db);

  const savedEvents = events.filter((e) => e.saved === 1).length;
  const nowIso = new Date().toISOString();
  const upcomingPlans = plans.filter(
    (p) => p.start_at != null && p.start_at >= nowIso,
  ).length;

  const lastActivity = [
    maxUpdatedAt(events),
    maxUpdatedAt(pins),
    maxUpdatedAt(plans),
  ]
    .filter((v): v is string => typeof v === 'string')
    .sort()
    .pop();

  return {
    moduleId: MODULE_ID,
    totalItems: events.length + pins.length + plans.length,
    stats: {
      savedEvents,
      pins: pins.length,
      plans: plans.length,
      upcomingPlans,
    },
    lastActivity,
  };
}

export const manhattanCrossModule: CrossModuleInterface = {
  getTodayCards: (db, ctx) => getTodayCards(db as DatabaseAdapter, ctx),
  getSearchableContent: (db) => getSearchableContent(db as DatabaseAdapter),
  getDataSummary: (db) => getDataSummary(db as DatabaseAdapter),
};
