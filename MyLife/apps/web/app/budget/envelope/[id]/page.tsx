import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { editEnvelope, fetchEnvelopeById, fetchGoals, fetchTransactions } from '../../actions';
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
import { parseCurrencyField, stringField } from '../../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate } from '../../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetEnvelopeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const envelopeRecord = await fetchEnvelopeById(id);

  if (!envelopeRecord) {
    notFound();
  }
  const envelope = envelopeRecord;

  const [goals, transactions] = await Promise.all([
    fetchGoals(),
    fetchTransactions({ envelope_id: envelope.id, limit: 200 }),
  ]);
  const linkedGoal = goals.find((goal) => goal.envelope_id === envelope.id) ?? null;
  const spentThisMonth = transactions
    .filter((transaction) => transaction.direction === 'outflow' && transaction.occurred_on.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const remaining = envelope.monthly_budget - spentThisMonth;

  async function updateEnvelopeAction(formData: FormData) {
    'use server';

    await editEnvelope(envelope.id, {
      name: stringField(formData, 'name'),
      monthly_budget: parseCurrencyField(formData, 'monthly_budget'),
    });
    redirect(`/budget/envelope/${envelope.id}`);
  }

  return (
    <BudgetPage maxWidth={1280}>
      <BudgetHero
        actions={<Link href="/budget" style={buttonStyle('ghost')}>Back to Budget</Link>}
        description="Envelope detail adapted for desktop with linked goal visibility and recent transaction context."
        eyebrow="Envelope Detail"
        title={envelope.name}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Budgeted" subvalue="Monthly target" tone="money" value={formatBudgetCurrency(envelope.monthly_budget)} />
          <BudgetMetricCard label="Spent" subvalue="Current month" tone="danger" value={formatBudgetCurrency(spentThisMonth)} />
          <BudgetMetricCard label="Remaining" subvalue={linkedGoal ? `Linked goal ${linkedGoal.name}` : 'No linked goal'} tone={remaining >= 0 ? 'accent' : 'danger'} value={formatBudgetCurrency(remaining, { signed: true })} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Current month spend against the envelope target." title="Progress">
              <BudgetProgressBar max={Math.max(envelope.monthly_budget, 1)} value={spentThisMonth} />
            </BudgetPanel>
            <BudgetPanel description="Recent activity for this envelope." title="Transactions">
              <BudgetTable
                columns={['Date', 'Merchant', 'Amount', 'Open']}
                rows={transactions.length > 0
                  ? transactions.map((transaction) => [
                      formatBudgetDate(transaction.occurred_on),
                      transaction.merchant ?? 'Missing merchant',
                      formatBudgetCurrency(transaction.amount),
                      <Link key={transaction.id} href={`/budget/transaction/${transaction.id}`} style={{ color: 'inherit' }}>
                        Detail
                      </Link>,
                    ])
                  : [['No envelope transactions', '-', '-', '-']]}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <BudgetForm action={updateEnvelopeAction} title="Edit Envelope">
            <BudgetFormGrid>
              <BudgetField label="Name">
                <BudgetInput defaultValue={envelope.name} name="name" required />
              </BudgetField>
              <BudgetField label="Monthly Budget">
                <BudgetInput defaultValue={String(envelope.monthly_budget / 100)} min="0" name="monthly_budget" required step="0.01" type="number" />
              </BudgetField>
            </BudgetFormGrid>
            <button style={buttonStyle('primary')} type="submit">
              Save Envelope
            </button>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
