import Link from 'next/link';
import { fetchReviewQueue } from '../actions';
import { BudgetHero, BudgetPage, BudgetPanel, BudgetTable } from '../primitives';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetReviewPage() {
  const queue = await fetchReviewQueue();

  return (
    <BudgetPage>
      <BudgetHero
        actions={<Link href="/budget/transactions" style={buttonStyle('ghost')}>Transactions</Link>}
        description="Transactions missing merchants, notes, or envelope assignment."
        eyebrow="Review"
        title="Review Queue"
      />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <BudgetMetricCard label="Needs Review" subvalue="Current queue size" tone="danger" value={queue.length} />
      </div>

      <BudgetPanel description="Open a transaction detail route to clean up imported or partial rows." title="Pending Transactions">
        <BudgetTable
          columns={['Date', 'Merchant', 'Amount', 'Issues', 'Open']}
          rows={queue.length > 0
            ? queue.map((transaction) => [
                formatBudgetDate(transaction.occurred_on),
                transaction.merchant ?? 'Missing merchant',
                formatBudgetCurrency(transaction.amount),
                [
                  !transaction.envelope_id ? 'no envelope' : null,
                  !transaction.merchant ? 'no merchant' : null,
                  !transaction.note ? 'no note' : null,
                ]
                  .filter(Boolean)
                  .join(', '),
                <Link key={transaction.id} href={`/budget/transaction/${transaction.id}`} style={{ color: 'inherit' }}>
                  Open
                </Link>,
              ])
            : [['Queue empty', '-', '-', '-', '-']]}
        />
      </BudgetPanel>
    </BudgetPage>
  );
}
