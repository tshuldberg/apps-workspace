import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { calculateGoalProgress, calculateGoalProjection, suggestMonthlyContribution } from '@mylife/budget';
import { BudgetLineChart } from '../../charts';
import { editGoal, fetchEnvelopeById, fetchGoalById } from '../../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetProgressBar,
  BudgetTable,
} from '../../primitives';
import { goalToEngine, parseCurrencyField, stringField } from '../../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate, relativeBudgetDate } from '../../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetGoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goalRecord = await fetchGoalById(id);

  if (!goalRecord) {
    notFound();
  }
  const goal = goalRecord;

  const envelope = await fetchEnvelopeById(goal.envelope_id);
  const engineGoal = goalToEngine(goal);
  const progress = calculateGoalProgress(engineGoal);
  const monthlyNeeded = suggestMonthlyContribution(engineGoal);
  const createdDate = goal.created_at.slice(0, 10);
  const contributionHistory = [
    { label: formatBudgetDate(createdDate, { month: 'short' }), value: 0 },
    { label: 'Today', value: goal.completed_amount },
    { label: goal.target_date ? formatBudgetDate(goal.target_date, { month: 'short' }) : 'Target', value: goal.target_amount },
  ];
  const averageContribution = (() => {
    const months = Math.max(
      1,
      (new Date().getFullYear() - new Date(goal.created_at).getFullYear()) * 12 +
        (new Date().getMonth() - new Date(goal.created_at).getMonth()) +
        1,
    );
    return Math.round(goal.completed_amount / months);
  })();
  const projection = calculateGoalProjection(engineGoal, averageContribution);

  async function addContributionAction(formData: FormData) {
    'use server';

    const contribution = parseCurrencyField(formData, 'amount');
    await editGoal(goal.id, {
      completed_amount: goal.completed_amount + contribution,
      is_completed: goal.completed_amount + contribution >= goal.target_amount ? 1 : goal.is_completed,
    });
    redirect(`/budget/goals/${goal.id}`);
  }

  async function renameGoalAction(formData: FormData) {
    'use server';

    const targetDate = formData.get('target_date');
    await editGoal(goal.id, {
      name: stringField(formData, 'name'),
      target_date: targetDate ? String(targetDate) : null,
      target_amount: parseCurrencyField(formData, 'target_amount'),
    });
    redirect(`/budget/goals/${goal.id}`);
  }

  return (
    <BudgetPage maxWidth={1280}>
      <BudgetHero
        actions={
          <>
            <Link href="/budget/goals" style={buttonStyle('ghost')}>
              All Goals
            </Link>
            {envelope ? (
              <Link href={`/budget/envelope/${envelope.id}`} style={buttonStyle('secondary')}>
                Open Envelope
              </Link>
            ) : null}
          </>
        }
        description={`Linked envelope: ${envelope?.name ?? 'Missing envelope'}. Desktop detail mirrors the mobile progress view with projected pacing and a contribution action.`}
        eyebrow="Goal Detail"
        title={goal.name}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Saved" subvalue={`${progress.percentComplete}% complete`} tone="money" value={formatBudgetCurrency(goal.completed_amount)} />
          <BudgetMetricCard label="Target" subvalue={goal.target_date ? `Due ${formatBudgetDate(goal.target_date)}` : 'Open-ended'} tone="neutral" value={formatBudgetCurrency(goal.target_amount)} />
          <BudgetMetricCard label="Remaining" subvalue={relativeBudgetDate(goal.target_date)} tone={progress.status === 'behind' || progress.status === 'overdue' ? 'danger' : 'accent'} value={formatBudgetCurrency(progress.remaining)} />
          <BudgetMetricCard label="Monthly Needed" subvalue="Suggested contribution" tone="info" value={formatBudgetCurrency(monthlyNeeded)} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Current savings progress against the goal target." title="Progress">
              <BudgetProgressBar max={goal.target_amount || 1} value={goal.completed_amount} />
              <BudgetTable
                columns={['Metric', 'Value']}
                rows={[
                  ['Status', progress.status.replace(/_/g, ' ')],
                  ['Projected Completion', projection.projectedDate ? formatBudgetDate(projection.projectedDate) : 'No projection yet'],
                  ['Average Contribution', formatBudgetCurrency(averageContribution)],
                  ['Envelope', envelope?.name ?? 'Missing envelope'],
                ]}
              />
            </BudgetPanel>

            <BudgetPanel description="A simple contribution path from creation to target." title="Contribution History">
              <BudgetLineChart data={contributionHistory} />
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={addContributionAction} description="Add a contribution without leaving the detail page." title="Add Contribution">
              <BudgetField label="Amount">
                <BudgetInput min="0" name="amount" placeholder="125.00" required step="0.01" type="number" />
              </BudgetField>
              <button style={buttonStyle('primary')} type="submit">
                Save Contribution
              </button>
            </BudgetForm>

            <BudgetForm action={renameGoalAction} description="Keep the desktop detail route editable." title="Goal Settings">
              <BudgetFormGrid>
                <BudgetField label="Name">
                  <BudgetInput defaultValue={goal.name} name="name" required />
                </BudgetField>
                <BudgetField label="Target Amount">
                  <BudgetInput defaultValue={String(goal.target_amount / 100)} min="0" name="target_amount" required step="0.01" type="number" />
                </BudgetField>
              </BudgetFormGrid>
              <BudgetField label="Target Date">
                <BudgetInput defaultValue={goal.target_date ?? ''} name="target_date" type="date" />
              </BudgetField>
              <button style={buttonStyle('secondary')} type="submit">
                Update Goal
              </button>
            </BudgetForm>
          </>
        }
      />
    </BudgetPage>
  );
}
