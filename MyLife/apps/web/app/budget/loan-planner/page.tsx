import Link from 'next/link';
import { redirect } from 'next/navigation';
import { compareScenarios, generateLoanAmortization, getLoanSummary } from '@mylife/budget';
import { addLoan, fetchActiveLoans } from '../actions';
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
} from '../primitives';
import { parseCurrencyField, parseNumberField, stringField, todayIso } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency } from '../ui';

export const dynamic = 'force-dynamic';

type PlannerSearchParams = Promise<{ extra?: string | string[]; loan?: string | string[] }>;

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BudgetLoanPlannerPage({
  searchParams,
}: {
  searchParams: PlannerSearchParams;
}) {
  const [loans, query] = await Promise.all([fetchActiveLoans(), searchParams]);
  const selectedLoan = loans.find((loan) => loan.id === single(query.loan)) ?? loans[0] ?? null;
  const modeledExtra = Number(single(query.extra) ?? selectedLoan?.extra_payment ?? 0);
  const modeledExtraCents = Math.max(0, Math.round(modeledExtra));
  const summary = selectedLoan
    ? getLoanSummary({
        extraPayment: selectedLoan.extra_payment,
        interestRate: selectedLoan.interest_rate,
        principal: selectedLoan.current_balance,
        termMonths: selectedLoan.term_months,
      })
    : null;
  const comparison = selectedLoan
    ? compareScenarios(
        {
          extraPayment: selectedLoan.extra_payment,
          interestRate: selectedLoan.interest_rate,
          principal: selectedLoan.current_balance,
          termMonths: selectedLoan.term_months,
        },
        {
          extraPayment: modeledExtraCents,
          interestRate: selectedLoan.interest_rate,
          principal: selectedLoan.current_balance,
          termMonths: selectedLoan.term_months,
        },
      )
    : null;
  const amortization = selectedLoan
    ? generateLoanAmortization({
        extraPayment: modeledExtraCents,
        interestRate: selectedLoan.interest_rate,
        principal: selectedLoan.current_balance,
        termMonths: selectedLoan.term_months,
      }).slice(0, 18)
    : [];

  async function addLoanAction(formData: FormData) {
    'use server';

    await addLoan({
      current_balance: parseCurrencyField(formData, 'current_balance'),
      extra_payment: parseCurrencyField(formData, 'extra_payment'),
      interest_rate: Math.round(parseNumberField(formData, 'interest_rate') * 100),
      loan_type: stringField(formData, 'loan_type') as 'auto' | 'mortgage' | 'other' | 'personal' | 'student',
      monthly_payment: parseCurrencyField(formData, 'monthly_payment'),
      name: stringField(formData, 'name'),
      original_principal: parseCurrencyField(formData, 'original_principal'),
      start_date: stringField(formData, 'start_date') || todayIso(),
      term_months: parseNumberField(formData, 'term_months'),
    });
    redirect('/budget/loan-planner');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={<Link href="/budget/debt-payoff" style={buttonStyle('ghost')}>Debt Payoff</Link>}
        description="Loan planner parity with scenario comparison and amortization previews."
        eyebrow="Loan Planner"
        title="Loan Planner"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Loans" subvalue="Active planner inputs" tone="accent" value={loans.length} />
          <BudgetMetricCard label="Selected Loan" subvalue={selectedLoan?.loan_type ?? 'None'} tone="info" value={selectedLoan?.name ?? 'None'} />
          <BudgetMetricCard label="Base Payment" subvalue="Without new scenario" tone="money" value={summary ? formatBudgetCurrency(summary.monthlyPayment) : formatBudgetCurrency(0)} />
          <BudgetMetricCard label="Interest Saved" subvalue="Scenario comparison" tone="danger" value={comparison ? formatBudgetCurrency(comparison.interestSaved) : formatBudgetCurrency(0)} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Pick a loan to model extra payments." title="Loan List">
              <BudgetTable
                columns={['Loan', 'Balance', 'APR', 'Monthly']}
                rows={loans.map((loan) => [
                  <Link key={loan.id} href={`/budget/loan-planner?loan=${loan.id}&extra=${modeledExtraCents}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {loan.name}
                  </Link>,
                  formatBudgetCurrency(loan.current_balance),
                  `${(loan.interest_rate / 100).toFixed(2)}%`,
                  formatBudgetCurrency(loan.monthly_payment),
                ])}
              />
            </BudgetPanel>

            <BudgetPanel description="Scenario comparison for the selected loan." title="Scenario Compare">
              <form action="/budget/loan-planner" method="get" style={{ display: 'grid', gap: 14 }}>
                {selectedLoan ? <input name="loan" type="hidden" value={selectedLoan.id} /> : null}
                <input defaultValue={modeledExtraCents} max="500000" min="0" name="extra" step="2500" type="range" />
                <strong>{formatBudgetCurrency(modeledExtraCents)} extra payment</strong>
                <button style={buttonStyle('ghost')} type="submit">
                  Recalculate
                </button>
              </form>
              {comparison ? (
                <BudgetTable
                  columns={['Metric', 'Original', 'Modeled']}
                  rows={[
                    ['Payoff Months', comparison.original.payoffMonths, comparison.modified.payoffMonths],
                    ['Total Interest', formatBudgetCurrency(comparison.original.totalInterest), formatBudgetCurrency(comparison.modified.totalInterest)],
                    ['Monthly Payment', formatBudgetCurrency(comparison.original.monthlyPayment), formatBudgetCurrency(comparison.modified.monthlyPayment)],
                  ]}
                />
              ) : null}
            </BudgetPanel>

            <BudgetPanel description="Amortization preview for the selected scenario." title="Amortization Schedule">
              <BudgetTable
                columns={['Month', 'Payment', 'Principal', 'Interest', 'Balance']}
                rows={amortization.length > 0
                  ? amortization.map((entry) => [
                      entry.month,
                      formatBudgetCurrency(entry.payment),
                      formatBudgetCurrency(entry.principalPortion + entry.extraPortion),
                      formatBudgetCurrency(entry.interestPortion),
                      formatBudgetCurrency(entry.remainingBalance),
                    ])
                  : [['No loan selected', '-', '-', '-', '-']]}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <BudgetForm action={addLoanAction} description="Add a loan to the planner." title="Add Loan">
            <BudgetFormGrid>
              <BudgetField label="Name">
                <BudgetInput name="name" placeholder="Primary mortgage" required />
              </BudgetField>
              <BudgetField label="Loan Type">
                <BudgetSelect defaultValue="mortgage" name="loan_type">
                  {['mortgage', 'auto', 'student', 'personal', 'other'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Original Principal">
                <BudgetInput min="0" name="original_principal" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Current Balance">
                <BudgetInput min="0" name="current_balance" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Interest Rate">
                <BudgetInput min="0" name="interest_rate" placeholder="6.5" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Term Months">
                <BudgetInput min="1" name="term_months" required type="number" />
              </BudgetField>
              <BudgetField label="Monthly Payment">
                <BudgetInput min="0" name="monthly_payment" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Extra Payment">
                <BudgetInput defaultValue="0" min="0" name="extra_payment" step="0.01" type="number" />
              </BudgetField>
            </BudgetFormGrid>
            <BudgetField label="Start Date">
              <BudgetInput defaultValue={todayIso()} name="start_date" type="date" />
            </BudgetField>
            <button style={buttonStyle('primary')} type="submit">
              Save Loan
            </button>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
