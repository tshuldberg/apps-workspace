'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchAccountsAction, fetchFiltersAction, toggleFilterAction, deleteFilterAction } from '../actions';
import { MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, accentDim: ACCENT_DIM, accentBorder: ACCENT_BORDER, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS } = C;

interface Filter {
  id: string; name: string; field: string; pattern: string;
  action: string; actionValue: string | null; isActive: boolean; priority: number;
}

export default function FiltersPage() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFilters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await fetchAccountsAction();
      if (accounts.length === 0) { setFilters([]); return; }
      const f = await fetchFiltersAction(accounts[0].id);
      setFilters(f as Filter[]);
    } catch {
      setError('Could not load filters. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFilters(); }, [loadFilters]);

  const handleToggle = useCallback(async (id: string) => {
    try { await toggleFilterAction(id); void loadFilters(); } catch { /* silent */ }
  }, [loadFilters]);

  const handleDelete = useCallback(async (id: string) => {
    try { await deleteFilterAction(id); void loadFilters(); } catch { /* silent */ }
  }, [loadFilters]);

  return (
    <div style={{ padding: '24px 32px', height: '100vh', overflowY: 'auto' }}>
      <div style={{
        padding: 24, borderRadius: 16, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>Mail Filters</h1>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>Auto-organize incoming messages</p>
        </div>
        <Link href="/mail/filters/edit" style={{
          padding: '10px 16px', borderRadius: 8, backgroundColor: ACCENT,
          color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>+ New Filter</Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 56, borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, opacity: 0.6 }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
          <button type="button" onClick={() => void loadFilters()} style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>Retry</button>
        </div>
      ) : filters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, borderRadius: 16, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS }}>
          <h3 style={{ margin: 0, fontSize: 18, color: TEXT }}>No filters yet</h3>
          <p style={{ margin: '8px 0 16px', color: TEXT_SEC, fontSize: 14 }}>Create a filter to auto-organize your incoming mail</p>
          <Link href="/mail/filters/edit" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>+ Create Filter</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT }}>
            <span style={{ width: 50 }}>Active</span>
            <span style={{ flex: 1 }}>Name</span>
            <span style={{ width: 70 }}>Field</span>
            <span style={{ width: 120 }}>Pattern</span>
            <span style={{ width: 80 }}>Action</span>
            <span style={{ width: 60 }} />
          </div>
          {filters.map((f) => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            }}>
              <div style={{ width: 50 }}>
                <button type="button" onClick={() => void handleToggle(f.id)} style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                  backgroundColor: f.isActive ? ACCENT : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: f.isActive ? 18 : 2,
                    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
                    transition: 'left 0.15s',
                  }} />
                </button>
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: f.isActive ? TEXT : TEXT_TERT }}>{f.name}</span>
              <span style={{ width: 70, fontSize: 12, color: TEXT_SEC }}>{f.field}</span>
              <span style={{ width: 120, fontSize: 12, color: TEXT_SEC, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.pattern}</span>
              <span style={{ width: 80, fontSize: 12, color: TEXT_SEC }}>{f.action}{f.actionValue ? `: ${f.actionValue}` : ''}</span>
              <div style={{ width: 60, display: 'flex', gap: 4 }}>
                <Link href={`/mail/filters/edit?id=${f.id}`} style={{ fontSize: 14, textDecoration: 'none' }}>✏️</Link>
                <button type="button" onClick={() => void handleDelete(f.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: TEXT_TERT,
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
