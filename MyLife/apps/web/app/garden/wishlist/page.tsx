'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { WishListItem } from '@mylife/garden';
import {
  fetchWishList, doCreateWishListItem, doMarkWishListAcquired, doDeleteWishListItem,
} from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const DANGER = '#FF453A';

const PRIORITY_COLORS: Record<string, string> = {
  high: DANGER,
  medium: '#F59E0B',
  low: ACCENT,
};


export default function WishlistPage() {
  const [items, setItems] = useState<WishListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showAcquired, setShowAcquired] = useState(false);

  // New item form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSpecies, setFormSpecies] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formPriority, setFormPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWishList(showAcquired)
      .then((list) => {
        if (!cancelled) setItems(list as WishListItem[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load wish list');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick, showAcquired]);

  const grouped = useMemo(() => {
    const groups: Record<string, WishListItem[]> = { high: [], medium: [], low: [] };
    for (const item of items) {
      const bucket = groups[item.priority] ?? groups.medium;
      bucket.push(item);
    }
    return groups;
  }, [items]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await doCreateWishListItem({
        name: formName.trim(),
        species: formSpecies.trim() || undefined,
        source: formSource.trim() || undefined,
        estimatedPrice: formPrice ? parseFloat(formPrice) : undefined,
        priority: formPriority,
        notes: formNotes.trim() || undefined,
      });
      setFormName('');
      setFormSpecies('');
      setFormSource('');
      setFormPrice('');
      setFormPriority('medium');
      setFormNotes('');
      setShowForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [formName, formSpecies, formSource, formPrice, formPriority, formNotes, refresh]);

  const handleAcquire = useCallback(async (id: string) => {
    try {
      await doMarkWishListAcquired(id);
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Remove this item from your wish list?')) return;
    try {
      await doDeleteWishListItem(id);
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (items.length === 0 && !showForm && !showAcquired) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🌱</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Wish list is empty</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Keep track of plants you want to add to your garden. Save names, sources, estimated prices, and prioritize your next additions.
        </p>
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtn}>+ Add to List</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Wish List</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: TEXT_SEC }}>
            <input
              type="checkbox"
              checked={showAcquired}
              onChange={(e) => setShowAcquired(e.target.checked)}
              style={{ accentColor: ACCENT }}
            />
            Show Acquired
          </label>
          <button type="button" onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ Add to List</button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Monstera Deliciosa"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Species</label>
              <input
                value={formSpecies}
                onChange={(e) => setFormSpecies(e.target.value)}
                placeholder="Optional"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Source</label>
              <input
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                placeholder="e.g. Local nursery"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'grid', gap: 4, minWidth: 100 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Est. Price ($)</label>
              <input
                type="number"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.01}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gap: 4, minWidth: 120 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as 'high' | 'medium' | 'low')}
                style={inputStyle}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div style={{ display: 'grid', gap: 4, flex: 2, minWidth: 160 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Notes</label>
              <input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleCreate} disabled={submitting || !formName.trim()} style={primaryBtn}>
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Grouped by priority */}
      {(['high', 'medium', 'low'] as const).map((priority) => {
        const group = grouped[priority];
        if (!group || group.length === 0) return null;
        return (
          <div key={priority} style={{ display: 'grid', gap: 8 }}>
            <h3 style={{
              margin: 0, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
              color: PRIORITY_COLORS[priority],
            }}>
              {priority.toUpperCase()} Priority ({group.length})
            </h3>
            {group.map((item) => (
              <div key={item.id} style={{
                ...card,
                display: 'flex', gap: 16, alignItems: 'center', padding: '14px 20px',
                opacity: item.acquired ? 0.5 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
                      {item.name}
                    </span>
                    {item.species && (
                      <span style={{ fontSize: 13, color: TEXT_TER, fontStyle: 'italic' }}>{item.species}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12, color: TEXT_SEC }}>
                    {item.source && <span>Source: {item.source}</span>}
                    {item.estimatedPrice != null && (
                      <span style={{ color: ACCENT, fontWeight: 600 }}>
                        ${item.estimatedPrice.toFixed(2)}
                      </span>
                    )}
                    <span>Added {item.addedDate}</span>
                  </div>
                  {item.notes && (
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_TER }}>{item.notes}</p>
                  )}
                  {item.acquired && item.acquiredDate && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: ACCENT }}>
                      Acquired {item.acquiredDate}
                    </p>
                  )}
                </div>
                {!item.acquired && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => handleAcquire(item.id)} style={smallBtn}>
                      Mark Acquired
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      style={{ ...smallBtn, backgroundColor: 'transparent', color: DANGER, border: `1px solid rgba(255,69,58,0.2)` }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {items.length === 0 && showAcquired && (
        <p style={{ textAlign: 'center', color: TEXT_TER, padding: 32 }}>
          No acquired items yet.
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...skel, width: 140, height: 32 }} />
        <div style={{ ...skel, width: 140, height: 38 }} />
      </div>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ ...skel, height: 72 }} />)}
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
const smallBtn: CSSProperties = { borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', padding: '6px 14px', fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 12 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };
