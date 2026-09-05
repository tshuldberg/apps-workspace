import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { calculateAvalanche, calculateSnowball, generateAmortizationSchedule, projectPayoffDate } from '@mylife/budget';
import {
  addDebtPayoffDebt,
  editDebtPayoffPlan,
  fetchDebtPayoffPlanById,
  fetchDebtsByPlan,
} from '../../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetSelect,
  BudgetTable,
  BudgetTonePill,
} from '../../primitives';
import { debtToEngine, parseCurrencyField, parseNumberField, stringField } from '../../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate } from '../../ui';

export const dynamic = 'force-dynamic';

type DetailSearchParams = Promise<{ debt?: string | string[]; extra?: string | string[] }>;

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BudgetDebtDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: DetailSearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const planRecord = await fetchDebtPayoffPlanById(id);

  if (!planRecord) {
    notFound();
  }
  const plan = planRecord;

  const debts = await fetchDebtsByPlan(plan.id);
  const selectedDebt = debts.find((debt) => debt.id === single(query.debt)) ?? debts[0] ?? null;
  const modeledExtra = Number(single(query.extra) ?? plan.extra_payment / 100);
  const modeledExtraCents = Math.max(0, Math.round(modeledExtra * 100));
  const payoffResult = plan.strategy === 'snowball'
    ? calculateSnowball(debts.map(debtToEngine), modeledExtraCents)
    : calculateAvalanche(debts.map(debtToEngine), modeledExtraCents);
  const amortization = selectedDebt
    ? generateAmortizationSchedule(
        selectedDebt.balance,
        selectedDebt.minimum_payment + modeledExtraCents,
        selectedDebt.interest_rate,
      ).slice(0, 18)
    : [];
  const payoffProjection = selectedDebt
    ? projectPayoffDate(
        selectedDebt.balance,
        selectedDebt.minimum_payment + modeledExtraCents,
        selectedDebt.interest_rate,
      )
    : null;

  async function addDebtAction(formData: FormData) {
    'use server';

    await addDebtPayoffDebt({
      balance: parseCurrencyField(formData, 'balance'),
      compounding: stringField(formData, 'compounding') as 'daily' | 'monthly',
      interest_rate: Math.round(parseNumberField(formData, 'interest_rate') * 100),
      minimum_payment: parseCurrencyField(formData, 'minimum_payment'),
      name: stringField(formData, 'name'),
      plan_id: plan.id,
    });
    redirect(`/budget/debt-payoff/${plan.id}`);
  }

  async function savePlanAction(formData: FormData) {
    'use server';

    await editDebtPayoffPlan(plan.id, {
      extra_payment: parseCurrencyField(formData, 'extra_payment'),
      strategy: stringField(formData, 'strategy') as 'avalanche' | 'snowball',
    });
    redirect(`/budget/debt-payoff/${plan.id}`);
  }

  return (
    <BudgetPage maxWidth={1280}>
      <BudgetHero
        actions={<Link href="/budget/debt-payoff" style={buttonStyle('ghost')}>All Plans</Link>}
        description="Debt-level desktop detail with amortization rows and extra-payment modeling."
        eyebrow="Debt Detail"
        title={plan.name}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Strategy" subvalue={`${debts.length} debts in plan`} tone={plan.strategy === 'snowball' ? 'accent' : 'info'} value={plan.strategy} />
          <BudgetMetricCard label="Extra Payment" subvalue="Current saved plan value" tone="money" value={formatBudgetCurrency(plan.extra_payment)} />
          <BudgetMetricCard label="Modeled Payoff" subvalue="Using slider scenario" tone="danger" value={`${payoffResult.totalMonths} mo`} />
          <BudgetMetricCard label="Projected Interest" subvalue="Selected payoff strategy" tone="danger" value={formatBudgetCurrency(payoffResult.totalInterest)} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Choose a debt to inspect its amortization path." title="Debt List">
              {debts.map((debt) => (
                <div
                  key={debt.id}
                  style={{
                    alignItems: 'center',
                    border: debt.id === selectedDebt?.id ? '1px solid rgba(201,137,77,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'space-between',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Link href={`/budget/debt-payoff/${plan.id}?debt=${debt.id}&extra=${modeledExtra}`} style={{ color: 'inherit', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>
                      {debt.name}
                    </Link>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <BudgetTonePill tone="danger">{formatBudgetCurrency(debt.balance)}</BudgetTonePill>
                      <BudgetTonePill tone="neutral">{(debt.interest_rate / 100).toFixed(2)}% APR</BudgetTonePill>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    Min {formatBudgetCurrency(debt.minimum_payment)}
                  </div>
                </div>
              ))}
            </BudgetPanel>

            <BudgetPanel
              description={selectedDebt ? `Amortization preview for ${selectedDebt.name}.` : 'Add a debt to inspect the schedule.'}
              title="Amortization"
            >
              <BudgetTable
                columns={['Month', 'Payment', 'Principal', 'Interest', 'Balance']}
                rows={amortization.length > 0
                  ? amortization.map((entry) => [
                      entry.month,
                      formatBudgetCurrency(entry.payment),
                      formatBudgetCurrency(entry.principal),
                      formatBudgetCurrency(entry.interest),
                      formatBudgetCurrency(entry.balance),
                    ])
                  : [['No debt selected', '-', '-', '-', '-']]}
              />
              {payoffProjection ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Payoff date {formatBudgetDate(payoffProjection.date)} with {payoffProjection.months} months remaining.
                </div>
              ) : null}
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={savePlanAction} description="Adjust the plan strategy and committed extra payment." title="Plan Settings">
              <BudgetFormGrid>
                <BudgetField label="Strategy">
                  <BudgetSelect defaultValue={plan.strategy} name="strategy">
                    <option value="avalanche">Avalanche</option>
                    <option value="snowball">Snowball</option>
                  </BudgetSelect>
                </BudgetField>
                <BudgetField label="Extra Payment">
                  <BudgetInput defaultValue={String(plan.extra_payment / 100)} min="0" name="extra_payment" step="0.01" type="number" />
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('secondary')} type="submit">
                Update Plan
              </button>
            </BudgetForm>

            <BudgetPanel description="Desktop version of the extra-payment slider scenario." title="Scenario Slider">
              <form action={`/budget/debt-payoff/${plan.id}`} method="get" style={{ display: 'grid', gap: 14 }}>
                {selectedDebt ? <input name="debt" type="hidden" value={selectedDebt.id} /> : null}
                <input defaultValue={modeledExtra} max="5000" min="0" name="extra" step="25" type="range" />
                <strong>{formatBudgetCurrency(modeledExtraCents)} extra per month</strong>
                <button style={buttonStyle('ghost')} type="submit">
                  Recalculate
                </button>
              </form>
            </BudgetPanel>

            <BudgetForm action={addDebtAction} description="Add another debt to the payoff plan." title="Add Debt">
              <BudgetFormGrid>
                <BudgetField label="Debt Name">
                  <BudgetInput name="name" placeholder="Visa Platinum" required />
                </BudgetField>
                <BudgetField label="Balance">
                  <BudgetInput min="0" name="balance" required step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Interest Rate">
                  <BudgetInput min="0" name="interest_rate" placeholder="19.99" required step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Minimum Payment">
                  <BudgetInput min="0" name="minimum_payment" required step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Compounding">
                  <BudgetSelect defaultValue="monthly" name="compounding">
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                  </BudgetSelect>
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('primary')} type="submit">
                Add Debt
              </button>
            </BudgetForm>
          </>
        }
      />
    </BudgetPage>
  );
}
