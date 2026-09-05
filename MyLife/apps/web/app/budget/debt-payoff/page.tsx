import Link from 'next/link';
import { redirect } from 'next/navigation';
import { calculateAvalanche, calculateSnowball } from '@mylife/budget';
import { addDebtPayoffPlan, fetchDebtPayoffPlans, fetchDebtsByPlan } from '../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetRow,
  BudgetSelect,
  BudgetSubmitRow,
  BudgetTonePill,
} from '../primitives';
import { debtToEngine, parseCurrencyField, stringField } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetDebtPayoffPage() {
  const plans = await fetchDebtPayoffPlans();
  const debtEntries = await Promise.all(
    plans.map(async (plan) => [plan.id, await fetchDebtsByPlan(plan.id)] as const),
  );
  const debtsByPlan = new Map(debtEntries);
  const totalDebt = debtEntries.reduce(
    (sum, [, debts]) => sum + debts.reduce((inner, debt) => inner + debt.balance, 0),
    0,
  );
  const activePlan = plans.find((plan) => plan.is_active === 1) ?? plans[0] ?? null;
  const activeDebts = activePlan ? debtsByPlan.get(activePlan.id) ?? [] : [];
  const activeResult = activePlan
    ? activePlan.strategy === 'snowball'
      ? calculateSnowball(activeDebts.map(debtToEngine), activePlan.extra_payment)
      : calculateAvalanche(activeDebts.map(debtToEngine), activePlan.extra_payment)
    : null;

  async function createPlanAction(formData: FormData) {
    'use server';

    await addDebtPayoffPlan({
      extra_payment: parseCurrencyField(formData, 'extra_payment'),
      is_active: stringField(formData, 'is_active') === '1' ? 1 : 0,
      name: stringField(formData, 'name'),
      strategy: stringField(formData, 'strategy') as 'avalanche' | 'snowball',
    });
    redirect('/budget/debt-payoff');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={<Link href="/budget/loan-planner" style={buttonStyle('ghost')}>Loan Planner</Link>}
        description="Compare snowball and avalanche payoff plans, then open a plan for amortization detail and debt editing."
        eyebrow="Debt Payoff"
        title="Debt Strategy Hub"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Total Debt" subvalue={`${plans.length} plans`} tone="danger" value={formatBudgetCurrency(totalDebt)} />
          <BudgetMetricCard label="Active Strategy" subvalue={activePlan ? `${activeDebts.length} debts in plan` : 'No active plan'} tone="accent" value={activePlan?.strategy ?? 'None'} />
          <BudgetMetricCard label="Projected Payoff" subvalue={activeResult ? `${activeResult.payoffOrder.length} debts in order` : 'Add debts to model'} tone="info" value={activeResult ? `${activeResult.totalMonths} mo` : 'N/A'} />
          <BudgetMetricCard label="Projected Interest" subvalue="Selected active plan" tone="danger" value={activeResult ? formatBudgetCurrency(activeResult.totalInterest) : formatBudgetCurrency(0)} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <BudgetPanel description="Open a plan for amortization rows, extra-payment modeling, and debt-level edits." title="Payoff Plans">
            {plans.length > 0 ? (
              plans.map((plan) => {
                const debts = debtsByPlan.get(plan.id) ?? [];
                const result = plan.strategy === 'snowball'
                  ? calculateSnowball(debts.map(debtToEngine), plan.extra_payment)
                  : calculateAvalanche(debts.map(debtToEngine), plan.extra_payment);

                return (
                  <BudgetRow key={plan.id}>
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
                        <Link href={`/budget/debt-payoff/${plan.id}`} style={{ color: 'inherit', fontSize: 18, fontWeight: 800, textDecoration: 'none' }}>
                          {plan.name}
                        </Link>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <BudgetTonePill tone={plan.strategy === 'snowball' ? 'accent' : 'info'}>
                            {plan.strategy}
                          </BudgetTonePill>
                          {plan.is_active === 1 ? <BudgetTonePill tone="money">active</BudgetTonePill> : null}
                        </div>
                      </div>
                      <Link href={`/budget/debt-payoff/${plan.id}`} style={buttonStyle('secondary')}>
                        View Plan
                      </Link>
                    </div>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Total Balance</div>
                        <strong>{formatBudgetCurrency(debts.reduce((sum, debt) => sum + debt.balance, 0))}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Extra Payment</div>
                        <strong>{formatBudgetCurrency(plan.extra_payment)}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Projected Months</div>
                        <strong>{result.totalMonths}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Projected Interest</div>
                        <strong>{formatBudgetCurrency(result.totalInterest)}</strong>
                      </div>
                    </div>
                  </BudgetRow>
                );
              })
            ) : (
              <BudgetRow>
                <strong>No payoff plans yet.</strong>
              </BudgetRow>
            )}
          </BudgetPanel>
        }
        secondary={
          <BudgetForm
            action={createPlanAction}
            description="Desktop parity entry point for new debt payoff plans."
            title="Create Plan"
          >
            <BudgetFormGrid>
              <BudgetField label="Plan Name">
                <BudgetInput name="name" placeholder="Avalanche Sprint" required />
              </BudgetField>
              <BudgetField label="Strategy">
                <BudgetSelect defaultValue="avalanche" name="strategy">
                  <option value="avalanche">Avalanche</option>
                  <option value="snowball">Snowball</option>
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Extra Payment">
                <BudgetInput defaultValue="0" min="0" name="extra_payment" step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Make Active">
                <BudgetSelect defaultValue="1" name="is_active">
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </BudgetSelect>
              </BudgetField>
            </BudgetFormGrid>
            <BudgetSubmitRow>
              <button style={buttonStyle('primary')} type="submit">
                Create Plan
              </button>
            </BudgetSubmitRow>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
