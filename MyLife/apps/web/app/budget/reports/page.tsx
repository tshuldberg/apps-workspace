import Link from 'next/link';
import {
  calculateSavingsRate,
  getBudgetedVsSpent,
  getMonthlySpendingTrend,
  getSpendingByCategory,
  getTopPayees,
} from '@mylife/budget';
import { fetchAccounts, fetchEnvelopes, fetchTransactions } from '../actions';
import { BudgetBarChart, BudgetDonutChart, BudgetLineChart } from '../charts';
import {
  BudgetColumns,
  BudgetHero,
  BudgetMetricGrid,
  BudgetPage,
  BudgetPanel,
  BudgetRouteCard,
  BudgetRouteGrid,
  BudgetTable,
  BudgetTonePill,
  buildStatPill,
} from '../primitives';
import { buildReportAllocations, buildReportCategories, buildReportTransactions, monthLabel, todayIso } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetPercent, formatBudgetMonth } from '../ui';

export const dynamic = 'force-dynamic';

type ReportsSearchParams = Promise<{ period?: string | string[] }>;

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function buildRange(period: string) {
  const today = new Date();
  const end = todayIso();

  if (period === 'year') {
    return { end, start: `${today.getFullYear()}-01-01` };
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    return { end, start: start.toISOString().slice(0, 10) };
  }

  return { end, start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01` };
}

function buildMonthlyBars(transactions: ReturnType<typeof buildReportTransactions>) {
  const labels = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  return labels.map((month) => {
    const spent = transactions
      .filter((transaction) => transaction.date.startsWith(month) && transaction.amount < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const income = transactions
      .filter((transaction) => transaction.date.startsWith(month) && transaction.amount > 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      income,
      label: monthLabel(month),
      spent,
    };
  });
}

export default async function BudgetReportsPage({
  searchParams,
}: {
  searchParams: ReportsSearchParams;
}) {
  const params = await searchParams;
  const period = single(params.period) === 'quarter' || single(params.period) === 'year' ? single(params.period)! : 'month';
  const range = buildRange(period);
  const [accounts, envelopes, transactions] = await Promise.all([
    fetchAccounts(),
    fetchEnvelopes(),
    fetchTransactions({ limit: 800 }),
  ]);

  const reportTransactions = buildReportTransactions(transactions);
  const categories = buildReportCategories(envelopes);
  const allocations = buildReportAllocations(envelopes);
  const categorySpending = getSpendingByCategory(reportTransactions, [], categories, range);
  const budgetVsSpent = getBudgetedVsSpent(allocations, reportTransactions, [], categories, range).slice(0, 8);
  const topPayees = getTopPayees(reportTransactions, range, 6);
  const trend = getMonthlySpendingTrend(reportTransactions, {
    end: todayIso(),
    start: `${new Date().getFullYear() - 1}-01-01`,
  }).slice(-6);

  const monthlyBars = buildMonthlyBars(reportTransactions);
  const totalIncome = reportTransactions
    .filter((transaction) => transaction.date >= range.start && transaction.date <= range.end && transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSpent = reportTransactions
    .filter((transaction) => transaction.date >= range.start && transaction.date <= range.end && transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const net = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? calculateSavingsRate(totalIncome, totalSpent) : 0;
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    [
      'date,payee,envelope,direction,amount_cents',
      ...transactions.map((transaction) =>
        [
          transaction.occurred_on,
          transaction.merchant ?? '',
          envelopes.find((envelope) => envelope.id === transaction.envelope_id)?.name ?? '',
          transaction.direction,
          String(transaction.amount),
        ].join(','),
      ),
    ].join('\n'),
  )}`;
  const latestAccountCount = accounts.filter((account) => account.archived === 0).length;

  return (
    <BudgetPage>
      <BudgetHero
        actions={
          <>
            <Link download={`mybudget-report-${period}.csv`} href={csvHref} style={buttonStyle('secondary')}>
              Export CSV
            </Link>
            <Link href="/budget/weekly-digest" style={buttonStyle('ghost')}>
              Weekly Digest
            </Link>
          </>
        }
        description={`Desktop reporting for ${formatBudgetMonth(range.start.slice(0, 7))}. Compare budget coverage, spending pace, and payee concentration without leaving the budget shell.`}
        eyebrow="Reports"
        title="Financial Reporting"
      >
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          {buildStatPill('calendar_today', 'Range', period === 'month' ? 'This month' : period === 'quarter' ? 'Quarter to date' : 'Year to date')}
          {buildStatPill('account_balance', 'Live Accounts', latestAccountCount)}
          {buildStatPill('payments', 'Transactions', transactions.length)}
        </div>
      </BudgetHero>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {[
          { href: '/budget/reports?period=month', label: 'This Month', tone: period === 'month' ? 'money' : 'neutral' },
          { href: '/budget/reports?period=quarter', label: 'Quarter', tone: period === 'quarter' ? 'money' : 'neutral' },
          { href: '/budget/reports?period=year', label: 'Year', tone: period === 'year' ? 'money' : 'neutral' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <BudgetTonePill tone={item.tone as 'money' | 'neutral'}>{item.label}</BudgetTonePill>
          </Link>
        ))}
      </div>

      <BudgetMetricGrid>
        <BudgetMetricCard label="Income" subvalue={`Range ${range.start} to ${range.end}`} tone="money" value={formatBudgetCurrency(totalIncome)} />
        <BudgetMetricCard label="Spending" subvalue={`${categorySpending.length} active envelopes`} tone="danger" value={formatBudgetCurrency(totalSpent)} />
        <BudgetMetricCard label="Net" subvalue={`Savings rate ${formatBudgetPercent(savingsRate, 0)}`} tone={net >= 0 ? 'accent' : 'danger'} value={formatBudgetCurrency(net, { signed: true })} />
        <BudgetMetricCard label="Top Category" subvalue={categorySpending[0] ? `${categorySpending[0].transactionCount} transactions` : 'No outflows in range'} tone="info" value={categorySpending[0] ? categorySpending[0].categoryName : 'None'} />
      </BudgetMetricGrid>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel
              description="Actual envelope spending mix for the selected period."
              title="Category Mix"
            >
              <BudgetDonutChart
                data={categorySpending.map((entry, index) => ({
                  color: [undefined, '#78C9FF', '#FF9A62', '#9CE29C', '#F2D16B', '#F48FB1'][index],
                  label: entry.categoryName,
                  value: entry.amount,
                }))}
                emptyLabel="No spending in range."
              />
            </BudgetPanel>

            <BudgetPanel
              description="Six-month outflow trend."
              title="Spending Trend"
            >
              <BudgetLineChart
                data={trend.map((point) => ({
                  label: monthLabel(point.month),
                  value: point.amount,
                }))}
              />
            </BudgetPanel>

            <BudgetPanel
              description="Income versus expense across the last six months."
              title="Cash Flow"
            >
              <BudgetBarChart
                data={monthlyBars.map((row) => ({
                  label: `${row.label} spent`,
                  value: row.spent,
                }))}
              />
              <BudgetTable
                columns={['Month', 'Income', 'Spent', 'Net']}
                rows={monthlyBars.map((row) => [
                  row.label,
                  formatBudgetCurrency(row.income),
                  formatBudgetCurrency(row.spent),
                  formatBudgetCurrency(row.income - row.spent, { signed: true }),
                ])}
              />
            </BudgetPanel>

            <BudgetPanel
              description="Budgeted envelopes compared with actual spend in the current range."
              title="Budget Coverage"
            >
              <BudgetTable
                columns={['Envelope', 'Budgeted', 'Spent', 'Remaining', 'Used']}
                rows={budgetVsSpent.map((row) => [
                  row.categoryName,
                  formatBudgetCurrency(row.budgeted),
                  formatBudgetCurrency(row.spent),
                  formatBudgetCurrency(row.remaining, { signed: true }),
                  formatBudgetPercent(row.percentUsed, 0),
                ])}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetPanel
              description="Highest spend merchants in the selected range."
              title="Top Payees"
            >
              <BudgetTable
                columns={['Payee', 'Spend', 'Count']}
                rows={topPayees.length > 0
                  ? topPayees.map((row) => [row.payee, formatBudgetCurrency(row.totalAmount), row.transactionCount])
                  : [['No merchant data', '0', '0']]}
              />
            </BudgetPanel>

            <BudgetPanel
              description="Jump to the adjacent budget intelligence pages."
              title="Related Surfaces"
            >
              <BudgetRouteGrid>
                <BudgetRouteCard description="Review incomplete imports and missing categorizations." href="/budget/review" icon="check_circle" title="Review Queue" />
                <BudgetRouteCard description="See weekly momentum, biggest purchases, and no-spend days." href="/budget/weekly-digest" icon="schedule" title="Weekly Digest" />
                <BudgetRouteCard description="Track cash buffer growth through Age of Money snapshots." href="/budget/age-of-money" icon="calendar_today" title="Age of Money" />
                <BudgetRouteCard description="Spot stretches of low-spend behavior." href="/budget/no-spend" icon="wallet" title="No-Spend Streak" />
              </BudgetRouteGrid>
            </BudgetPanel>
          </>
        }
      />
    </BudgetPage>
  );
}
