import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { editTransaction, fetchAccounts, fetchEnvelopes, fetchTransactionById } from '../../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetSelect,
  BudgetTable,
} from '../../primitives';
import { nullableField, parseCurrencyField, stringField } from '../../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate } from '../../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transactionRecord = await fetchTransactionById(id);

  if (!transactionRecord) {
    notFound();
  }
  const transaction = transactionRecord;

  const [accounts, envelopes] = await Promise.all([fetchAccounts(true), fetchEnvelopes(true)]);

  async function updateTransactionAction(formData: FormData) {
    'use server';

    await editTransaction(transaction.id, {
      account_id: nullableField(formData, 'account_id'),
      amount: parseCurrencyField(formData, 'amount'),
      direction: stringField(formData, 'direction') as 'inflow' | 'outflow' | 'transfer',
      envelope_id: nullableField(formData, 'envelope_id'),
      merchant: nullableField(formData, 'merchant'),
      note: nullableField(formData, 'note'),
      occurred_on: stringField(formData, 'occurred_on'),
    });
    redirect(`/budget/transaction/${transaction.id}`);
  }

  return (
    <BudgetPage maxWidth={1024}>
      <BudgetHero
        actions={<Link href="/budget/transactions" style={buttonStyle('ghost')}>All Transactions</Link>}
        description="Desktop transaction detail for merchant, envelope, and account cleanup."
        eyebrow="Transaction Detail"
        title={transaction.merchant ?? 'Transaction'}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Amount" subvalue={transaction.direction} tone={transaction.direction === 'inflow' ? 'money' : transaction.direction === 'transfer' ? 'info' : 'danger'} value={formatBudgetCurrency(transaction.amount)} />
          <BudgetMetricCard label="Date" subvalue="Occurred on" tone="accent" value={formatBudgetDate(transaction.occurred_on)} />
          <BudgetMetricCard label="Envelope" subvalue="Assigned category" tone="info" value={envelopes.find((envelope) => envelope.id === transaction.envelope_id)?.name ?? 'None'} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <BudgetTable
            columns={['Field', 'Value']}
            rows={[
              ['Merchant', transaction.merchant ?? 'None'],
              ['Note', transaction.note ?? 'None'],
              ['Account', accounts.find((account) => account.id === transaction.account_id)?.name ?? 'None'],
              ['Envelope', envelopes.find((envelope) => envelope.id === transaction.envelope_id)?.name ?? 'None'],
            ]}
          />
        }
        secondary={
          <BudgetForm action={updateTransactionAction} title="Edit Transaction">
            <BudgetFormGrid>
              <BudgetField label="Merchant">
                <BudgetInput defaultValue={transaction.merchant ?? ''} name="merchant" />
              </BudgetField>
              <BudgetField label="Amount">
                <BudgetInput defaultValue={String(transaction.amount / 100)} name="amount" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Direction">
                <BudgetSelect defaultValue={transaction.direction} name="direction">
                  <option value="outflow">outflow</option>
                  <option value="inflow">inflow</option>
                  <option value="transfer">transfer</option>
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Occurred On">
                <BudgetInput defaultValue={transaction.occurred_on} name="occurred_on" type="date" />
              </BudgetField>
              <BudgetField label="Account">
                <BudgetSelect defaultValue={transaction.account_id ?? ''} name="account_id">
                  <option value="">None</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Envelope">
                <BudgetSelect defaultValue={transaction.envelope_id ?? ''} name="envelope_id">
                  <option value="">None</option>
                  {envelopes.map((envelope) => (
                    <option key={envelope.id} value={envelope.id}>
                      {envelope.name}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
            </BudgetFormGrid>
            <BudgetField label="Note">
              <BudgetInput defaultValue={transaction.note ?? ''} name="note" />
            </BudgetField>
            <button style={buttonStyle('primary')} type="submit">
              Save Transaction
            </button>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
