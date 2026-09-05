'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchAccountsAction, deleteAccountAction, fetchSyncStatesAction } from '../actions';
import { getAccountColor, getSyncStatusLabel, MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, accentDim: ACCENT_DIM, accentBorder: ACCENT_BORDER, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS } = C;

interface Account {
  id: string; email: string; displayName: string;
  serverHost: string; serverPort: number; isActive: boolean;
}
interface SyncState { folder: string; status: string; lastSyncAt: string | null; errorMessage: string | null }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accts = await fetchAccountsAction();
      setAccounts(accts as Account[]);
      const states: Record<string, SyncState[]> = {};
      for (const a of accts) {
        try {
          states[a.id] = await fetchSyncStatesAction(a.id) as SyncState[];
        } catch {
          states[a.id] = [];
        }
      }
      setSyncStates(states);
    } catch {
      setError('Could not load accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const handleDelete = useCallback(async (id: string) => {
    try { await deleteAccountAction(id); void loadAccounts(); } catch { /* silent */ }
  }, [loadAccounts]);

  return (
    <div style={{ padding: '24px 32px', height: '100vh', overflowY: 'auto' }}>
      <div style={{
        padding: 24, borderRadius: 16, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>Email Accounts</h1>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>{accounts.length} account{accounts.length !== 1 ? 's' : ''} connected</p>
        </div>
        <Link href="/mail/accounts/add" style={{
          padding: '10px 16px', borderRadius: 8, backgroundColor: ACCENT,
          color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>+ Add Account</Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: 100, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, opacity: 0.6 }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
          <button type="button" onClick={() => void loadAccounts()} style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>Retry</button>
        </div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, borderRadius: 16, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
          <h3 style={{ margin: 0, fontSize: 18, color: TEXT }}>Add your first email account</h3>
          <p style={{ margin: '8px 0 16px', color: TEXT_SEC, fontSize: 14 }}>Your email stays on your device. No cloud. No tracking.</p>
          <Link href="/mail/accounts/add" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>+ Add Account</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.map((a, idx) => {
            const color = getAccountColor(idx);
            const states = syncStates[a.id] ?? [];
            return (
              <div key={a.id} style={{
                padding: 20, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: TEXT, flex: 1 }}>{a.email}</span>
                  {idx === 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, fontSize: 11, fontWeight: 600, color: ACCENT }}>Default</span>
                  )}
                  <button type="button" onClick={() => void handleDelete(a.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: TEXT_TERT,
                  }}>🗑️</button>
                </div>
                <div style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 4 }}>Display: {a.displayName}</div>
                <div style={{ fontSize: 13, color: TEXT_TERT }}>Server: {a.serverHost}:{a.serverPort}</div>
                {states.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {states.map((s) => (
                      <span key={s.folder} style={{
                        fontSize: 11, color: s.status === 'error' ? '#FF453A' : s.status === 'syncing' ? ACCENT : TEXT_TERT,
                      }}>
                        {s.folder}: {getSyncStatusLabel(s.status)}
                        {s.lastSyncAt && s.status !== 'error' ? `, ${new Date(s.lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                        {s.errorMessage ? ` (${s.errorMessage})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
