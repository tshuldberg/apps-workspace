'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchProperties, fetchCostEntriesForProperty,
  doCreateCostEntry, doDeleteCostEntry,
} from '../actions';
import { getCostSummary, getMonthlyCostTrend, getLifetimeCosts } from '@mylife/homes';
import type { Property, CostEntry, CostCategory } from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};
const CAT_COLORS = ['var(--accent-homes)', 'var(--success)', '#3B82F6', '#A855F7', 'var(--danger)'];
const CATEGORIES: CostCategory[] = ['maintenance', 'repair', 'improvement', 'utility', 'other'];

function cents(amount: number): string {
  return `$${Math.round(Math.abs(amount) / 100).toLocaleString()}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CostsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propFilter, setPropFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPropId, setAddPropId] = useState('');
  const [category, setCategory] = useState<CostCategory>('maintenance');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [vendor, setVendor] = useState('');
  const [costDate, setCostDate] = useState(today());

  const load = useCallback(async () => {
    try {
      setError(null);
      const props = await fetchProperties();
      setProperties(props);
      if (!addPropId && props.length > 0) setAddPropId(props[0].id);
      const all: CostEntry[] = [];
      for (const p of props) {
        const c = await fetchCostEntriesForProperty(p.id);
        all.push(...c);
      }
      all.sort((a, b) => b.costDate.localeCompare(a.costDate));
      setCosts(all);
    } catch {
      setError('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }, [addPropId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!propFilter) return costs;
    return costs.filter((c) => c.propertyId === propFilter);
  }, [costs, propFilter]);

  const summary = getCostSummary(filtered);
  const trend = getMonthlyCostTrend(filtered);
  const lifetime = getLifetimeCosts(filtered);
  const monthlyAvg = trend.length > 0
    ? Math.round(trend.reduce((s, t) => s + t.totalCents, 0) / trend.length)
    : 0;
  const sparkMax = Math.max(...trend.map((x) => x.totalCents), 1);
  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? '';

  const handleAdd = async () => {
    if (!addPropId || !description.trim() || !amountStr) return;
    try {
      await doCreateCostEntry(crypto.randomUUID(), {
        propertyId: addPropId, category, description: description.trim(),
        amountCents: Math.round(parseFloat(amountStr) * 100),
        vendor: vendor.trim() || undefined, costDate,
      });
      setShowAdd(false); setDescription(''); setAmountStr(''); setVendor('');
      setLoading(true); void load();
    } catch { /* */ }
  };

  const handleDelete = async (id: string) => {
    try { await doDeleteCostEntry(id); void load(); } catch { /* */ }
  };

  if (loading) {
    return <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ ...GLASS_CARD, height: 80, opacity: 0.5 }} />)}
      </div>
      {[1, 2, 3].map((i) => <div key={i} style={{ ...GLASS_CARD, height: 48, opacity: 0.5 }} />)}
    </div>;
  }

  if (error) {
    return (
      <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 48 }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Something went wrong</p>
        <button type="button" onClick={() => { setLoading(true); void load(); }} style={{
          background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
        }}>Retry</button>
      </div>
    );
  }

  if (costs.length === 0 && !showAdd) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>💰</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>No expenses logged</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px' }}>
          Start tracking home costs to see spending trends and category breakdowns.
        </p>
        <button type="button" onClick={() => setShowAdd(true)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
        }}>Log Your First Cost</button>
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Cost Tracker</h2>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>{showAdd ? 'Cancel' : '+ Log Cost'}</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>Total Spent</p>
          <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{cents(summary.totalCents)}</p>
        </div>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>Monthly Average</p>
          <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{cents(monthlyAvg)}</p>
        </div>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>Lifetime</p>
          <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{cents(lifetime)}</p>
        </div>
      </div>

      {/* Category breakdown + Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {Object.keys(summary.byCategory).length > 0 && (
          <div style={GLASS_CARD}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)', marginBottom: 8 }}>Categories</p>
            {Object.entries(summary.byCategory).map(([cat, c], i) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14 }}>{cat}</span>
                <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                  {cents(c)} ({Math.round((c / Math.max(summary.totalCents, 1)) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
        {trend.length > 1 && (
          <div style={GLASS_CARD}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)', marginBottom: 8 }}>Monthly Trend</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 80, gap: 4 }}>
              {trend.slice(-6).map((t) => (
                <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '80%', borderRadius: 3,
                    height: Math.max(4, (t.totalCents / sparkMax) * 64),
                    backgroundColor: ACCENT,
                  }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Property filter */}
      {properties.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPropFilter(null)} style={{
            background: !propFilter ? ACCENT : 'var(--glass-strong)',
            color: !propFilter ? 'var(--background)' : 'var(--text-secondary)',
            border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>All Properties</button>
          {properties.map((p) => (
            <button key={p.id} type="button" onClick={() => setPropFilter(p.id)} style={{
              background: propFilter === p.id ? ACCENT : 'var(--glass-strong)',
              color: propFilter === p.id ? 'var(--background)' : 'var(--text-secondary)',
              border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}>{p.name}</button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {properties.length > 0 && (
            <select value={addPropId} onChange={(e) => setAddPropId(e.target.value)} style={inputStyle}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select value={category} onChange={(e) => setCategory(e.target.value as CostCategory)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description *" style={inputStyle} />
          <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)}
            placeholder="Amount ($) *" min="0" step="0.01" style={inputStyle} />
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" style={inputStyle} />
          <input type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} style={inputStyle} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setShowAdd(false)} style={{
              background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
            }}>Cancel</button>
            <button type="button" onClick={() => void handleAdd()} disabled={!description.trim() || !amountStr} style={{
              background: description.trim() && amountStr ? ACCENT : 'var(--border)',
              color: description.trim() && amountStr ? 'var(--background)' : 'var(--text-tertiary)',
              border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Cost table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
          <thead>
            <tr style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Description</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Vendor</th>
              {properties.length > 1 && <th style={{ textAlign: 'left', padding: '8px 12px' }}>Property</th>}
              <th style={{ textAlign: 'right', padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((c) => (
              <tr key={c.id} style={{ background: 'var(--glass)' }}>
                <td style={{ padding: '10px 12px', fontSize: 14, color: 'var(--text-secondary)' }}>{c.costDate.slice(0, 10)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                    {c.category}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.description}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: ACCENT }}>
                  {cents(c.amountCents)}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 14, color: 'var(--text-secondary)' }}>{c.vendor ?? ''}</td>
                {properties.length > 1 && (
                  <td style={{ padding: '10px 12px', fontSize: 14, color: 'var(--text-tertiary)' }}>{propName(c.propertyId)}</td>
                )}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button type="button" onClick={() => void handleDelete(c.id)} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', fontSize: 14,
                  }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 50 && (
        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Showing 50 of {filtered.length} entries
        </p>
      )}
    </div>
  );
}
