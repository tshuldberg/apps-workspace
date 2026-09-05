'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAccountsAction, fetchContactsAction, searchContactsAction,
  toggleContactVipAction, deleteContactAction,
} from '../actions';
import { generateInitials, getAvatarColor, MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, accentDim: ACCENT_DIM, accentBorder: ACCENT_BORDER, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS } = C;

interface Contact {
  id: string; email: string; displayName: string | null; isVip: boolean;
  source: string; frequency: number; company: string | null; accountId: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVip, setFilterVip] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await fetchAccountsAction();
      if (accounts.length === 0) { setContacts([]); return; }
      const acctId = accountId ?? accounts[0].id;
      if (!accountId) setAccountId(acctId);
      let result: Contact[];
      if (searchQuery.trim()) {
        result = await searchContactsAction(acctId, searchQuery.trim()) as Contact[];
      } else {
        result = await fetchContactsAction(acctId) as Contact[];
      }
      if (filterVip) result = result.filter((c) => c.isVip);
      setContacts(result);
    } catch {
      setError('Could not load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountId, searchQuery, filterVip]);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const handleToggleVip = useCallback(async (id: string) => {
    try {
      await toggleContactVipAction(id);
      void loadContacts();
    } catch { /* silent */ }
  }, [loadContacts]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteContactAction(id);
      void loadContacts();
    } catch { /* silent */ }
  }, [loadContacts]);

  const vipCount = contacts.filter((c) => c.isVip).length;

  return (
    <div style={{ padding: '24px 32px', height: '100vh', overflowY: 'auto' }}>
      {/* Hero */}
      <div style={{
        padding: 24, borderRadius: 16, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>Contacts</h1>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} from your conversations
          </p>
        </div>
      </div>

      {/* Search */}
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search contacts by name or email..."
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
          color: TEXT, fontSize: 14, outline: 'none',
        }}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button type="button" onClick={() => setFilterVip(false)} style={{
          padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${!filterVip ? ACCENT_BORDER : BORDER}`,
          backgroundColor: !filterVip ? ACCENT_DIM : GLASS, color: !filterVip ? ACCENT : TEXT_SEC,
        }}>All</button>
        <button type="button" onClick={() => setFilterVip(true)} style={{
          padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${filterVip ? ACCENT_BORDER : BORDER}`,
          backgroundColor: filterVip ? ACCENT_DIM : GLASS, color: filterVip ? ACCENT : TEXT_SEC,
        }}>VIP ({vipCount})</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: GLASS, opacity: 0.6 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ width: '40%', height: 14, borderRadius: 4, backgroundColor: GLASS, opacity: 0.6 }} />
                <div style={{ width: '60%', height: 12, borderRadius: 4, backgroundColor: GLASS, opacity: 0.6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
          <button type="button" onClick={() => void loadContacts()} style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>Retry</button>
        </div>
      ) : contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, borderRadius: 16, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS }}>
          <h3 style={{ margin: 0, fontSize: 18, color: TEXT }}>Your contacts will appear here</h3>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>Contacts are added automatically from your messages</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {contacts.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999, backgroundColor: getAvatarColor(c.email),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {generateInitials(c.displayName ?? c.email)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.displayName ?? c.email.split('@')[0]}
                </div>
                <div style={{ fontSize: 12, color: TEXT_TERT }}>{c.email}</div>
              </div>
              {c.company && <span style={{ fontSize: 12, color: TEXT_TERT }}>{c.company}</span>}
              <span style={{ fontSize: 12, color: TEXT_TERT, minWidth: 30, textAlign: 'right' }}>{c.frequency}x</span>
              <button type="button" onClick={() => void handleToggleVip(c.id)} title={c.isVip ? 'Remove VIP' : 'Mark VIP'} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4,
                color: c.isVip ? '#F59E0B' : TEXT_TERT,
              }}>{c.isVip ? '⭐' : '☆'}</button>
              <button type="button" onClick={() => void handleDelete(c.id)} title="Delete" style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4, color: TEXT_TERT,
              }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
