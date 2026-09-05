'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchEnvelopes,
  fetchTransactions,
  addTransaction,
  removeTransaction,
} from '../actions';

interface Envelope {
  id: string;
  name: string;
  icon: string | null;
}

interface Transaction {
  id: string;
  envelope_id: string | null;
  amount: number;
  direction: 'inflow' | 'outflow' | 'transfer';
  merchant: string | null;
  note: string | null;
  occurred_on: string;
}

const ACCENT = 'var(--accent-budget)';

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
};

function cents(amount: number): string {
  const abs = Math.abs(amount);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<'' | 'inflow' | 'outflow'>('');
  const [filterEnvelopeId, setFilterEnvelopeId] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [amountStr, setAmountStr] = useState('');
  const [direction, setDirection] = useState<'outflow' | 'inflow'>('outflow');
  const [merchant, setMerchant] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [date, setDate] = useState(today());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [envs, txs] = await Promise.all([
        fetchEnvelopes(),
        fetchTransactions({ limit: 500 }),
      ]);
      setEnvelopes(envs as Envelope[]);
      setTransactions(txs as Transaction[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = transactions.filter((tx) => {
    if (filterDirection && tx.direction !== filterDirection) return false;
    if (filterEnvelopeId && tx.envelope_id !== filterEnvelopeId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const m = tx.merchant?.toLowerCase().includes(q);
      const n = tx.note?.toLowerCase().includes(q);
      const e = envelopes.find((env) => env.id === tx.envelope_id)?.name.toLowerCase().includes(q);
      if (!m && !n && !e) return false;
    }
    return true;
  });

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amountStr || '0') * 100);
    if (amountCents <= 0) return;
    await addTransaction({
      amount: amountCents,
      direction,
      merchant: merchant.trim() || null,
      envelope_id: envelopeId || null,
      occurred_on: date,
    });
    setShowAdd(false);
    setAmountStr('');
    setMerchant('');
    setEnvelopeId('');
    setDate(today());
    void load();
  }

  async function handleDelete(id: string) {
    try {
      await removeTransaction(id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction.');
    }
  }

  const inputStyle: CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--glass-border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ ...GLASS_CARD, height: 56, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 32, background: 'var(--glass-strong)' }}>
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>{error}</p>
        <button type="button" onClick={load} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value as '' | 'inflow' | 'outflow')}
          style={{ ...inputStyle, appearance: 'auto' }}
        >
          <option value="">All types</option>
          <option value="outflow">Expenses</option>
          <option value="inflow">Income</option>
        </select>
        <select
          value={filterEnvelopeId}
          onChange={(e) => setFilterEnvelopeId(e.target.value)}
          style={{ ...inputStyle, appearance: 'auto' }}
        >
          <option value="">All envelopes</option>
          {envelopes.map((env) => (
            <option key={env.id} value={env.id}>{env.icon ? `${env.icon} ` : ''}{env.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          style={{
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14,
            whiteSpace: 'nowrap',
          }}
        >
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{ ...GLASS_CARD, background: 'var(--glass-strong)', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['outflow', 'inflow'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: direction === d ? (d === 'outflow' ? 'var(--danger)' : ACCENT) : 'var(--glass)',
                  color: direction === d ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {d === 'outflow' ? 'Expense' : 'Income'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="number" placeholder="Amount" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 100 }} min="0.01" step="0.01" autoFocus />
            <input type="text" placeholder="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 150 }} maxLength={120} />
            <select value={envelopeId} onChange={(e) => setEnvelopeId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 120, appearance: 'auto' }}>
              <option value="">No envelope</option>
              {envelopes.map((env) => (
                <option key={env.id} value={env.id}>{env.icon ? `${env.icon} ` : ''}{env.name}</option>
              ))}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, minWidth: 140 }} />
            <button type="submit" disabled={!(parseFloat(amountStr || '0') > 0)} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Save
            </button>
          </div>
        </form>
      )}

      {/* Transaction list */}
      {filtered.length === 0 ? (
        transactions.length === 0 ? (
          <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 32, borderStyle: 'dashed' }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>📝</p>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>No transactions yet</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 20px', fontSize: 15 }}>
              Record your first purchase or income to start tracking your spending.
            </p>
            <button type="button" onClick={() => setShowAdd(true)} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              + Add Transaction
            </button>
          </div>
        ) : (
          <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No transactions match your filters.</p>
            <button type="button" onClick={() => { setSearchQuery(''); setFilterDirection(''); setFilterEnvelopeId(''); }} style={{ background: 'transparent', color: ACCENT, border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14, marginTop: 8 }}>
              Clear filters
            </button>
          </div>
        )
      ) : (
        filtered.map((tx) => {
          const envName = envelopes.find((e) => e.id === tx.envelope_id)?.name;
          return (
            <div key={tx.id} style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.merchant || tx.note || 'Transaction'}
                </p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 2 }}>
                  {tx.occurred_on}{envName ? ` · ${envName}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: tx.direction === 'inflow' ? ACCENT : 'var(--danger)' }}>
                  {tx.direction === 'inflow' ? '+' : '-'}{cents(tx.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(tx.id)}
                  title="Delete transaction"
                  style={{ background: 'transparent', color: 'var(--text-tertiary)', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px', borderRadius: 4, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })
      )}
      {filtered.length > 0 && (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center' }}>
          Showing {filtered.length} of {transactions.length} transactions
        </p>
      )}
    </div>
  );
}
