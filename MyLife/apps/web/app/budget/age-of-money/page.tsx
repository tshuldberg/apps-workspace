import { redirect } from 'next/navigation';
import { calculateAgeOfMoney, calculateAoMTrend, getAoMStatus } from '@mylife/budget';
import { fetchRecentAoMSnapshots, fetchTransactions, syncCurrentAoMSnapshot } from '../actions';
import { BudgetLineChart } from '../charts';
import { BudgetHero, BudgetMetricGrid, BudgetPage, BudgetPanel, BudgetTable } from '../primitives';
import { todayIso } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetAgeOfMoneyPage() {
  const [snapshots, transactions] = await Promise.all([
    fetchRecentAoMSnapshots(12),
    fetchTransactions({ limit: 800 }),
  ]);
  const computed = calculateAgeOfMoney(
    transactions.map((transaction) => ({
      amount: Math.abs(transaction.amount),
      direction: transaction.direction,
      occurredOn: transaction.occurred_on,
    })),
    todayIso(),
    10,
  );
  const currentAge = snapshots[0]?.age_days ?? computed?.ageDays ?? 0;
  const previousAge = snapshots[1]?.age_days ?? null;
  const trend = calculateAoMTrend(currentAge, previousAge);

  async function syncAction() {
    'use server';

    if (computed) {
      await syncCurrentAoMSnapshot(computed.ageDays, computed.sampleSize);
    }
    redirect('/budget/age-of-money');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={
          <form action={syncAction}>
            <button style={buttonStyle('secondary')} type="submit">
              Save Snapshot
            </button>
          </form>
        }
        description="Age of Money parity using the shared FIFO engine and stored snapshots."
        eyebrow="Age of Money"
        title="Cash Buffer Age"
      />

      <BudgetMetricGrid>
        <BudgetMetricCard label="Current Age" subvalue={getAoMStatus(currentAge)} tone={currentAge >= 30 ? 'money' : currentAge >= 14 ? 'info' : 'danger'} value={`${currentAge} days`} />
        <BudgetMetricCard label="Trend" subvalue={previousAge !== null ? `vs ${previousAge} days` : 'No prior snapshot'} tone={trend.direction === 'up' ? 'accent' : trend.direction === 'down' ? 'danger' : 'info'} value={`${trend.change >= 0 ? '+' : ''}${trend.change} days`} />
        <BudgetMetricCard label="Sample Size" subvalue="Recent outflows used" tone="neutral" value={computed?.sampleSize ?? snapshots[0]?.sample_size ?? 0} />
      </BudgetMetricGrid>

      <BudgetPanel description="Stored AoM snapshots for the last year." title="AoM Timeline">
        <BudgetLineChart
          data={snapshots
            .slice()
            .reverse()
            .map((snapshot) => ({
              label: formatBudgetDate(snapshot.date, { month: 'short' }),
              value: snapshot.age_days,
            }))}
        />
      </BudgetPanel>

      <BudgetPanel description="Recent snapshot records." title="Snapshots">
        <BudgetTable
          columns={['Date', 'Age Days', 'Sample']}
          rows={snapshots.length > 0
            ? snapshots.map((snapshot) => [
                formatBudgetDate(snapshot.date),
                snapshot.age_days,
                snapshot.sample_size,
              ])
            : [['No snapshots yet', '-', '-']]}
        />
      </BudgetPanel>
    </BudgetPage>
  );
}
