/**
 * Cross-module interface implementation for MyRSVP.
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

const MODULE_ID = 'rsvp';
const MAX_CARDS = 3;

interface EventTodayRow {
  id: string;
  title: string;
  start_at: string;
  location_name: string | null;
}

interface PendingInviteRow {
  id: string;
  event_id: string;
  invitee_name: string;
  event_title: string;
  start_at: string;
}

interface OwedSplitRow {
  id: string;
  expense_id: string;
  participant_name: string;
  amount_cents: number;
  event_id: string;
  event_title: string;
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatAmount(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

function buildEventTodayCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'rv_events')) return null;

  const today = isoDate(context.now);
  const rows = db.query<EventTodayRow>(
    `SELECT id, title, start_at, location_name FROM rv_events
     WHERE DATE(start_at) = ?
     ORDER BY start_at ASC
     LIMIT 1`,
    [today],
  );
  const event = rows[0];
  if (!event) return null;

  const time = formatTime(event.start_at);
  const subtitleParts = [time, event.location_name].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );

  return {
    id: `rsvp.event.today.${event.id}`,
    moduleId: MODULE_ID,
    kind: 'event',
    priority: 80,
    title: event.title,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(' \u2022 ') : undefined,
    cta: { label: 'View event', route: `/rsvp/events/${event.id}` },
    dismissible: true,
  };
}

function buildPendingRsvpCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'rv_invites') || !tableExists(db, 'rv_events')) {
    return null;
  }

  const now = context.now;
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const cutoffIso = threeDaysOut.toISOString();

  const rows = db.query<PendingInviteRow>(
    `SELECT i.id, i.event_id, i.invitee_name, e.title as event_title, e.start_at
     FROM rv_invites i
     JOIN rv_events e ON i.event_id = e.id
     WHERE i.status = 'invited'
       AND e.start_at >= ?
       AND e.start_at <= ?
     ORDER BY e.start_at ASC
     LIMIT 1`,
    [nowIso, cutoffIso],
  );
  const invite = rows[0];
  if (!invite) return null;

  return {
    id: `rsvp.invite.pending.${invite.id}`,
    moduleId: MODULE_ID,
    kind: 'action',
    priority: 60,
    title: `Respond to "${invite.event_title}"`,
    subtitle: `Invitation awaiting your reply`,
    cta: { label: 'Respond', route: `/rsvp/invites/${invite.id}` },
    dismissible: true,
  };
}

function buildExpenseOwedCard(db: DatabaseAdapter): TodayCard | null {
  if (
    !tableExists(db, 'rv_expense_splits') ||
    !tableExists(db, 'rv_expenses') ||
    !tableExists(db, 'rv_events')
  ) {
    return null;
  }

  const rows = db.query<OwedSplitRow>(
    `SELECT s.id, s.expense_id, s.participant_name, s.amount_cents,
            x.event_id, e.title as event_title
     FROM rv_expense_splits s
     JOIN rv_expenses x ON s.expense_id = x.id
     JOIN rv_events e ON x.event_id = e.id
     WHERE s.is_settled = 0
     ORDER BY s.created_at ASC
     LIMIT 1`,
  );
  const split = rows[0];
  if (!split) return null;

  return {
    id: `rsvp.expense.owed.${split.id}`,
    moduleId: MODULE_ID,
    kind: 'action',
    priority: 55,
    title: `Settle ${formatAmount(split.amount_cents)}`,
    subtitle: `${split.participant_name} \u2022 ${split.event_title}`,
    cta: { label: 'Settle', route: `/rsvp/events/${split.event_id}/expenses` },
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const eventCard = buildEventTodayCard(db, context);
  if (eventCard) cards.push(eventCard);

  const pendingCard = buildPendingRsvpCard(db, context);
  if (pendingCard) cards.push(pendingCard);

  const owedCard = buildExpenseOwedCard(db);
  if (owedCard) cards.push(owedCard);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_CARDS);
}

export const crossModule: CrossModuleInterface = {
  getTodayCards: (db, context) =>
    getTodayCards(db as DatabaseAdapter, context),
};
