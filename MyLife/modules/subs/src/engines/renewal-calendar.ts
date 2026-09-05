import type { DatabaseAdapter } from '@mylife/db';
import type { CalendarDay, CalendarMonth, RenewalItem } from '../types';
import { listSubscriptions, listCategories, normalizeToAnnualCents } from '../db/crud';

export function getCalendarMonth(db: DatabaseAdapter, year: number, month: number): CalendarMonth {
  const categories = listCategories(db);
  const catColorMap = new Map(categories.map(c => [c.id, c.color ?? '#10B981']));

  // Query renewal events for this month
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const endDate = getLastDayOfMonth(year, month);

  const rows = db.query<Record<string, unknown>>(
    `SELECT re.*, s.name as sub_name, s.billing_cycle, s.category_id, s.status as sub_status
     FROM sb_renewal_events re
     JOIN sb_subscriptions s ON s.id = re.subscription_id
     WHERE re.renewal_date >= ? AND re.renewal_date <= ?
     AND s.status != 'cancelled' AND s.status != 'expired'
     ORDER BY re.renewal_date ASC`,
    [startDate, endDate],
  );

  const dayMap = new Map<string, RenewalItem[]>();
  let totalCents = 0;

  for (const row of rows) {
    const date = row.renewal_date as string;
    const status = (row.status as string) as RenewalItem['status'];
    const isPaused = (row.sub_status as string) === 'paused';

    const item: RenewalItem = {
      subscriptionId: row.subscription_id as string,
      subscriptionName: row.sub_name as string,
      amountCents: row.amount_cents as number,
      billingCycle: row.billing_cycle as RenewalItem['billingCycle'],
      categoryColor: catColorMap.get(row.category_id as string) ?? '#10B981',
      status,
    };

    const existing = dayMap.get(date) ?? [];
    existing.push(item);
    dayMap.set(date, existing);

    // Paused subs not counted in totals
    if (!isPaused && status !== 'skipped') {
      totalCents += item.amountCents;
    }
  }

  const days: CalendarDay[] = [];
  for (const [date, renewals] of dayMap) {
    days.push({
      date,
      renewals,
      totalCents: renewals.reduce((sum, r) => sum + r.amountCents, 0),
    });
  }

  return {
    year,
    month,
    days,
    totalCents,
    renewalCount: rows.length,
  };
}

export function getAgendaView(db: DatabaseAdapter, daysAhead: number): CalendarDay[] {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(today + 'T00:00:00Z');
  future.setUTCDate(future.getUTCDate() + daysAhead);
  const futureDate = future.toISOString().slice(0, 10);

  const categories = listCategories(db);
  const catColorMap = new Map(categories.map(c => [c.id, c.color ?? '#10B981']));

  const rows = db.query<Record<string, unknown>>(
    `SELECT re.*, s.name as sub_name, s.billing_cycle, s.category_id
     FROM sb_renewal_events re
     JOIN sb_subscriptions s ON s.id = re.subscription_id
     WHERE re.renewal_date >= ? AND re.renewal_date <= ?
     AND re.status = 'upcoming'
     AND s.status IN ('active', 'trial')
     ORDER BY re.renewal_date ASC`,
    [today, futureDate],
  );

  const dayMap = new Map<string, RenewalItem[]>();

  for (const row of rows) {
    const date = row.renewal_date as string;
    const item: RenewalItem = {
      subscriptionId: row.subscription_id as string,
      subscriptionName: row.sub_name as string,
      amountCents: row.amount_cents as number,
      billingCycle: row.billing_cycle as RenewalItem['billingCycle'],
      categoryColor: catColorMap.get(row.category_id as string) ?? '#10B981',
      status: 'upcoming',
    };
    const existing = dayMap.get(date) ?? [];
    existing.push(item);
    dayMap.set(date, existing);
  }

  const days: CalendarDay[] = [];
  for (const [date, renewals] of dayMap) {
    days.push({
      date,
      renewals,
      totalCents: renewals.reduce((sum, r) => sum + r.amountCents, 0),
    });
  }

  return days;
}

export function getRenewalSummary(db: DatabaseAdapter): { thisMonth: number; nextMonth: number; thisYear: number } {
  const now = new Date();
  const thisMonth = getCalendarMonth(db, now.getFullYear(), now.getMonth() + 1);
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = getCalendarMonth(db, nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1);

  // Estimate this year from active subs
  const active = listSubscriptions(db, { status: 'active', sortBy: 'name', sortOrder: 'asc' });
  let yearTotal = 0;
  for (const sub of active) {
    yearTotal += normalizeToAnnualCents(sub.costCents, sub.billingCycle);
  }

  return {
    thisMonth: thisMonth.totalCents,
    nextMonth: nextMonth.totalCents,
    thisYear: yearTotal,
  };
}

export function getDueNotifications(db: DatabaseAdapter): { subscriptionId: string; subscriptionName: string; renewalDate: string; daysBefore: number }[] {
  const today = new Date().toISOString().slice(0, 10);

  const rows = db.query<Record<string, unknown>>(
    `SELECT s.id, s.name, s.notification_days_before, re.renewal_date
     FROM sb_subscriptions s
     JOIN sb_renewal_events re ON re.subscription_id = s.id
     WHERE s.notification_enabled = 1
     AND s.status IN ('active', 'trial')
     AND re.status = 'upcoming'
     AND re.notified_at IS NULL
     AND date(re.renewal_date, '-' || s.notification_days_before || ' days') <= ?
     AND re.renewal_date >= ?
     ORDER BY re.renewal_date ASC`,
    [today, today],
  );

  return rows.map(row => ({
    subscriptionId: row.id as string,
    subscriptionName: row.name as string,
    renewalDate: row.renewal_date as string,
    daysBefore: row.notification_days_before as number,
  }));
}

function getLastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}
