'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Seed } from '@mylife/garden';
import { fetchSeeds, doCreateSeed, doUpdateSeedQuantity, doDeleteSeed } from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const DANGER = '#FF453A';
const AMBER = '#F59E0B';

type SortCol = 'name' | 'species' | 'quantity' | 'source' | 'expiryDate';
type SortDir = 'asc' | 'desc';

function monthsUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr + 'T00:00:00');
  return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
}

export default function SeedsPage() {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // New seed form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSpecies, setFormSpecies] = useState('');
  const [formQty, setFormQty] = useState('0');
  const [formSource, setFormSource] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline quantity edit
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState('');

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSeeds()
      .then((s) => {
        if (!cancelled) setSeeds(s as Seed[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load seeds');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  // Summaries
  const totalCount = seeds.length;
  const lowStock = useMemo(() => seeds.filter((s) => s.quantity < 5).length, [seeds]);
  const expiringSoon = useMemo(() => {
    return seeds.filter((s) => {
      if (!s.expiryDate) return false;
      const months = monthsUntil(s.expiryDate);
      return months >= 0 && months <= 3;
    }).length;
  }, [seeds]);

  // Sorted
  const sorted = useMemo(() => {
    const list = [...seeds];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortCol === 'species') cmp = (a.species ?? '').localeCompare(b.species ?? '');
      else if (sortCol === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortCol === 'source') cmp = (a.source ?? '').localeCompare(b.source ?? '');
      else if (sortCol === 'expiryDate') cmp = (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [seeds, sortCol, sortDir]);

  const toggleSort = useCallback((col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }, [sortCol]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await doCreateSeed({
        name: formName.trim(),
        species: formSpecies.trim() || null,
        quantity: parseInt(formQty, 10) || 0,
        source: formSource.trim() || null,
        expiryDate: formExpiry || null,
      });
      setFormName('');
      setFormSpecies('');
      setFormQty('0');
      setFormSource('');
      setFormExpiry('');
      setShowForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [formName, formSpecies, formQty, formSource, formExpiry, refresh]);

  const handleSaveQty = useCallback(async (id: string) => {
    const qty = parseInt(editQtyValue, 10);
    if (isNaN(qty) || qty < 0) return;
    try {
      await doUpdateSeedQuantity(id, qty);
      setEditingQtyId(null);
      refresh();
    } catch {
      /* silent */
    }
  }, [editQtyValue, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this seed from inventory?')) return;
    try {
      await doDeleteSeed(id);
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  function expiryStyle(expiryDate: string | null): { color: string } {
    if (!expiryDate) return { color: TEXT_TER };
    const months = monthsUntil(expiryDate);
    if (months < 0) return { color: DANGER };
    if (months <= 3) return { color: AMBER };
    return { color: TEXT_SEC };
  }

  const sortArrow = (col: SortCol) => {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (seeds.length === 0 && !showForm) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🌰</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>No seeds in inventory</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Track your seed collection with quantities, sources, and expiration dates so you never lose track of what you have on hand.
        </p>
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtn}>+ Add Seed</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Seed Inventory</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ Add Seed</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <SummaryCard label="Total Seeds" value={totalCount} />
        <SummaryCard label="Low Stock" value={lowStock} accent={lowStock > 0 ? AMBER : undefined} />
        <SummaryCard label="Expiring Soon" value={expiringSoon} accent={expiringSoon > 0 ? DANGER : undefined} />
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Name</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Basil" style={inputStyle} autoFocus />
          </div>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Species</label>
            <input value={formSpecies} onChange={(e) => setFormSpecies(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 80 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Qty</label>
            <input type="number" value={formQty} onChange={(e) => setFormQty(e.target.value)} min={0} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Source</label>
            <input value={formSource} onChange={(e) => setFormSource(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Expires</label>
            <input type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} style={inputStyle} />
          </div>
          <button type="button" onClick={handleCreate} disabled={submitting} style={primaryBtn}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {([['name', 'Name'], ['species', 'Species'], ['quantity', 'Qty'], ['source', 'Source'], ['expiryDate', 'Expires']] as [SortCol, string][]).map(([col, label]) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  style={{
                    textAlign: 'left', padding: '10px 14px', color: TEXT_SEC, fontWeight: 600,
                    fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8,
                    borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {label}{sortArrow(col)}
                </th>
              ))}
              <th style={{
                textAlign: 'right', padding: '10px 14px', color: TEXT_SEC, fontWeight: 600,
                fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8,
                borderBottom: `1px solid ${BORDER}`,
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '10px 14px', color: TEXT, fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '10px 14px', color: TEXT_SEC }}>{s.species || '-'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {editingQtyId === s.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        value={editQtyValue}
                        onChange={(e) => setEditQtyValue(e.target.value)}
                        min={0}
                        style={{ ...inputStyle, width: 60, padding: '4px 8px', fontSize: 13 }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveQty(s.id);
                          if (e.key === 'Escape') setEditingQtyId(null);
                        }}
                      />
                      <button type="button" onClick={() => handleSaveQty(s.id)} style={{ ...smallBtn, padding: '4px 8px' }}>Save</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { setEditingQtyId(s.id); setEditQtyValue(String(s.quantity)); }}
                      style={{
                        cursor: 'pointer', fontWeight: 600,
                        color: s.quantity < 5 ? AMBER : TEXT,
                        borderBottom: '1px dashed rgba(255,255,255,0.2)',
                      }}
                      title="Click to edit"
                    >
                      {s.quantity}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 14px', color: TEXT_SEC }}>{s.source || '-'}</td>
                <td style={{ padding: '10px 14px', ...expiryStyle(s.expiryDate), fontWeight: 500 }}>
                  {s.expiryDate || '-'}
                  {s.expiryDate && monthsUntil(s.expiryDate) < 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: DANGER }}>EXPIRED</span>
                  )}
                  {s.expiryDate && monthsUntil(s.expiryDate) >= 0 && monthsUntil(s.expiryDate) <= 3 && (
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: AMBER }}>SOON</span>
                  )}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    style={{ ...ghostBtn, fontSize: 12, padding: '4px 10px', color: DANGER, borderColor: 'rgba(255,69,58,0.2)' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: accent || ACCENT }}>{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...skel, width: 160, height: 32 }} />
        <div style={{ ...skel, width: 120, height: 38 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 80 }} />)}
      </div>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ ...skel, height: 48 }} />)}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 40 }}>
      <p style={{ fontSize: 18, color: TEXT, margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: 14, color: TEXT_SEC, margin: '8px 0 0' }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ ...ghostBtn, marginTop: 16 }}>Retry</button>
    </div>
  );
}

const card: CSSProperties = { padding: 20, borderRadius: 20, backgroundColor: GLASS, border: `1px solid ${BORDER}` };
const primaryBtn: CSSProperties = { borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14 };
const smallBtn: CSSProperties = { borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', padding: '6px 12px', fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 12 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };
