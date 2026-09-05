import { calculateNoSpendStats, getSpendingHeatmap } from '@mylife/budget';
import { fetchTransactions } from '../actions';
import { currentMonthKey, todayIso } from '../route-utils';
import { BudgetHero, BudgetMetricGrid, BudgetPage, BudgetPanel, BudgetTable } from '../primitives';
import { BudgetMetricCard, formatBudgetCurrency, formatBudgetPercent } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetNoSpendPage() {
  const transactions = await fetchTransactions({ limit: 800 });
  const today = todayIso();
  const outflows = transactions.filter((transaction) => transaction.direction === 'outflow');
  const stats = calculateNoSpendStats(
    outflows.map((transaction) => transaction.occurred_on),
    today,
  );
  const [year, month] = currentMonthKey().split('-').map(Number);
  const spendMap = new Map<string, { count: number; total: number }>();
  outflows.forEach((transaction) => {
    const existing = spendMap.get(transaction.occurred_on) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += Math.abs(transaction.amount);
    spendMap.set(transaction.occurred_on, existing);
  });
  const heatmap = getSpendingHeatmap(
    Array.from(spendMap.entries()).map(([date, data]) => ({
      date,
      totalCents: data.total,
      transactionCount: data.count,
    })),
    year,
    month,
    today,
  );

  return (
    <BudgetPage>
      <BudgetHero description="No-spend streak tracking for the current month." eyebrow="No-Spend" title="No-Spend Streaks" />

      <BudgetMetricGrid>
        <BudgetMetricCard label="Current Streak" subvalue="Consecutive no-spend days" tone="money" value={`${stats.currentStreak}d`} />
        <BudgetMetricCard label="Longest Streak" subvalue="This month" tone="accent" value={`${stats.longestStreak}d`} />
        <BudgetMetricCard label="No-Spend Days" subvalue={`${stats.daysElapsed} elapsed days`} tone="info" value={stats.noSpendDaysThisMonth} />
        <BudgetMetricCard label="No-Spend %" subvalue="Month to date" tone="neutral" value={formatBudgetPercent(stats.noSpendPercent, 0)} />
      </BudgetMetricGrid>

      <BudgetPanel description="Current month spend intensity. Darker cells mean more outflow that day." title="Heatmap">
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {heatmap.days.map((day) => (
            <div
              key={day.date}
              style={{
                background: day.totalCents === 0 ? 'rgba(48,209,88,0.16)' : `rgba(201,137,77,${Math.max(0.12, day.intensity)})`,
                borderRadius: 14,
                minHeight: 70,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{day.date.slice(-2)}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{formatBudgetCurrency(day.totalCents)}</div>
            </div>
          ))}
        </div>
      </BudgetPanel>

      <BudgetPanel description="Month summary from the heatmap engine." title="Month Summary">
        <BudgetTable
          columns={['Metric', 'Value']}
          rows={[
            ['Month Total Spend', formatBudgetCurrency(heatmap.monthTotalCents)],
            ['Average Daily Spend', formatBudgetCurrency(heatmap.averageDailyCents)],
            ['Max Daily Spend', formatBudgetCurrency(heatmap.maxDailyCents)],
          ]}
        />
      </BudgetPanel>
    </BudgetPage>
  );
}
