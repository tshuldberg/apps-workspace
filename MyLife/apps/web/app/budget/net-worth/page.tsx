import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addMilestone, fetchMilestones, fetchNetWorthSnapshots, syncCurrentNetWorthSnapshot } from '../actions';
import { BudgetLineChart } from '../charts';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetTable,
} from '../primitives';
import { parseAccountBalances, parseCurrencyField, stringField } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate, formatBudgetMonth } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetNetWorthPage() {
  const [milestones, snapshots] = await Promise.all([fetchMilestones(), fetchNetWorthSnapshots()]);
  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;
  const delta = latest && previous ? latest.net_worth - previous.net_worth : 0;

  async function syncSnapshotAction() {
    'use server';

    await syncCurrentNetWorthSnapshot();
    redirect('/budget/net-worth');
  }

  async function addMilestoneAction(formData: FormData) {
    'use server';

    await addMilestone({
      achieved_at: stringField(formData, 'achieved_at'),
      milestone_type: stringField(formData, 'milestone_type') as 'all_time_high' | 'custom' | 'debt_free' | 'first_positive' | 'round_number',
      value: parseCurrencyField(formData, 'value'),
    });
    redirect('/budget/net-worth');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={
          <>
            <form action={syncSnapshotAction}>
              <button style={buttonStyle('secondary')} type="submit">
                Capture Snapshot
              </button>
            </form>
            <Link href="/budget/accounts" style={buttonStyle('ghost')}>
              Accounts
            </Link>
          </>
        }
        description="Desktop net worth timeline with milestone tracking and snapshot capture."
        eyebrow="Net Worth"
        title="Net Worth Dashboard"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Current Net Worth" subvalue={latest ? formatBudgetMonth(latest.month) : 'No snapshots yet'} tone={latest && latest.net_worth >= 0 ? 'money' : 'danger'} value={formatBudgetCurrency(latest?.net_worth ?? 0)} />
          <BudgetMetricCard label="Assets" subvalue="Latest snapshot" tone="accent" value={formatBudgetCurrency(latest?.assets ?? 0)} />
          <BudgetMetricCard label="Liabilities" subvalue="Latest snapshot" tone="danger" value={formatBudgetCurrency(latest?.liabilities ?? 0)} />
          <BudgetMetricCard label="Month Delta" subvalue="Vs previous snapshot" tone={delta >= 0 ? 'info' : 'danger'} value={formatBudgetCurrency(delta, { signed: true })} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Historical snapshot trend." title="Timeline">
              <BudgetLineChart
                data={snapshots
                  .slice()
                  .reverse()
                  .map((snapshot) => ({
                    label: formatBudgetMonth(snapshot.month),
                    value: snapshot.net_worth,
                  }))}
              />
            </BudgetPanel>

            <BudgetPanel description="Latest account balances captured inside the snapshot." title="Snapshot Detail">
              <BudgetTable
                columns={['Account', 'Type', 'Balance']}
                rows={latest
                  ? parseAccountBalances(latest).map((account) => [
                      account.name,
                      account.type,
                      formatBudgetCurrency(account.balance),
                    ])
                  : [['No snapshot yet', '-', '-']]}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={addMilestoneAction} description="Add a milestone marker to the net worth dashboard." title="Add Milestone">
              <BudgetFormGrid>
                <BudgetField label="Milestone Type">
                  <BudgetInput defaultValue="custom" name="milestone_type" required />
                </BudgetField>
                <BudgetField label="Value">
                  <BudgetInput min="0" name="value" required step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Achieved At">
                  <BudgetInput name="achieved_at" required type="date" />
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('primary')} type="submit">
                Save Milestone
              </button>
            </BudgetForm>

            <BudgetPanel description="Manual milestones already stored in the module." title="Milestones">
              <BudgetTable
                columns={['Label', 'Target', 'Created']}
                rows={milestones.length > 0
                  ? milestones.map((milestone) => [
                      milestone.milestone_type,
                      formatBudgetCurrency(milestone.value),
                      formatBudgetDate(milestone.achieved_at),
                    ])
                  : [['No milestones yet', '-', '-']]}
              />
            </BudgetPanel>
          </>
        }
      />
    </BudgetPage>
  );
}
