import type { DatabaseAdapter } from '@mylife/db';
import type {
  Subscription,
  Category,
  PriceHistory,
  RenewalEvent,
  CancellationAction,
  PriceAlternative,
  CatalogEntry,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreateCategoryInput,
  CreatePriceAlternativeInput,
  CreateCancellationActionInput,
  SubscriptionFilter,
  BillingCycle,
} from '../types';
import { CreateSubscriptionInputSchema, SubscriptionFilterSchema, CreateCategoryInputSchema, CreateCancellationActionInputSchema, CreatePriceAlternativeInputSchema } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

function rowToSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    name: row.name as string,
    costCents: row.cost_cents as number,
    billingCycle: row.billing_cycle as BillingCycle,
    categoryId: (row.category_id as string) ?? null,
    nextRenewalDate: (row.next_renewal_date as string) ?? null,
    startDate: row.start_date as string,
    endDate: (row.end_date as string) ?? null,
    trialEndDate: (row.trial_end_date as string) ?? null,
    iconUri: (row.icon_uri as string) ?? null,
    url: (row.url as string) ?? null,
    notes: (row.notes as string) ?? null,
    status: row.status as Subscription['status'],
    notificationEnabled: (row.notification_enabled as number) === 1,
    notificationDaysBefore: row.notification_days_before as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) ?? null,
    color: (row.color as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function rowToPriceHistory(row: Record<string, unknown>): PriceHistory {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    oldCostCents: row.old_cost_cents as number,
    newCostCents: row.new_cost_cents as number,
    changedOn: row.changed_on as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToRenewalEvent(row: Record<string, unknown>): RenewalEvent {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    renewalDate: row.renewal_date as string,
    amountCents: row.amount_cents as number,
    status: row.status as RenewalEvent['status'],
    notifiedAt: (row.notified_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToCancellationAction(row: Record<string, unknown>): CancellationAction {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    action: row.action as CancellationAction['action'],
    savingsCents: (row.savings_cents as number) ?? null,
    notes: (row.notes as string) ?? null,
    actedOn: row.acted_on as string,
    createdAt: row.created_at as string,
  };
}

function rowToPriceAlternative(row: Record<string, unknown>): PriceAlternative {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    alternativeName: row.alternative_name as string,
    alternativeCostCents: row.alternative_cost_cents as number,
    alternativeBillingCycle: row.alternative_billing_cycle as BillingCycle,
    alternativeUrl: (row.alternative_url as string) ?? null,
    notes: (row.notes as string) ?? null,
    isFreeTier: (row.is_free_tier as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCatalogEntry(row: Record<string, unknown>): CatalogEntry {
  return {
    id: row.id as string,
    name: row.name as string,
    categoryId: (row.category_id as string) ?? null,
    typicalCostCents: (row.typical_cost_cents as number) ?? null,
    typicalBillingCycle: row.typical_billing_cycle as BillingCycle,
    cancelUrl: (row.cancel_url as string) ?? null,
    websiteUrl: (row.website_url as string) ?? null,
    iconUri: (row.icon_uri as string) ?? null,
    searchTerms: (row.search_terms as string) ?? null,
    popularityRank: row.popularity_rank as number,
    createdAt: row.created_at as string,
  };
}

function calculateNextRenewal(startDate: string, cycle: BillingCycle): string | null {
  if (cycle === 'lifetime') return null;
  const start = new Date(startDate + 'T00:00:00Z');
  const today = new Date(todayDate() + 'T00:00:00Z');
  const d = new Date(start);

  while (d <= today) {
    switch (cycle) {
      case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
      case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
      case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
      case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    }
  }
  return d.toISOString().slice(0, 10);
}

// ── Subscription CRUD ──────────────────────────────────────────────────

export function createSubscription(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateSubscriptionInput,
): Subscription {
  const input = CreateSubscriptionInputSchema.parse(rawInput);
  const now = nowIso();
  const nextRenewal = input.nextRenewalDate ?? calculateNextRenewal(input.startDate, input.billingCycle);

  db.execute(
    `INSERT INTO sb_subscriptions (id, name, cost_cents, billing_cycle, category_id, next_renewal_date, start_date, end_date, trial_end_date, icon_uri, url, notes, status, notification_enabled, notification_days_before, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.costCents, input.billingCycle, input.categoryId, nextRenewal, input.startDate, input.endDate, input.trialEndDate, input.iconUri, input.url, input.notes, input.status, input.notificationEnabled ? 1 : 0, input.notificationDaysBefore, now, now],
  );

  return {
    id,
    name: input.name,
    costCents: input.costCents,
    billingCycle: input.billingCycle,
    categoryId: input.categoryId,
    nextRenewalDate: nextRenewal,
    startDate: input.startDate,
    endDate: input.endDate,
    trialEndDate: input.trialEndDate,
    iconUri: input.iconUri,
    url: input.url,
    notes: input.notes,
    status: input.status,
    notificationEnabled: input.notificationEnabled,
    notificationDaysBefore: input.notificationDaysBefore,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSubscription(db: DatabaseAdapter, id: string): Subscription | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_subscriptions WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToSubscription(rows[0]) : null;
}

export function listSubscriptions(db: DatabaseAdapter, filter?: SubscriptionFilter): Subscription[] {
  const parsed = filter ? SubscriptionFilterSchema.parse(filter) : { sortBy: 'nextRenewal' as const, sortOrder: 'asc' as const };
  let sql = 'SELECT * FROM sb_subscriptions WHERE 1=1';
  const params: unknown[] = [];

  if (parsed.status) {
    sql += ' AND status = ?';
    params.push(parsed.status);
  }
  if (parsed.categoryId) {
    sql += ' AND category_id = ?';
    params.push(parsed.categoryId);
  }
  if (parsed.search) {
    sql += " AND name LIKE ? ESCAPE '\\'";
    params.push(`%${escapeLike(parsed.search)}%`);
  }

  const sortCol: Record<string, string> = {
    name: 'name',
    cost: 'cost_cents',
    nextRenewal: 'next_renewal_date',
    createdAt: 'created_at',
  };
  const col = sortCol[parsed.sortBy ?? 'nextRenewal'] ?? 'next_renewal_date';
  sql += ` ORDER BY ${col} ${parsed.sortOrder === 'desc' ? 'DESC' : 'ASC'} LIMIT 1000`;

  const rows = db.query<Record<string, unknown>>(sql, params);
  return rows.map(rowToSubscription);
}

export function updateSubscription(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateSubscriptionInput,
): Subscription | null {
  const current = getSubscription(db, id);
  if (!current) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (rawInput.name !== undefined) { updates.push('name = ?'); params.push(rawInput.name); }
  if (rawInput.billingCycle !== undefined) { updates.push('billing_cycle = ?'); params.push(rawInput.billingCycle); }
  if (rawInput.categoryId !== undefined) { updates.push('category_id = ?'); params.push(rawInput.categoryId); }
  if (rawInput.nextRenewalDate !== undefined) { updates.push('next_renewal_date = ?'); params.push(rawInput.nextRenewalDate); }
  if (rawInput.startDate !== undefined) { updates.push('start_date = ?'); params.push(rawInput.startDate); }
  if (rawInput.endDate !== undefined) { updates.push('end_date = ?'); params.push(rawInput.endDate); }
  if (rawInput.trialEndDate !== undefined) { updates.push('trial_end_date = ?'); params.push(rawInput.trialEndDate); }
  if (rawInput.iconUri !== undefined) { updates.push('icon_uri = ?'); params.push(rawInput.iconUri); }
  if (rawInput.url !== undefined) { updates.push('url = ?'); params.push(rawInput.url); }
  if (rawInput.notes !== undefined) { updates.push('notes = ?'); params.push(rawInput.notes); }
  if (rawInput.status !== undefined) { updates.push('status = ?'); params.push(rawInput.status); }
  if (rawInput.notificationEnabled !== undefined) { updates.push('notification_enabled = ?'); params.push(rawInput.notificationEnabled ? 1 : 0); }
  if (rawInput.notificationDaysBefore !== undefined) { updates.push('notification_days_before = ?'); params.push(rawInput.notificationDaysBefore); }

  // Track price change for history (written after the update succeeds)
  let priceChanged = false;
  if (rawInput.costCents !== undefined && rawInput.costCents !== current.costCents) {
    updates.push('cost_cents = ?');
    params.push(rawInput.costCents);
    priceChanged = true;
  }

  if (updates.length === 0) return current;

  const now = nowIso();
  params.push(now, id);
  db.execute(
    `UPDATE sb_subscriptions SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`,
    params,
  );

  // Record price history only after subscription update succeeded
  if (priceChanged) {
    const phId = crypto.randomUUID();
    db.execute(
      `INSERT INTO sb_price_history (id, subscription_id, old_cost_cents, new_cost_cents, changed_on, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [phId, id, current.costCents, rawInput.costCents!, now, now],
    );
  }

  return getSubscription(db, id);
}

export function deleteSubscription(db: DatabaseAdapter, id: string): boolean {
  const current = getSubscription(db, id);
  if (!current) return false;
  db.execute('DELETE FROM sb_subscriptions WHERE id = ?', [id]);
  return true;
}

export function getSubscriptionCount(db: DatabaseAdapter, status?: string): number {
  let sql = 'SELECT COUNT(*) as count FROM sb_subscriptions';
  const params: unknown[] = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  const rows = db.query<{ count: number }>(sql, params);
  return rows[0]?.count ?? 0;
}

// ── Category CRUD ──────────────────────────────────────────────────────

export function listCategories(db: DatabaseAdapter): Category[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_categories ORDER BY sort_order ASC',
  );
  return rows.map(rowToCategory);
}

export function createCategory(db: DatabaseAdapter, id: string, rawInput: CreateCategoryInput): Category {
  const input = CreateCategoryInputSchema.parse(rawInput);
  const now = nowIso();
  db.execute(
    `INSERT INTO sb_categories (id, name, icon, color, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.icon, input.color, input.sortOrder, now],
  );
  return { id, name: input.name, icon: input.icon, color: input.color, sortOrder: input.sortOrder, createdAt: now };
}

export function deleteCategory(db: DatabaseAdapter, id: string): boolean {
  const rows = db.query<Record<string, unknown>>('SELECT id FROM sb_categories WHERE id = ?', [id]);
  if (rows.length === 0) return false;
  db.execute('DELETE FROM sb_categories WHERE id = ?', [id]);
  return true;
}

// ── Price History ──────────────────────────────────────────────────────

export function getPriceHistory(db: DatabaseAdapter, subscriptionId: string): PriceHistory[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_price_history WHERE subscription_id = ? ORDER BY changed_on DESC LIMIT 500',
    [subscriptionId],
  );
  return rows.map(rowToPriceHistory);
}

export function addPriceChange(db: DatabaseAdapter, id: string, subscriptionId: string, oldCostCents: number, newCostCents: number, notes?: string): PriceHistory {
  const now = nowIso();
  db.execute(
    `INSERT INTO sb_price_history (id, subscription_id, old_cost_cents, new_cost_cents, changed_on, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, subscriptionId, oldCostCents, newCostCents, now, notes ?? null, now],
  );
  return { id, subscriptionId, oldCostCents, newCostCents, changedOn: now, notes: notes ?? null, createdAt: now };
}

// ── Renewal Events ─────────────────────────────────────────────────────

export function getUpcomingRenewals(db: DatabaseAdapter, daysAhead: number): (Subscription & { renewalDate: string; renewalAmountCents: number })[] {
  const today = todayDate();
  const future = new Date(today + 'T00:00:00Z');
  future.setUTCDate(future.getUTCDate() + daysAhead);
  const futureDate = future.toISOString().slice(0, 10);

  const rows = db.query<Record<string, unknown>>(
    `SELECT s.*, re.renewal_date, re.amount_cents as renewal_amount_cents
     FROM sb_subscriptions s
     JOIN sb_renewal_events re ON re.subscription_id = s.id
     WHERE re.status = 'upcoming' AND re.renewal_date >= ? AND re.renewal_date <= ?
     ORDER BY re.renewal_date ASC`,
    [today, futureDate],
  );

  return rows.map(row => ({
    ...rowToSubscription(row),
    renewalDate: row.renewal_date as string,
    renewalAmountCents: row.renewal_amount_cents as number,
  }));
}

export function generateRenewalEvents(db: DatabaseAdapter, subscriptionId: string, monthsAhead?: number): RenewalEvent[] {
  const sub = getSubscription(db, subscriptionId);
  if (!sub || sub.billingCycle === 'lifetime' || sub.status === 'cancelled' || sub.status === 'expired') return [];

  const months = monthsAhead ?? 12;
  const today = new Date(todayDate() + 'T00:00:00Z');
  const limit = new Date(today);
  limit.setUTCMonth(limit.getUTCMonth() + months);

  const startDate = sub.nextRenewalDate ?? sub.startDate;
  const d = new Date(startDate + 'T00:00:00Z');

  // Advance past dates to today
  while (d < today) {
    switch (sub.billingCycle) {
      case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
      case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
      case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
      case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    }
  }

  const events: RenewalEvent[] = [];
  const now = nowIso();

  while (d <= limit) {
    const dateStr = d.toISOString().slice(0, 10);
    // Use INSERT OR IGNORE with unique index to prevent duplicate renewals
    const eventId = crypto.randomUUID();
    db.execute(
      `INSERT OR IGNORE INTO sb_renewal_events (id, subscription_id, renewal_date, amount_cents, status, created_at)
       VALUES (?, ?, ?, ?, 'upcoming', ?)`,
      [eventId, subscriptionId, dateStr, sub.costCents, now],
    );
    // Check if we actually inserted (vs ignored duplicate)
    const inserted = db.query<{ id: string }>(
      'SELECT id FROM sb_renewal_events WHERE subscription_id = ? AND renewal_date = ? AND id = ?',
      [subscriptionId, dateStr, eventId],
    );
    if (inserted.length > 0) {
      events.push({ id: eventId, subscriptionId, renewalDate: dateStr, amountCents: sub.costCents, status: 'upcoming', notifiedAt: null, createdAt: now });
    }

    switch (sub.billingCycle) {
      case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
      case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
      case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
      case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    }
  }

  return events;
}

export function markRenewalPaid(db: DatabaseAdapter, eventId: string): RenewalEvent | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_renewal_events WHERE id = ?',
    [eventId],
  );
  if (rows.length === 0) return null;

  db.execute(
    `UPDATE sb_renewal_events SET status = 'paid' WHERE id = ?`,
    [eventId],
  );

  const event = rowToRenewalEvent(rows[0]);
  return { ...event, status: 'paid' };
}

export function getRenewalEvents(db: DatabaseAdapter, subscriptionId: string): RenewalEvent[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_renewal_events WHERE subscription_id = ? ORDER BY renewal_date ASC LIMIT 500',
    [subscriptionId],
  );
  return rows.map(rowToRenewalEvent);
}

// ── Cancellation Actions ───────────────────────────────────────────────

export function logCancellationAction(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateCancellationActionInput,
): CancellationAction {
  const input = CreateCancellationActionInputSchema.parse(rawInput);
  const now = nowIso();
  db.execute(
    `INSERT INTO sb_cancellation_actions (id, subscription_id, action, savings_cents, notes, acted_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.subscriptionId, input.action, input.savingsCents, input.notes, now, now],
  );
  return { id, subscriptionId: input.subscriptionId, action: input.action, savingsCents: input.savingsCents, notes: input.notes, actedOn: now, createdAt: now };
}

export function getCancellationHistory(db: DatabaseAdapter, subscriptionId: string): CancellationAction[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_cancellation_actions WHERE subscription_id = ? ORDER BY acted_on DESC LIMIT 500',
    [subscriptionId],
  );
  return rows.map(rowToCancellationAction);
}

// ── Price Alternatives ─────────────────────────────────────────────────

export function listAlternatives(db: DatabaseAdapter, subscriptionId: string): PriceAlternative[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_price_alternatives WHERE subscription_id = ? ORDER BY alternative_cost_cents ASC',
    [subscriptionId],
  );
  return rows.map(rowToPriceAlternative);
}

export function addAlternative(db: DatabaseAdapter, id: string, rawInput: CreatePriceAlternativeInput): PriceAlternative {
  const input = CreatePriceAlternativeInputSchema.parse(rawInput);
  const now = nowIso();
  db.execute(
    `INSERT INTO sb_price_alternatives (id, subscription_id, alternative_name, alternative_cost_cents, alternative_billing_cycle, alternative_url, notes, is_free_tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.subscriptionId, input.alternativeName, input.alternativeCostCents, input.alternativeBillingCycle, input.alternativeUrl, input.notes, input.isFreeTier ? 1 : 0, now, now],
  );
  return { id, subscriptionId: input.subscriptionId, alternativeName: input.alternativeName, alternativeCostCents: input.alternativeCostCents, alternativeBillingCycle: input.alternativeBillingCycle ?? 'monthly', alternativeUrl: input.alternativeUrl ?? null, notes: input.notes ?? null, isFreeTier: input.isFreeTier ?? false, createdAt: now, updatedAt: now };
}

export function deleteAlternative(db: DatabaseAdapter, id: string): boolean {
  const rows = db.query<Record<string, unknown>>('SELECT id FROM sb_price_alternatives WHERE id = ?', [id]);
  if (rows.length === 0) return false;
  db.execute('DELETE FROM sb_price_alternatives WHERE id = ?', [id]);
  return true;
}

// ── Catalog ────────────────────────────────────────────────────────────

export function searchCatalog(db: DatabaseAdapter, query: string): CatalogEntry[] {
  const escaped = escapeLike(query);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sb_catalog WHERE name LIKE ? ESCAPE '\\' OR search_terms LIKE ? ESCAPE '\\' ORDER BY popularity_rank ASC LIMIT 200`,
    [`%${escaped}%`, `%${escaped}%`],
  );
  return rows.map(rowToCatalogEntry);
}

export function getCatalogByCategory(db: DatabaseAdapter, categoryId: string): CatalogEntry[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_catalog WHERE category_id = ? ORDER BY popularity_rank ASC',
    [categoryId],
  );
  return rows.map(rowToCatalogEntry);
}

export function getAllCatalogEntries(db: DatabaseAdapter): CatalogEntry[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_catalog ORDER BY popularity_rank ASC LIMIT 500',
  );
  return rows.map(rowToCatalogEntry);
}

// ── Aggregations ───────────────────────────────────────────────────────

export function getTotalMonthlyCost(db: DatabaseAdapter, status?: string): number {
  const subs = listSubscriptions(db, status ? { status: status as Subscription['status'], sortBy: 'name', sortOrder: 'asc' } : undefined);
  const active = status ? subs : subs.filter(s => s.status === 'active');
  return active.reduce((sum, s) => sum + normalizeToMonthlyCents(s.costCents, s.billingCycle), 0);
}

export function getTotalAnnualCost(db: DatabaseAdapter, status?: string): number {
  return Math.round(getTotalMonthlyCost(db, status) * 12);
}

export function getCostByCategory(db: DatabaseAdapter): { categoryId: string | null; categoryName: string; totalMonthlyCents: number; count: number }[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT s.category_id, COALESCE(c.name, 'Uncategorized') as category_name,
     COUNT(*) as count
     FROM sb_subscriptions s
     LEFT JOIN sb_categories c ON c.id = s.category_id
     WHERE s.status = 'active'
     GROUP BY s.category_id
     ORDER BY count DESC`,
  );

  return rows.map(row => {
    const categoryId = (row.category_id as string) ?? null;
    const subs = listSubscriptions(db, { categoryId: categoryId ?? undefined, status: 'active', sortBy: 'name', sortOrder: 'asc' });
    const totalMonthlyCents = subs.reduce((sum, s) => sum + normalizeToMonthlyCents(s.costCents, s.billingCycle), 0);
    return {
      categoryId,
      categoryName: row.category_name as string,
      totalMonthlyCents,
      count: row.count as number,
    };
  });
}

export function normalizeToMonthlyCents(costCents: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly': return Math.round(costCents * 52 / 12);
    case 'monthly': return costCents;
    case 'quarterly': return Math.round(costCents / 3);
    case 'yearly': return Math.round(costCents / 12);
    case 'lifetime': return 0;
  }
}

export function normalizeToAnnualCents(costCents: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly': return costCents * 52;
    case 'monthly': return costCents * 12;
    case 'quarterly': return costCents * 4;
    case 'yearly': return costCents;
    case 'lifetime': return 0;
  }
}
