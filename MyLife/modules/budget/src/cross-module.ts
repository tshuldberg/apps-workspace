/**
 * Cross-module interface for the budget module.
 *
 * Exposes budget data to hub-level features: unified search, dashboard
 * summaries, activity feeds, and correlation analysis.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  CorrelationDataset,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';

const MODULE_ID = 'budget';
const MAX_TODAY_CARDS = 3;

function asDb(db: unknown): DatabaseAdapter {
  return db as DatabaseAdapter;
}

function tableExists(db: DatabaseAdapter, name: string): boolean {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name],
  );
  return rows.length > 0;
}

function getSearchableContent(db: unknown): SearchableItem[] {
  const adapter = asDb(db);

  // Transactions: search by merchant name and note
  const transactions = adapter.query<{
    id: string;
    merchant: string | null;
    note: string | null;
    envelope_name: string | null;
    updated_at: string;
  }>(
    `SELECT t.id, t.merchant, t.note, e.name AS envelope_name, t.updated_at
     FROM bg_transactions t
     LEFT JOIN bg_envelopes e ON t.envelope_id = e.id
     ORDER BY t.occurred_on DESC
     LIMIT 500`,
  );

  const items: SearchableItem[] = transactions
    .filter((t) => t.merchant || t.note)
    .map((t) => ({
      moduleId: MODULE_ID,
      type: 'transaction',
      title: t.merchant ?? 'Transaction',
      body: t.note ?? undefined,
      tags: t.envelope_name ? [t.envelope_name] : undefined,
      itemId: t.id,
      updatedAt: t.updated_at,
    }));

  // Envelopes (categories): search by name
  const envelopes = adapter.query<{ id: string; name: string; updated_at: string }>(
    `SELECT id, name, updated_at FROM bg_envelopes WHERE archived = 0`,
  );
  for (const env of envelopes) {
    items.push({
      moduleId: MODULE_ID,
      type: 'envelope',
      title: env.name,
      itemId: env.id,
      updatedAt: env.updated_at,
    });
  }

  // Payee cache: unique merchant names for search
  const payees = adapter.query<{ payee: string; last_used: string }>(
    `SELECT payee, last_used FROM bg_payee_cache ORDER BY use_count DESC LIMIT 200`,
  );
  for (const p of payees) {
    items.push({
      moduleId: MODULE_ID,
      type: 'payee',
      title: p.payee,
      itemId: `payee:${p.payee}`,
      updatedAt: p.last_used,
    });
  }

  return items;
}

function getDataSummary(db: unknown): ModuleSummary {
  const adapter = asDb(db);

  const txCount = adapter.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM bg_transactions',
  )[0].c;

  const envelopeCount = adapter.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM bg_envelopes WHERE archived = 0',
  )[0].c;

  // Total monthly budget across all active envelopes (cents)
  const totalBudget = adapter.query<{ total: number | null }>(
    'SELECT SUM(monthly_budget) as total FROM bg_envelopes WHERE archived = 0',
  )[0].total ?? 0;

  // Spending this month (outflow transactions)
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const spentThisMonth = adapter.query<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM bg_transactions
     WHERE direction = 'outflow' AND occurred_on >= ?`,
    [monthStart],
  )[0].total ?? 0;

  const remaining = totalBudget - spentThisMonth;

  // Spending today
  const today = now.toISOString().slice(0, 10);
  const spentToday = adapter.query<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM bg_transactions
     WHERE direction = 'outflow' AND occurred_on = ?`,
    [today],
  )[0].total ?? 0;

  // Goals progress
  const goalStats = adapter.query<{
    total_goals: number;
    completed_goals: number;
    total_target: number | null;
    total_saved: number | null;
  }>(
    `SELECT COUNT(*) as total_goals,
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_goals,
            SUM(target_amount) as total_target,
            SUM(completed_amount) as total_saved
     FROM bg_goals`,
  )[0];

  const lastTx = adapter.query<{ latest: string | null }>(
    'SELECT MAX(updated_at) as latest FROM bg_transactions',
  )[0].latest;

  return {
    moduleId: MODULE_ID,
    totalItems: txCount,
    stats: {
      envelopeCount,
      totalBudgetCents: totalBudget,
      spentThisMonthCents: spentThisMonth,
      remainingCents: remaining,
      spentTodayCents: spentToday,
      totalGoals: goalStats.total_goals,
      completedGoals: goalStats.completed_goals,
      goalTargetCents: goalStats.total_target ?? 0,
      goalSavedCents: goalStats.total_saved ?? 0,
    },
    lastActivity: lastTx ?? undefined,
  };
}

function getActivityFeed(db: unknown, since: Date): ActivityItem[] {
  const adapter = asDb(db);
  const sinceStr = since.toISOString();
  const items: ActivityItem[] = [];

  // Recent transactions
  const transactions = adapter.query<{
    id: string;
    merchant: string | null;
    amount: number;
    direction: string;
    envelope_name: string | null;
    created_at: string;
  }>(
    `SELECT t.id, t.merchant, t.amount, t.direction, e.name AS envelope_name, t.created_at
     FROM bg_transactions t
     LEFT JOIN bg_envelopes e ON t.envelope_id = e.id
     WHERE t.created_at >= ?
     ORDER BY t.created_at DESC
     LIMIT 100`,
    [sinceStr],
  );

  for (const tx of transactions) {
    const dollars = (tx.amount / 100).toFixed(2);
    const label = tx.merchant ?? tx.envelope_name ?? 'Transaction';
    const desc = tx.direction === 'outflow'
      ? `Spent $${dollars} at ${label}`
      : `Received $${dollars} from ${label}`;
    items.push({
      moduleId: MODULE_ID,
      action: tx.direction === 'outflow' ? 'spent' : 'received',
      description: desc,
      timestamp: tx.created_at,
      itemId: tx.id,
      itemType: 'transaction',
    });
  }

  // Goal milestones (completed goals since date)
  const goals = adapter.query<{
    id: string;
    name: string;
    target_amount: number;
    updated_at: string;
  }>(
    `SELECT id, name, target_amount, updated_at FROM bg_goals
     WHERE is_completed = 1 AND updated_at >= ?
     ORDER BY updated_at DESC`,
    [sinceStr],
  );

  for (const goal of goals) {
    const dollars = (goal.target_amount / 100).toFixed(2);
    items.push({
      moduleId: MODULE_ID,
      action: 'completed',
      description: `Reached savings goal "${goal.name}" ($${dollars})`,
      timestamp: goal.updated_at,
      itemId: goal.id,
      itemType: 'goal',
    });
  }

  // Budget alert triggers
  const alerts = adapter.query<{
    id: string;
    envelope_id: string;
    envelope_name: string | null;
    spent_pct: number;
    notified_at: string;
  }>(
    `SELECT h.id, h.envelope_id, e.name AS envelope_name, h.spent_pct, h.notified_at
     FROM bg_alert_history h
     LEFT JOIN bg_envelopes e ON h.envelope_id = e.id
     WHERE h.notified_at >= ?
     ORDER BY h.notified_at DESC
     LIMIT 50`,
    [sinceStr],
  );

  for (const alert of alerts) {
    const envName = alert.envelope_name ?? 'Unknown';
    items.push({
      moduleId: MODULE_ID,
      action: 'alert',
      description: `Budget alert: ${envName} at ${alert.spent_pct}% spent`,
      timestamp: alert.notified_at,
      itemId: alert.id,
      itemType: 'alert',
    });
  }

  // Sort all items by timestamp descending
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return items;
}

function getCorrelationData(db: unknown): CorrelationDataset {
  const adapter = asDb(db);

  // Daily spending totals for the last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const dailySpending = adapter.query<{ day: string; total: number }>(
    `SELECT occurred_on AS day, SUM(amount) AS total
     FROM bg_transactions
     WHERE direction = 'outflow' AND occurred_on >= ?
     GROUP BY occurred_on
     ORDER BY occurred_on`,
    [cutoffStr],
  );

  const dailyIncome = adapter.query<{ day: string; total: number }>(
    `SELECT occurred_on AS day, SUM(amount) AS total
     FROM bg_transactions
     WHERE direction = 'inflow' AND occurred_on >= ?
     GROUP BY occurred_on
     ORDER BY occurred_on`,
    [cutoffStr],
  );

  return {
    moduleId: MODULE_ID,
    series: [
      {
        metric: 'daily_spending',
        label: 'Daily Spending',
        unit: 'cents',
        data: dailySpending.map((d) => ({ date: d.day, value: Number(d.total) })),
      },
      {
        metric: 'daily_income',
        label: 'Daily Income',
        unit: 'cents',
        data: dailyIncome.map((d) => ({ date: d.day, value: Number(d.total) })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// getTodayCards (Phase 2 anchor)
// ---------------------------------------------------------------------------

interface EnvelopeApproachingRow {
  id: string;
  name: string;
  monthly_budget: number;
  spent: number | null;
}

interface SubscriptionRenewalRow {
  id: string;
  name: string;
  price: number;
  next_renewal: string;
}

interface UncategorizedTxnRow {
  id: string;
  merchant: string | null;
  amount: number;
  occurred_on: string;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildEnvelopeOverspendCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'bg_envelopes') || !tableExists(db, 'bg_transactions')) return null;

  const monthStart = `${context.now.getFullYear()}-${String(context.now.getMonth() + 1).padStart(2, '0')}-01`;

  const rows = db.query<EnvelopeApproachingRow>(
    `SELECT e.id, e.name, e.monthly_budget,
            COALESCE((SELECT SUM(t.amount) FROM bg_transactions t
                      WHERE t.envelope_id = e.id
                        AND t.direction = 'outflow'
                        AND t.occurred_on >= ?), 0) AS spent
     FROM bg_envelopes e
     WHERE e.archived = 0 AND e.monthly_budget > 0`,
    [monthStart],
  );

  let best: { row: EnvelopeApproachingRow; ratio: number } | null = null;
  for (const row of rows) {
    const spent = Number(row.spent ?? 0);
    const ratio = spent / row.monthly_budget;
    if (ratio < 0.9) continue;
    if (!best || ratio > best.ratio) {
      best = { row, ratio };
    }
  }
  if (!best) return null;

  const pct = Math.round(best.ratio * 100);
  return {
    id: `budget.envelope.${best.row.id}`,
    moduleId: MODULE_ID,
    kind: 'progress',
    priority: 50,
    title: `${best.row.name}: ${pct}% spent`,
    subtitle: `Approaching monthly target`,
    cta: { label: 'Open envelope', route: '/budget/envelope-detail' },
    dismissible: true,
  };
}

function buildSubscriptionRenewalCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (!tableExists(db, 'bg_subscriptions')) return null;

  const today = isoDate(context.now);
  const horizon = new Date(context.now.getTime() + 3 * 86400000);
  const horizonStr = isoDate(horizon);

  const rows = db.query<SubscriptionRenewalRow>(
    `SELECT id, name, price, next_renewal
     FROM bg_subscriptions
     WHERE status = 'active'
       AND next_renewal >= ?
       AND next_renewal <= ?
     ORDER BY next_renewal ASC
     LIMIT 1`,
    [today, horizonStr],
  );
  const sub = rows[0];
  if (!sub) return null;

  const dollars = (sub.price / 100).toFixed(2);
  return {
    id: `budget.subscription.${sub.id}`,
    moduleId: MODULE_ID,
    kind: 'reminder',
    priority: 60,
    title: `${sub.name} renews ${sub.next_renewal}`,
    subtitle: `$${dollars} on the way`,
    cta: { label: 'Review subscription', route: '/budget/subscription-detail' },
    dismissible: true,
  };
}

function buildUncategorizedTxnCard(db: DatabaseAdapter): TodayCard | null {
  if (!tableExists(db, 'bg_transactions')) return null;

  const rows = db.query<UncategorizedTxnRow>(
    `SELECT id, merchant, amount, occurred_on
     FROM bg_transactions
     WHERE envelope_id IS NULL
       AND direction = 'outflow'
     ORDER BY occurred_on DESC, created_at DESC
     LIMIT 1`,
  );
  const tx = rows[0];
  if (!tx) return null;

  const dollars = (tx.amount / 100).toFixed(2);
  const merchant = tx.merchant ?? 'Transaction';
  return {
    id: `budget.transaction.${tx.id}`,
    moduleId: MODULE_ID,
    kind: 'action',
    priority: 45,
    title: `Uncategorized: ${merchant}`,
    subtitle: `$${dollars} on ${tx.occurred_on}`,
    cta: { label: 'Categorize', route: `/budget/transactions/${tx.id}` },
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const renewal = buildSubscriptionRenewalCard(db, context);
  if (renewal) cards.push(renewal);

  const envelope = buildEnvelopeOverspendCard(db, context);
  if (envelope) cards.push(envelope);

  const uncategorized = buildUncategorizedTxnCard(db);
  if (uncategorized) cards.push(uncategorized);

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_TODAY_CARDS);
}

export const budgetCrossModule: CrossModuleInterface = {
  getSearchableContent,
  getDataSummary,
  getActivityFeed,
  getCorrelationData,
  getTodayCards: (db, context) => getTodayCards(asDb(db), context),
};
