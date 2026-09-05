import { fetchAccounts, fetchEnvelopes } from '../../actions';
import { NewTransactionClient } from './NewTransactionClient';

export const dynamic = 'force-dynamic';

export default async function NewBudgetTransactionPage() {
  const [accounts, envelopes] = await Promise.all([
    fetchAccounts(true),
    fetchEnvelopes(true),
  ]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#131318',
        color: '#E4E1E9',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              margin: '0 0 6px 0',
              color: '#E4E1E9',
            }}
          >
            New transaction
          </h1>
          <p style={{ color: '#D6C3B5', fontSize: 14, margin: 0 }}>
            Phase 5-core POC. Attach a receipt photo to preview the
            receipt-to-budget automation.
          </p>
        </header>
        <NewTransactionClient
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          envelopes={envelopes.map((e) => ({ id: e.id, name: e.name }))}
        />
      </div>
    </main>
  );
}
