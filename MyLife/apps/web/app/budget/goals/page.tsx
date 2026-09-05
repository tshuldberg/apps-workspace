import Link from 'next/link';
import { redirect } from 'next/navigation';
import { calculateGoalProgress, suggestMonthlyContribution } from '@mylife/budget';
import { addGoal, editGoal, fetchEnvelopes, fetchGoals } from '../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetMetricGrid,
  BudgetPage,
  BudgetPanel,
  BudgetProgressBar,
  BudgetRow,
  BudgetSelect,
  BudgetSubmitRow,
  BudgetTonePill,
} from '../primitives';
import { goalToEngine, nullableField, parseCurrencyField, stringField } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, relativeBudgetDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetGoalsPage() {
  const [goals, envelopes] = await Promise.all([fetchGoals(), fetchEnvelopes(true)]);
  const envelopeMap = new Map(envelopes.map((envelope) => [envelope.id, envelope]));
  const progressRows = goals.map((goal) => ({
    goal,
    progress: calculateGoalProgress(goalToEngine(goal)),
    suggested: suggestMonthlyContribution(goalToEngine(goal)),
  }));
  const completed = progressRows.filter((row) => row.goal.is_completed === 1).length;
  const totalSaved = goals.reduce((sum, goal) => sum + goal.completed_amount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);

  async function createGoalAction(formData: FormData) {
    'use server';

    await addGoal({
      completed_amount: parseCurrencyField(formData, 'completed_amount'),
      envelope_id: stringField(formData, 'envelope_id'),
      name: stringField(formData, 'name'),
      target_amount: parseCurrencyField(formData, 'target_amount'),
      target_date: nullableField(formData, 'target_date'),
    });
    redirect('/budget/goals');
  }

  async function toggleGoalAction(formData: FormData) {
    'use server';

    const goalId = stringField(formData, 'goal_id');
    const isCompleted = stringField(formData, 'is_completed') === '1';
    await editGoal(goalId, { is_completed: isCompleted ? 0 : 1 });
    redirect('/budget/goals');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={<Link href="/budget" style={buttonStyle('ghost')}>Mission Control</Link>}
        description="Savings goals mirror the mobile experience with live progress, envelope links, and one-click completion toggles."
        eyebrow="Goals"
        title="Savings Goals"
      />

      <BudgetMetricGrid>
        <BudgetMetricCard label="Goal Count" subvalue={`${completed} completed`} tone="accent" value={goals.length} />
        <BudgetMetricCard label="Saved" subvalue="Across all goals" tone="money" value={formatBudgetCurrency(totalSaved)} />
        <BudgetMetricCard label="Target" subvalue="Total target value" tone="neutral" value={formatBudgetCurrency(totalTarget)} />
        <BudgetMetricCard
          label="Remaining"
          subvalue={goals.length > 0 ? `${Math.round((totalSaved / Math.max(totalTarget, 1)) * 100)}% funded` : 'No goals yet'}
          tone="info"
          value={formatBudgetCurrency(Math.max(totalTarget - totalSaved, 0))}
        />
      </BudgetMetricGrid>

      <BudgetColumns
        primary={
          <BudgetPanel
            description="Open a goal for contribution detail and projections."
            title="Goal Queue"
          >
            {progressRows.length > 0 ? (
              progressRows.map(({ goal, progress, suggested }) => (
                <BudgetRow key={goal.id}>
                  <div
                    style={{
                      alignItems: 'start',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 14,
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 8 }}>
                      <Link href={`/budget/goals/${goal.id}`} style={{ color: 'inherit', fontSize: 18, fontWeight: 800, textDecoration: 'none' }}>
                        {goal.name}
                      </Link>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <BudgetTonePill tone={goal.is_completed === 1 ? 'money' : progress.status === 'behind' || progress.status === 'overdue' ? 'danger' : 'accent'}>
                          {progress.status.replace(/_/g, ' ')}
                        </BudgetTonePill>
                        <BudgetTonePill tone="neutral">
                          {envelopeMap.get(goal.envelope_id)?.name ?? 'Unassigned envelope'}
                        </BudgetTonePill>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <form action={toggleGoalAction}>
                        <input name="goal_id" type="hidden" value={goal.id} />
                        <input name="is_completed" type="hidden" value={String(goal.is_completed)} />
                        <button style={buttonStyle(goal.is_completed === 1 ? 'ghost' : 'secondary')} type="submit">
                          {goal.is_completed === 1 ? 'Reopen' : 'Complete'}
                        </button>
                      </form>
                      <Link href={`/budget/goals/${goal.id}`} style={buttonStyle('ghost')}>
                        Detail
                      </Link>
                    </div>
                  </div>
                  <BudgetProgressBar color={goal.is_completed === 1 ? '#30D158' : undefined} max={goal.target_amount || 1} value={goal.completed_amount} />
                  <div
                    style={{
                      display: 'grid',
                      gap: 10,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Saved</div>
                      <strong>{formatBudgetCurrency(goal.completed_amount)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Target</div>
                      <strong>{formatBudgetCurrency(goal.target_amount)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Needed Monthly</div>
                      <strong>{formatBudgetCurrency(suggested)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Target Date</div>
                      <strong>{relativeBudgetDate(goal.target_date)}</strong>
                    </div>
                  </div>
                </BudgetRow>
              ))
            ) : (
              <BudgetRow>
                <strong>No goals yet.</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  Add a savings target to mirror the mobile goal ring experience on desktop.
                </span>
              </BudgetRow>
            )}
          </BudgetPanel>
        }
        secondary={
          <BudgetForm
            action={createGoalAction}
            description="Goal creation stays inside the desktop shell and writes directly through the shared budget server actions."
            title="Add Goal"
          >
            <BudgetFormGrid>
              <BudgetField label="Goal Name">
                <BudgetInput maxLength={80} name="name" placeholder="Emergency fund" required />
              </BudgetField>
              <BudgetField label="Envelope">
                <BudgetSelect defaultValue={envelopes[0]?.id} name="envelope_id" required>
                  {envelopes.map((envelope) => (
                    <option key={envelope.id} value={envelope.id}>
                      {envelope.name}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Target Amount">
                <BudgetInput min="0" name="target_amount" placeholder="1000.00" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Already Saved">
                <BudgetInput defaultValue="0" min="0" name="completed_amount" step="0.01" type="number" />
              </BudgetField>
            </BudgetFormGrid>
            <BudgetField label="Target Date">
              <BudgetInput name="target_date" type="date" />
            </BudgetField>
            <BudgetSubmitRow>
              <button style={buttonStyle('primary')} type="submit">
                Create Goal
              </button>
            </BudgetSubmitRow>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
