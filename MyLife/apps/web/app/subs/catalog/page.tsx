'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchAllCatalog,
  fetchCategories,
  searchCatalogAction,
  doCreateSubscription,
} from '../actions';
import { formatCurrency, formatCycleShort } from '../ui';
import type { CatalogEntry, Category, CreateSubscriptionInput, BillingCycle } from '@mylife/subs';

const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly', 'lifetime'];

export default function SubsCatalogPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formCycle, setFormCycle] = useState<BillingCycle>('monthly');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formStatus, setFormStatus] = useState<'active' | 'trial'>('active');
  const [formTrialEndDate, setFormTrialEndDate] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catData, catEntries] = await Promise.all([
        fetchCategories(),
        fetchAllCatalog(),
      ]);
      setCategories(catData);
      setCatalog(catEntries);
    } catch {
      setError('Could not load catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchCatalogAction(searchQuery);
        setSearchResults(results);
      } catch {
        // silently ignore search errors
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const prefillFromCatalog = (entry: CatalogEntry) => {
    setFormName(entry.name);
    setFormCost(entry.typicalCostCents ? (entry.typicalCostCents / 100).toFixed(2) : '');
    setFormCycle(entry.typicalBillingCycle);
    setFormCategoryId(entry.categoryId ?? '');
    setFormUrl(entry.websiteUrl ?? '');
    setShowForm(true);
  };

  const openCustomForm = () => {
    setFormName('');
    setFormCost('');
    setFormCycle('monthly');
    setFormCategoryId('');
    setFormUrl('');
    setFormNotes('');
    setFormStatus('active');
    setFormTrialEndDate('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formCost.trim()) return;
    setSaving(true);
    try {
      const costCents = Math.round(parseFloat(formCost) * 100);
      const input: CreateSubscriptionInput = {
        name: formName.trim(),
        costCents,
        billingCycle: formCycle,
        categoryId: formCategoryId || null,
        startDate: formStartDate,
        status: formStatus,
        trialEndDate: formStatus === 'trial' && formTrialEndDate ? formTrialEndDate : null,
        url: formUrl.trim() || null,
        notes: formNotes.trim() || null,
      };
      const sub = await doCreateSubscription(input);
      router.push(`/subs/${sub.id}`);
    } catch {
      setError('Failed to add subscription. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayEntries = searchResults ?? catalog;
  const groupedByCat = new Map<string, { category: Category | null; entries: CatalogEntry[] }>();
  for (const entry of displayEntries) {
    const catId = entry.categoryId ?? 'other';
    if (!groupedByCat.has(catId)) {
      const cat = categories.find((c) => c.id === catId) ?? null;
      groupedByCat.set(catId, { category: cat, entries: [] });
    }
    groupedByCat.get(catId)!.entries.push(entry);
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Add Subscription</h1>
        <div style={{ height: 44, borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)' }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 100, borderRadius: 16, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  if (error && !showForm) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>Something went wrong</h2>
        <p style={{ margin: '12px 0 20px', color: 'var(--text-secondary)' }}>{error}</p>
        <button type="button" onClick={() => { setError(null); void loadData(); }} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent-subs)', color: 'var(--background)', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Add Subscription</h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search subscriptions..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 15,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Add Custom Button */}
      <button
        type="button"
        onClick={openCustomForm}
        style={{
          padding: '12px 20px',
          borderRadius: 12,
          border: '1px dashed var(--accent-subs-border)',
          background: 'var(--glass)',
          color: 'var(--accent-subs)',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        + Add Custom Subscription
      </button>

      {/* Add Form (modal-like overlay) */}
      {showForm && (
        <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--accent-subs-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
              {formName ? `Add ${formName}` : 'New Subscription'}
            </h3>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>
              &#10005;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Cost (dollars) *</label>
              <input type="number" step="0.01" min="0" value={formCost} onChange={(e) => setFormCost(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Billing Cycle</label>
              <select value={formCycle} onChange={(e) => setFormCycle(e.target.value as BillingCycle)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}>
                {CYCLES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Category</label>
              <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}>
                <option value="">None</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Start Date</label>
              <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Status</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as 'active' | 'trial')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
              </select>
            </div>
            {formStatus === 'trial' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Trial End Date</label>
                <input type="date" value={formTrialEndDate} onChange={(e) => setFormTrialEndDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>URL</label>
              <input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Notes</label>
              <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !formName.trim() || !formCost.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: (!formName.trim() || !formCost.trim()) ? 'color-mix(in srgb, var(--accent-subs) 30%, transparent)' : 'var(--accent-subs)',
                color: 'var(--background)',
                fontWeight: 700,
                border: 'none',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Adding...' : 'Add Subscription'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--glass)', color: 'var(--text-secondary)', fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Catalog Grid */}
      {!showForm && (
        <div style={{ display: 'grid', gap: 24 }}>
          {Array.from(groupedByCat.entries()).map(([catId, { category, entries }]) => (
            <section key={catId}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {category?.name ?? 'Other'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => prefillFromCatalog(entry)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{entry.name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>
                      {entry.typicalCostCents ? `${formatCurrency(entry.typicalCostCents)}/${formatCycleShort(entry.typicalBillingCycle)}` : '--'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {displayEntries.length === 0 && searchQuery && (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>No results for &ldquo;{searchQuery}&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
}
