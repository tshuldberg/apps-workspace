import { fetchMonthlyIncome, fetchTransactions } from '../actions';
import { BudgetBarChart } from '../charts';
import { BudgetHero, BudgetMetricGrid, BudgetPage, BudgetPanel, BudgetTable } from '../primitives';
import { currentMonthKey, monthLabel } from '../route-utils';
import { BudgetMetricCard, formatBudgetCurrency } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetIncomePage() {
  const [monthlyIncome, transactions] = await Promise.all([
    fetchMonthlyIncome(currentMonthKey()),
    fetchTransactions({ limit: 800 }),
  ]);

  const incomeTransactions = transactions.filter((transaction) => transaction.direction === 'inflow');
  const monthlySeries = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const total = incomeTransactions
      .filter((transaction) => transaction.occurred_on.startsWith(month))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return { label: monthLabel(month), value: total };
  });
  const sourceMap = new Map<string, number>();
  incomeTransactions.forEach((transaction) => {
    const key = transaction.merchant ?? 'Unknown';
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + transaction.amount);
  });
  const sources = Array.from(sourceMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <BudgetPage>
      <BudgetHero
        description="Income tracking parity for desktop with monthly totals and source concentration."
        eyebrow="Income"
        title="Income Tracking"
      />

      <BudgetMetricGrid>
        <BudgetMetricCard label="This Month" subvalue="Current month inflow" tone="money" value={formatBudgetCurrency(monthlyIncome)} />
        <BudgetMetricCard label="Inflow Count" subvalue="Tracked transactions" tone="accent" value={incomeTransactions.length} />
        <BudgetMetricCard label="Top Source" subvalue="Largest merchant/source" tone="info" value={sources[0]?.[0] ?? 'None'} />
      </BudgetMetricGrid>

      <BudgetPanel description="Six-month income view." title="Income Trend">
        <BudgetBarChart data={monthlySeries} />
      </BudgetPanel>

      <BudgetPanel description="Income grouped by source or merchant label." title="Income Sources">
        <BudgetTable
          columns={['Source', 'Amount']}
          rows={sources.length > 0 ? sources.map(([source, amount]) => [source, formatBudgetCurrency(amount)]) : [['No income yet', formatBudgetCurrency(0)]]}
        />
      </BudgetPanel>
    </BudgetPage>
  );
}
