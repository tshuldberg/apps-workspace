'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchAccounts,
  addAccount,
  editAccount,
  removeAccount,
} from '../actions';

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'mortgage' | 'other';
  current_balance: number; // cents
  currency: string;
  archived: number;
}

const ACCENT = 'var(--accent-budget)';

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
};

const ACCOUNT_ICONS: Record<string, string> = {
  checking: '🏦',
  savings: '🐖',
  credit: '💳',
  cash: '💵',
  investment: '📈',
  loan: '🏷️',
  mortgage: '🏠',
  other: '📊',
};

function cents(amount: number): string {
  const abs = Math.abs(amount);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('checking');
  const [balanceStr, setBalanceStr] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBalanceStr, setEditBalanceStr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accts = await fetchAccounts(true);
      setAccounts(accts as Account[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!name.trim()) return;
    const balanceCents = Math.round(parseFloat(balanceStr || '0') * 100);
    await addAccount({ name: name.trim(), type, current_balance: balanceCents });
    setShowAdd(false);
    setName('');
    setBalanceStr('');
    setType('checking');
    void load();
  }

  async function handleEdit(id: string, e: { preventDefault(): void }) {
    e.preventDefault();
    if (!editName.trim()) return;
    const balanceCents = Math.round(parseFloat(editBalanceStr || '0') * 100);
    try {
      await editAccount(id, { name: editName.trim(), current_balance: balanceCents });
      setEditingId(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account.');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this account? This action cannot be undone.')) return;
    try {
      await removeAccount(id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account.');
    }
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditName(account.name);
    setEditBalanceStr(String(account.current_balance / 100));
  }

  const inputStyle: CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--glass-border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  };

  const totalBalance = accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + (a.type === 'credit' ? -a.current_balance : a.current_balance), 0);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...GLASS_CARD, height: 72, animation: 'pulse 1.5s ease-in-out infinite' }} />
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
      {/* Net worth card */}
      <div style={{ ...GLASS_CARD, padding: 24 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
          Net Balance
        </p>
        <p style={{ fontSize: 36, fontWeight: 700, color: totalBalance >= 0 ? ACCENT : 'var(--danger)' }}>
          {cents(totalBalance)}
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
          Across {accounts.filter((a) => !a.archived).length} accounts
        </p>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Accounts</h2>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          style={{
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '8px 16px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {showAdd ? 'Cancel' : '+ Add Account'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{ ...GLASS_CARD, background: 'var(--glass-strong)', display: 'grid', gap: 10 }}>
          <input type="text" placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus maxLength={80} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={type} onChange={(e) => setType(e.target.value as Account['type'])} style={{ ...inputStyle, flex: 1, appearance: 'auto' }}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
              <option value="loan">Loan</option>
              <option value="mortgage">Mortgage</option>
              <option value="other">Other</option>
            </select>
            <input type="number" placeholder="Balance" value={balanceStr} onChange={(e) => setBalanceStr(e.target.value)} style={{ ...inputStyle, flex: 1 }} step="0.01" />
            <button type="submit" disabled={!name.trim()} style={{ background: name.trim() ? ACCENT : 'var(--border)', color: name.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default', fontSize: 14 }}>
              Create
            </button>
          </div>
        </form>
      )}

      {/* Account list */}
      {accounts.length === 0 && !showAdd ? (
        <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 32, borderStyle: 'dashed' }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>🏦</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>No accounts yet</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 20px', fontSize: 15 }}>
            Add your checking, savings, or credit card accounts to track balances.
          </p>
          <button type="button" onClick={() => setShowAdd(true)} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            + Add Account
          </button>
        </div>
      ) : (
        accounts.map((account) => (
          <div key={account.id} style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', opacity: account.archived ? 0.5 : 1 }}>
            {editingId === account.id ? (
              <form onSubmit={(e) => void handleEdit(account.id, e)} style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }} autoFocus maxLength={80} />
                <input type="number" value={editBalanceStr} onChange={(e) => setEditBalanceStr(e.target.value)} style={{ ...inputStyle, maxWidth: 120 }} step="0.01" placeholder="Balance" />
                <button type="submit" style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Save</button>
                <button type="button" onClick={() => setEditingId(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 28 }}>{ACCOUNT_ICONS[account.type] ?? '📊'}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{account.name}</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                      {account.type}{account.archived ? ' · Archived' : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: account.current_balance >= 0 ? 'var(--text)' : 'var(--danger)' }}>
                    {cents(account.current_balance)}
                  </span>
                  <button type="button" onClick={() => startEdit(account)} style={{ background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleDelete(account.id)} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 6, padding: '6px 10px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
