'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchPackingTemplate, fetchPackingItems, addPackingItem,
  togglePackingItem, uncheckAllItems, removePackingItem,
} from '../../actions';
import {
  ACCENT, ACCENT_BORDER, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS,
} from '../../ui';

interface PackingTemplate { id: string; name: string; type: string; }
interface PackingItem {
  id: string; templateId: string; name: string; category: string;
  isChecked: boolean; sortOrder: number;
}

export default function PackingChecklistPage() {
  const params = useParams();
  const id = params.id as string;
  const [template, setTemplate] = useState<PackingTemplate | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Essentials');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchPackingTemplate(id), fetchPackingItems(id)])
      .then(([tmpl, itms]) => {
        if (!tmpl) { setError('Checklist not found'); return; }
        setTemplate(tmpl as PackingTemplate);
        setItems(itms as PackingItem[]);
      })
      .catch(() => setError('Failed to load checklist'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const grouped = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const checked = useMemo(() => items.filter((i) => i.isChecked).length, [items]);
  const total = items.length;
  const pct = total > 0 ? (checked / total) * 100 : 0;

  const handleToggle = async (item: PackingItem) => {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i));
    try { await togglePackingItem(item.id, !item.isChecked); }
    catch { loadData(); }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await addPackingItem({ templateId: id, name: newItemName.trim(), category: newItemCategory, sortOrder: items.length });
      setNewItemName('');
      loadData();
    } catch { setError('Failed to add item'); }
  };

  const handleRemoveItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try { await removePackingItem(itemId); }
    catch { loadData(); }
  };

  const handleUncheckAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, isChecked: false })));
    try { await uncheckAllItems(id); }
    catch { loadData(); }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ height: 60, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        {[1, 2, 3].map((i) => <div key={i} style={{ height: 120, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    );
  }

  if (error || !template) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>{error ?? 'Checklist not found'}</p>
        <Link href="/trails/packing" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Back to packing lists</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Link href="/trails/packing" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to packing lists</Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{template.name}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>{template.type.replace('_', ' ')}</p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>{checked}/{total}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ height: 6, borderRadius: 3, backgroundColor: SURFACE }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: ACCENT, transition: 'width 0.2s' }} />
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_TER, textAlign: 'right' }}>{Math.round(pct)}% packed</p>
      </div>

      {/* Categories */}
      {grouped.length === 0 ? (
        <section style={{ padding: 32, borderRadius: 20, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS, textAlign: 'center' }}>
          <p style={{ fontSize: 36, margin: '0 0 8px' }}>{'\uD83C\uDF92'}</p>
          <h3 style={{ margin: 0, fontSize: 18, color: TEXT }}>Empty list</h3>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>Add items to start packing</p>
        </section>
      ) : (
        grouped.map(([category, categoryItems]) => (
          <section key={category}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: TEXT_TER }}>
              {category}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
              {categoryItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, backgroundColor: SURFACE }}>
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    onChange={() => handleToggle(item)}
                    style={{ accentColor: ACCENT, width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{
                    flex: 1, fontSize: 14, color: item.isChecked ? TEXT_TER : TEXT,
                    textDecoration: item.isChecked ? 'line-through' : 'none',
                  }}>
                    {item.name}
                  </span>
                  <button type="button" onClick={() => handleRemoveItem(item.id)} style={{ background: 'none', border: 'none', color: TEXT_TER, cursor: 'pointer', fontSize: 11 }}>x</button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Add item */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Item name..." value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          style={inputStyle} />
        <input type="text" placeholder="Category" value={newItemCategory}
          onChange={(e) => setNewItemCategory(e.target.value)}
          style={{ ...inputStyle, width: 120, flex: 'none' }} />
        <button type="button" onClick={handleAddItem} disabled={!newItemName.trim()} style={{
          borderRadius: 999, backgroundColor: ACCENT, color: 'var(--background)', padding: '8px 16px',
          fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
          opacity: newItemName.trim() ? 1 : 0.5,
        }}>
          + Add
        </button>
      </div>

      {/* Actions */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={handleUncheckAll} style={{
            borderRadius: 999, border: `1px solid ${BORDER}`, backgroundColor: GLASS,
            color: TEXT_SEC, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            Uncheck All
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
  backgroundColor: 'var(--background)', color: TEXT, fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
};
