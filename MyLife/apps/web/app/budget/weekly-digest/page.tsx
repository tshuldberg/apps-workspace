import { generateWeeklyDigest } from '@mylife/budget';
import { fetchAlertHistory, fetchEnvelopes, fetchTransactions } from '../actions';
import { BudgetHero, BudgetMetricGrid, BudgetPage, BudgetPanel, BudgetTable } from '../primitives';
import { weekStartIso } from '../route-utils';
import { BudgetMetricCard, formatBudgetCurrency, formatBudgetDate } from '../ui';

export const dynamic = 'force-dynamic';

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function BudgetWeeklyDigestPage() {
  const [envelopes, transactions] = await Promise.all([
    fetchEnvelopes(),
    fetchTransactions({ limit: 500 }),
  ]);
  const weekStart = weekStartIso();
  const weekEnd = addDays(weekStart, 6);
  const priorWeekStart = addDays(weekStart, -7);
  const priorWeekEnd = addDays(weekStart, -1);
  const alertsTriggered = (await fetchAlertHistory(weekStart.slice(0, 7))).filter((entry) => entry.notified_at.slice(0, 10) >= weekStart && entry.notified_at.slice(0, 10) <= weekEnd).length;
  const envelopeMap = new Map(envelopes.map((envelope) => [envelope.id, envelope.name]));
  const digest = generateWeeklyDigest({
    alertsTriggered,
    priorWeekSpentCents: transactions
      .filter((transaction) => transaction.direction === 'outflow' && transaction.occurred_on >= priorWeekStart && transaction.occurred_on <= priorWeekEnd)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    transactions: transactions
      .filter((transaction) => transaction.occurred_on >= weekStart && transaction.occurred_on <= weekEnd)
      .map((transaction) => ({
        amountCents: Math.abs(transaction.amount),
        date: transaction.occurred_on,
        direction: transaction.direction,
        envelopeName: transaction.envelope_id ? envelopeMap.get(transaction.envelope_id) ?? null : null,
        merchant: transaction.merchant,
      })),
    weekStart,
  });

  return (
    <BudgetPage>
      <BudgetHero description={digest.summary} eyebrow="Weekly Digest" title="Weekly Spending Digest" />

      <BudgetMetricGrid>
        <BudgetMetricCard label="Spent" subvalue={`${formatBudgetDate(digest.weekStart)} to ${formatBudgetDate(digest.weekEnd)}`} tone="danger" value={formatBudgetCurrency(digest.totalSpentCents)} />
        <BudgetMetricCard label="Income" subvalue="Weekly inflow" tone="money" value={formatBudgetCurrency(digest.totalIncomeCents)} />
        <BudgetMetricCard label="Net" subvalue={`${digest.noSpendDays} no-spend days`} tone={digest.netCents >= 0 ? 'accent' : 'danger'} value={formatBudgetCurrency(digest.netCents, { signed: true })} />
        <BudgetMetricCard label="Alerts" subvalue="Triggered this week" tone="info" value={digest.alertsTriggered} />
      </BudgetMetricGrid>

      <BudgetPanel description="Category concentration for the week." title="Top Categories">
        <BudgetTable
          columns={['Category', 'Spend', 'Count']}
          rows={digest.topCategories.length > 0
            ? digest.topCategories.map((category) => [
                category.envelopeName,
                formatBudgetCurrency(category.totalCents),
                category.transactionCount,
              ])
            : [['No spend categories', formatBudgetCurrency(0), 0]]}
        />
      </BudgetPanel>

      <BudgetPanel description="Single biggest purchase for the current digest window." title="Biggest Purchase">
        <BudgetTable
          columns={['Merchant', 'Amount', 'Envelope', 'Date']}
          rows={digest.biggestPurchase
            ? [[
                digest.biggestPurchase.merchant,
                formatBudgetCurrency(digest.biggestPurchase.amountCents),
                digest.biggestPurchase.envelopeName ?? 'Uncategorized',
                formatBudgetDate(digest.biggestPurchase.date),
              ]]
            : [['No outflows this week', '-', '-', '-']]}
        />
      </BudgetPanel>
    </BudgetPage>
  );
}
