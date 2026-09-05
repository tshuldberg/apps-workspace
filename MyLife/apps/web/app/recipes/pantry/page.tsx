'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchPantryItems,
  addPantryItem,
  editPantryItem,
  removePantryItem,
  fetchExpiringItems,
} from '../actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PantryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  storage_location: string;
  expiration_date: string | null;
  purchase_date: string | null;
  barcode: string | null;
  photo_path: string | null;
  notes: string | null;
  grocery_section: string;
  is_staple: number;
  created_at: string;
  updated_at: string;
}

/** Map grocery_section to a display category label */
function sectionToCategory(section: string | null): string {
  const map: Record<string, string> = {
    produce: 'Produce', dairy: 'Dairy', meat: 'Meat',
    pantry: 'Pantry', bakery: 'Bakery', frozen: 'Frozen',
    deli: 'Other', beverages: 'Other', snacks: 'Other', other: 'Other',
  };
  return map[section ?? 'other'] ?? 'Other';
}

/** Map display category back to grocery_section value */
function categoryToSection(cat: string): string {
  const map: Record<string, string> = {
    Produce: 'produce', Dairy: 'dairy', Meat: 'meat',
    Pantry: 'pantry', Bakery: 'bakery', Frozen: 'frozen', Other: 'other',
  };
  return map[cat] ?? 'other';
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Bakery', 'Frozen', 'Other'] as const;
const ITEMS_PER_PAGE = 20;

const CATEGORY_ICONS: Record<string, string> = {
  Produce: '\u{1F96C}',
  Dairy: '\u{1F95B}',
  Meat: '\u{1F969}',
  Pantry: '\u{1F3E0}',
  Bakery: '\u{1F35E}',
  Frozen: '\u{2744}\uFE0F',
  Other: '\u{1F4E6}',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
}

function expirationLabel(dateStr: string | null): { text: string; color: string } {
  if (!dateStr) return { text: 'No date', color: '#D6C3B5' };
  const days = daysUntil(dateStr);
  if (days < 0) return { text: 'EXPIRED', color: '#EF4444' };
  if (days === 0) return { text: 'EXPIRES TODAY', color: '#EF4444' };
  if (days <= 7) return { text: `In ${days} day${days !== 1 ? 's' : ''}`, color: '#FFB877' };
  if (days <= 30) return { text: `In ${days} days`, color: '#D6C3B5' };
  if (days <= 365) return { text: `${Math.floor(days / 30)} months`, color: '#D6C3B5' };
  return { text: `Over 1 year`, color: '#D6C3B5' };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function formatQty(qty: number | null, unit: string | null): string {
  if (qty == null) return '--';
  const q = qty % 1 === 0 ? qty.toString() : qty.toFixed(1);
  return unit ? `${q} ${unit}` : q;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = {
  page: {
    minHeight: '100vh',
    background: '#131318',
    color: '#E4E1E9',
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif",
  } as React.CSSProperties,
  header: {
    padding: '32px 32px 0',
  } as React.CSSProperties,
  title: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#E4E1E9',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#C9894D',
    marginTop: 4,
  } as React.CSSProperties,
  /* Quick entry bar */
  entrySection: {
    padding: '24px 32px',
  } as React.CSSProperties,
  entryBar: {
    background: '#1B1B20',
    borderRadius: 16,
    padding: 24,
  } as React.CSSProperties,
  entryLabel: {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#D6C3B5',
    marginBottom: 12,
    fontWeight: 600,
  } as React.CSSProperties,
  entryRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  entryInput: {
    flex: 1,
    minWidth: 200,
    background: '#35343A',
    border: 'none',
    borderRadius: 9999,
    padding: '12px 20px',
    fontSize: 14,
    color: '#E4E1E9',
    outline: 'none',
  } as React.CSSProperties,
  entrySelect: {
    background: '#35343A',
    border: 'none',
    borderRadius: 9999,
    padding: '12px 16px',
    fontSize: 14,
    color: '#E4E1E9',
    outline: 'none',
    cursor: 'pointer',
    minWidth: 120,
  } as React.CSSProperties,
  qtyInput: {
    width: 72,
    background: '#35343A',
    border: 'none',
    borderRadius: 9999,
    padding: '12px 16px',
    fontSize: 14,
    color: '#E4E1E9',
    outline: 'none',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  unitInput: {
    width: 72,
    background: '#35343A',
    border: 'none',
    borderRadius: 9999,
    padding: '12px 16px',
    fontSize: 14,
    color: '#E4E1E9',
    outline: 'none',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  addBtn: {
    background: 'linear-gradient(135deg, #FFB877, #C9894D)',
    color: '#4B2700',
    border: 'none',
    borderRadius: 9999,
    padding: '12px 24px',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  /* Main layout */
  main: {
    display: 'flex',
    gap: 24,
    padding: '0 32px 32px',
    minHeight: 0,
    flex: 1,
  } as React.CSSProperties,
  /* Sidebar */
  sidebar: {
    width: 220,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,
  sidebarLabel: {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#D6C3B5',
    marginBottom: 4,
    marginLeft: 16,
    fontWeight: 600,
  } as React.CSSProperties,
  catBtn: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 12,
    border: 'none',
    background: active ? '#2A292F' : 'transparent',
    color: active ? '#FFB877' : '#D6C3B5',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    transition: 'all 0.2s',
  }),
  catCount: {
    marginLeft: 'auto',
    fontSize: 10,
    opacity: 0.5,
  } as React.CSSProperties,
  /* Expiration status */
  expirationSection: {
    marginTop: 24,
  } as React.CSSProperties,
  expirationRow: (color: string): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 10,
    fontWeight: 700,
    color,
    textTransform: 'uppercase' as const,
    padding: '0 16px',
    marginBottom: 4,
  }),
  expirationBar: {
    height: 4,
    borderRadius: 9999,
    background: '#35343A',
    margin: '0 16px 16px',
    overflow: 'hidden' as const,
  } as React.CSSProperties,
  expirationFill: (color: string, pct: number): React.CSSProperties => ({
    height: '100%',
    borderRadius: 9999,
    background: color,
    width: `${Math.min(pct, 100)}%`,
    transition: 'width 0.3s',
  }),
  /* Table */
  tableWrap: {
    flex: 1,
    background: '#1B1B20',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,
  tableScroll: {
    flex: 1,
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
  } as React.CSSProperties,
  th: {
    padding: '16px 24px',
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#D6C3B5',
    fontWeight: 600,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    position: 'sticky' as const,
    top: 0,
    background: '#1B1B20',
    zIndex: 1,
  } as React.CSSProperties,
  td: {
    padding: '16px 24px',
    fontSize: 14,
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  tr: {
    transition: 'background 0.15s',
    cursor: 'default',
  } as React.CSSProperties,
  itemCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,
  itemIcon: (color: string): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#35343A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
    color,
  }),
  itemName: {
    fontWeight: 600,
    fontSize: 14,
    color: '#E4E1E9',
  } as React.CSSProperties,
  categoryBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'rgba(214,195,181,0.7)',
  } as React.CSSProperties,
  expCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  } as React.CSSProperties,
  expDate: {
    fontSize: 10,
    opacity: 0.4,
  } as React.CSSProperties,
  actionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#D6C3B5',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    fontSize: 18,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  /* Footer */
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.05)',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(14,14,19,0.5)',
  } as React.CSSProperties,
  footerText: {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#D6C3B5',
  } as React.CSSProperties,
  paginationWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  pageBtn: (disabled: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: '#35343A',
    color: disabled ? 'rgba(214,195,181,0.3)' : '#D6C3B5',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
  }),
  pageLabel: {
    fontSize: 10,
    fontWeight: 700,
    padding: '0 8px',
    color: '#E4E1E9',
  } as React.CSSProperties,
  /* Edit modal overlay */
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  } as React.CSSProperties,
  modal: {
    background: '#1F1F25',
    borderRadius: 16,
    padding: 32,
    width: 420,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  } as React.CSSProperties,
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#E4E1E9',
    margin: 0,
  } as React.CSSProperties,
  modalLabel: {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#D6C3B5',
    fontWeight: 600,
    marginBottom: 4,
  } as React.CSSProperties,
  modalInput: {
    width: '100%',
    background: '#35343A',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: '#E4E1E9',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  modalRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  cancelBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 9999,
    padding: '8px 20px',
    color: '#D6C3B5',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  saveBtn: {
    background: 'linear-gradient(135deg, #FFB877, #C9894D)',
    border: 'none',
    borderRadius: 9999,
    padding: '8px 20px',
    color: '#4B2700',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,
  /* Empty / loading states */
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 64,
    color: '#D6C3B5',
    gap: 12,
  } as React.CSSProperties,
  emptyIcon: {
    fontSize: 48,
    opacity: 0.3,
  } as React.CSSProperties,
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  } as React.CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Quick entry state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Pantry');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('');

  // Expiration counts
  const [urgentCount, setUrgentCount] = useState(0);
  const [soonCount, setSoonCount] = useState(0);

  // Edit modal
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Pantry');
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editExpDate, setEditExpDate] = useState('');

  /* ---- data loading ---- */

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, unknown> = {};
      if (activeCategory) filters.grocerySection = categoryToSection(activeCategory);
      if (searchTerm.trim()) filters.search = searchTerm.trim();
      const result = await fetchPantryItems(filters);
      const sorted = [...(result as PantryItem[])].sort((a, b) => {
        if (!a.expiration_date && !b.expiration_date) return 0;
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      });
      setItems(sorted);
    } catch {
      setError('Failed to load pantry items');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchTerm]);

  const loadExpirationCounts = useCallback(async () => {
    try {
      const urgent = await fetchExpiringItems(0);
      const soon = await fetchExpiringItems(7);
      setUrgentCount((urgent as PantryItem[]).length);
      setSoonCount((soon as PantryItem[]).length);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadExpirationCounts();
  }, [loadItems, loadExpirationCounts]);

  /* ---- actions ---- */

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await addPantryItem({
        name: newName.trim(),
        storage_location: 'pantry',
        grocery_section: categoryToSection(newCategory) as 'produce' | 'dairy' | 'meat' | 'pantry' | 'bakery' | 'frozen' | 'other',
        quantity: newQty ? Number(newQty) : undefined,
        unit: newUnit || undefined,
      });
      setNewName('');
      setNewQty('');
      setNewUnit('');
      loadItems();
      loadExpirationCounts();
    } catch {
      setError('Failed to add item');
    }
  }

  async function handleDelete(id: string) {
    try {
      await removePantryItem(id);
      loadItems();
      loadExpirationCounts();
    } catch {
      setError('Failed to remove item');
    }
  }

  function openEdit(item: PantryItem) {
    setEditItem(item);
    setEditName(item.name);
    setEditCategory(sectionToCategory(item.grocery_section));
    setEditQty(item.quantity != null ? String(item.quantity) : '');
    setEditUnit(item.unit ?? '');
    setEditExpDate(item.expiration_date ?? '');
  }

  async function handleEditSave() {
    if (!editItem) return;
    try {
      await editPantryItem(editItem.id, {
        name: editName.trim() || undefined,
        grocery_section: categoryToSection(editCategory) as 'produce' | 'dairy' | 'meat' | 'pantry' | 'bakery' | 'frozen' | 'other',
        quantity: editQty ? Number(editQty) : undefined,
        unit: editUnit || undefined,
        expiration_date: editExpDate || undefined,
      });
      setEditItem(null);
      loadItems();
      loadExpirationCounts();
    } catch {
      setError('Failed to update item');
    }
  }

  /* ---- derived data ---- */

  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    const cat = sectionToCategory(item.grocery_section);
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  // Filtered items are already loaded from the server; just paginate
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const pagedItems = items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [activeCategory, searchTerm]);

  /* ---- expiration color for icon ---- */
  function iconColor(item: PantryItem): string {
    if (!item.expiration_date) return '#D6C3B5';
    const days = daysUntil(item.expiration_date);
    if (days <= 0) return '#EF4444';
    if (days <= 7) return '#FFB877';
    return '#8BCFF0';
  }

  /* ---- render ---- */

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Pantry Inventory</h1>
        <p style={s.subtitle}>The Digital Curator</p>
      </div>

      {/* Quick Entry Bar */}
      <div style={s.entrySection}>
        <div style={s.entryBar}>
          <div style={s.entryLabel}>Quick Entry / Barcode</div>
          <div style={s.entryRow}>
            <input
              style={s.entryInput}
              placeholder="Enter item name or scan..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select
              style={s.entrySelect}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              style={s.qtyInput}
              placeholder="Qty"
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
            />
            <input
              style={s.unitInput}
              placeholder="Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            />
            <button style={s.addBtn} onClick={handleAdd}>
              ADD TO PANTRY
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '0 32px', color: '#EF4444', fontSize: 13, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Main: sidebar + table */}
      <div style={s.main}>
        {/* Category Sidebar */}
        <div style={s.sidebar}>
          <div style={s.sidebarLabel}>Categories</div>
          <button
            style={s.catBtn(activeCategory === null)}
            onClick={() => setActiveCategory(null)}
            onMouseEnter={(e) => {
              if (activeCategory !== null) e.currentTarget.style.background = '#1B1B20';
            }}
            onMouseLeave={(e) => {
              if (activeCategory !== null) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 16 }}>{'All Items'}</span>
            <span style={s.catCount}>{items.length}</span>
          </button>

          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                style={s.catBtn(active)}
                onClick={() => setActiveCategory(active ? null : cat)}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#1B1B20';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat] ?? ''}</span>
                <span>{cat}</span>
                <span style={s.catCount}>{count}</span>
              </button>
            );
          })}

          {/* Expiration Status */}
          <div style={s.expirationSection}>
            <div style={s.sidebarLabel}>Expiration Status</div>
            <div style={{ marginTop: 12 }}>
              <div style={s.expirationRow('#FFB4AB')}>
                <span>Urgent</span>
                <span>{urgentCount}</span>
              </div>
              <div style={s.expirationBar}>
                <div style={s.expirationFill('#FFB4AB', items.length ? (urgentCount / items.length) * 100 : 0)} />
              </div>
              <div style={s.expirationRow('#FFB877')}>
                <span>Expiring Soon</span>
                <span>{soonCount}</span>
              </div>
              <div style={s.expirationBar}>
                <div style={s.expirationFill('#FFB877', items.length ? (soonCount / items.length) * 100 : 0)} />
              </div>
            </div>
          </div>
        </div>

        {/* Item Table */}
        <div style={s.tableWrap}>
          {loading ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>...</div>
              <div style={s.emptyText}>Loading pantry items...</div>
            </div>
          ) : items.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>{'( )'}</div>
              <div style={s.emptyText}>
                {activeCategory || searchTerm
                  ? 'No items match your filter'
                  : 'Your pantry is empty. Add items above.'}
              </div>
            </div>
          ) : (
            <>
              <div style={s.tableScroll}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Item</th>
                      <th style={s.th}>Category</th>
                      <th style={s.th}>Qty</th>
                      <th style={s.th}>Expiration</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map((item) => {
                      const exp = expirationLabel(item.expiration_date);
                      return (
                        <tr
                          key={item.id}
                          style={s.tr}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <td style={s.td}>
                            <div style={s.itemCell}>
                              <div style={s.itemIcon(iconColor(item))}>
                                {CATEGORY_ICONS[sectionToCategory(item.grocery_section)] ?? ''}
                              </div>
                              <span style={s.itemName}>{item.name}</span>
                            </div>
                          </td>
                          <td style={s.td}>
                            <span style={s.categoryBadge}>{sectionToCategory(item.grocery_section)}</span>
                          </td>
                          <td style={{ ...s.td, fontSize: 14, fontWeight: 500 }}>
                            {formatQty(item.quantity, item.unit)}
                          </td>
                          <td style={s.td}>
                            <div style={s.expCol}>
                              <span style={{ fontSize: 14, color: exp.color, fontWeight: exp.color !== '#D6C3B5' ? 700 : 400 }}>
                                {exp.text}
                              </span>
                              {item.expiration_date && (
                                <span style={s.expDate}>{formatDate(item.expiration_date)}</span>
                              )}
                            </div>
                          </td>
                          <td style={{ ...s.td, textAlign: 'right' }}>
                            <button
                              style={s.actionBtn}
                              title="Edit"
                              onClick={() => openEdit(item)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#35343A';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {'\u270F'}
                            </button>
                            <button
                              style={{ ...s.actionBtn, color: '#FFB4AB', marginLeft: 4 }}
                              title="Delete"
                              onClick={() => handleDelete(item.id)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {'\u2715'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={s.footer}>
                <span style={s.footerText}>
                  Total items: <strong style={{ color: '#E4E1E9' }}>{items.length}</strong>
                </span>
                {totalPages > 1 && (
                  <div style={s.paginationWrap}>
                    <button
                      style={s.pageBtn(page <= 1)}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {'<'}
                    </button>
                    <span style={s.pageLabel}>PAGE {page} OF {totalPages}</span>
                    <button
                      style={s.pageBtn(page >= totalPages)}
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      {'>'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div style={s.overlay} onClick={() => setEditItem(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Edit Item</h3>
            <div>
              <div style={s.modalLabel}>Name</div>
              <input
                style={s.modalInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <div style={s.modalLabel}>Category</div>
              <select
                style={{ ...s.modalInput, cursor: 'pointer' }}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={s.modalLabel}>Quantity</div>
                <input
                  style={s.modalInput}
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={s.modalLabel}>Unit</div>
                <input
                  style={s.modalInput}
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                />
              </div>
            </div>
            <div>
              <div style={s.modalLabel}>Expiration Date</div>
              <input
                style={s.modalInput}
                type="date"
                value={editExpDate}
                onChange={(e) => setEditExpDate(e.target.value)}
              />
            </div>
            <div style={s.modalRow}>
              <button style={s.cancelBtn} onClick={() => setEditItem(null)}>
                Cancel
              </button>
              <button style={s.saveBtn} onClick={handleEditSave}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
