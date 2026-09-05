'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchShoppingLists,
  fetchShoppingList,
  addShoppingList,
  addGroceryItem,
  toggleGroceryItem,
  removeGroceryItem,
  generateShoppingListFromPlan,
} from '../actions';

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */

const C = {
  bg: '#131318',
  surfaceLowest: '#0E0E13',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#FFB877',
  accentContainer: '#C9894D',
  accentOnPrimary: '#4B2700',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.06)',
  green: '#22C55E',
  danger: '#FFB4AB',
  outlineVariant: '#52443A',
} as const;

type GrocerySection =
  | 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen'
  | 'bakery' | 'beverages' | 'snacks' | 'condiments' | 'other';

const SECTION_LABELS: Record<GrocerySection, string> = {
  produce: 'Produce',
  dairy: 'Dairy & Refrigerated',
  meat: 'Meat & Seafood',
  pantry: 'Pantry Staples',
  frozen: 'Frozen',
  bakery: 'Bakery',
  beverages: 'Beverages',
  snacks: 'Snacks',
  condiments: 'Condiments & Sauces',
  other: 'Other',
};

const SECTION_ORDER: GrocerySection[] = [
  'produce', 'dairy', 'meat', 'bakery', 'pantry',
  'frozen', 'beverages', 'snacks', 'condiments', 'other',
];

interface ShoppingList {
  id: string;
  name: string;
  is_active: number;
  created_at: string;
}

interface ShoppingListItem {
  id: string;
  list_id: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  grocery_section: GrocerySection;
  recipe_id: string | null;
  is_checked: number;
  is_custom: number;
}

interface ListSummary {
  totalItems: number;
  checkedItems: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function formatQuantity(qty: number | null, unit: string | null): string {
  if (!qty && !unit) return '';
  const parts: string[] = [];
  if (qty) parts.push(String(qty));
  if (unit) parts.push(unit);
  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GroceryPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<ShoppingListItem[]>([]);
  const [summary, setSummary] = useState<ListSummary>({ totalItems: 0, checkedItems: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);

  const loadLists = useCallback(async () => {
    try {
      const result = await fetchShoppingLists();
      setLists(result ?? []);
      if (!activeListId && result && result.length > 0) {
        setActiveListId(result[0].id);
      }
    } catch {
      /* handled */
    }
  }, [activeListId]);

  const loadListDetail = useCallback(async () => {
    if (!activeListId) {
      setListItems([]);
      setSummary({ totalItems: 0, checkedItems: 0 });
      return;
    }
    try {
      const detail = await fetchShoppingList(activeListId);
      if (detail) {
        setListItems((detail.items as ShoppingListItem[]) ?? []);
        setSummary(detail.summary ?? { totalItems: 0, checkedItems: 0 });
      }
    } catch {
      /* handled */
    }
  }, [activeListId]);

  useEffect(() => {
    setLoading(true);
    loadLists().finally(() => setLoading(false));
  }, [loadLists]);

  useEffect(() => {
    if (activeListId) loadListDetail();
  }, [activeListId, loadListDetail]);

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const result = await addShoppingList(name);
      setNewListName('');
      setShowNewListInput(false);
      await loadLists();
      if (result?.id) setActiveListId(result.id);
    } catch {
      /* handled */
    }
  };

  const handleAddItem = async () => {
    if (!activeListId || !newItemName.trim()) return;
    try {
      await addGroceryItem(activeListId, newItemName.trim(), newItemQty || undefined);
      setNewItemName('');
      setNewItemQty('');
      setShowAddItem(false);
      await loadListDetail();
    } catch {
      /* handled */
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleGroceryItem(id);
      // Optimistic update
      setListItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_checked: item.is_checked ? 0 : 1 } : item,
        ),
      );
      setSummary((prev) => {
        const toggled = listItems.find((i) => i.id === id);
        if (!toggled) return prev;
        return {
          ...prev,
          checkedItems: toggled.is_checked ? prev.checkedItems - 1 : prev.checkedItems + 1,
        };
      });
    } catch {
      await loadListDetail();
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      await removeGroceryItem(id);
      setListItems((prev) => prev.filter((item) => item.id !== id));
      setSummary((prev) => ({
        ...prev,
        totalItems: prev.totalItems - 1,
        checkedItems: prev.checkedItems - (listItems.find((i) => i.id === id)?.is_checked ? 1 : 0),
      }));
    } catch {
      await loadListDetail();
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateShoppingListFromPlan(getWeekStart());
      await loadLists();
      await loadListDetail();
    } catch {
      /* handled */
    } finally {
      setGenerating(false);
    }
  };

  // Group items by grocery section
  const groupedItems: Map<GrocerySection, ShoppingListItem[]> = new Map();
  for (const item of listItems) {
    const section = (item.grocery_section || 'other') as GrocerySection;
    if (!groupedItems.has(section)) groupedItems.set(section, []);
    groupedItems.get(section)!.push(item);
  }

  const orderedSections = SECTION_ORDER.filter((s) => groupedItems.has(s));
  const progressPct = summary.totalItems > 0 ? Math.round((summary.checkedItems / summary.totalItems) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 32px 120px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: C.accentContainer, textTransform: 'uppercase', margin: '0 0 8px' }}>
              The Obsidian Library
            </p>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
              Grocery List
            </h1>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentContainer})`,
              color: C.accentOnPrimary,
              border: 'none', padding: '12px 24px', borderRadius: 9999,
              fontWeight: 700, fontSize: 13,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(201,137,77,0.2)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <span style={{ fontSize: 16 }}>&#10024;</span>
            {generating ? 'Generating...' : 'Generate from Meal Plan'}
          </button>
        </div>

        {/* List tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 36, overflowX: 'auto', paddingBottom: 4 }}>
          {lists.map((list) => {
            const isActive = list.id === activeListId;
            return (
              <button
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                style={{
                  background: isActive ? C.glass : C.glass,
                  border: isActive ? `1px solid ${C.accentContainer}44` : '1px solid transparent',
                  color: isActive ? C.accentContainer : `${C.text}66`,
                  padding: '10px 24px', borderRadius: 9999,
                  fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                  letterSpacing: '0.12em', whiteSpace: 'nowrap',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = `${C.text}cc`;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = `${C.text}66`;
                }}
              >
                {list.name}
              </button>
            );
          })}
          {showNewListInput ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="List name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') setShowNewListInput(false); }}
                autoFocus
                style={{
                  background: C.surfaceHighest, border: 'none', borderRadius: 9999,
                  padding: '10px 16px', fontSize: 11, color: C.text,
                  outline: 'none', width: 140,
                }}
              />
              <button
                onClick={handleCreateList}
                style={{
                  background: C.accent, color: C.accentOnPrimary, border: 'none',
                  borderRadius: 9999, padding: '8px 14px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewListInput(true)}
              style={{
                background: C.glass, border: 'none',
                color: `${C.text}66`, padding: '10px 14px',
                borderRadius: 9999, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                fontSize: 18, transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = `${C.text}66`; }}
            >
              +
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.textSecondary }}>
            Loading grocery lists...
          </div>
        ) : !activeListId ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.textSecondary }}>
            <p style={{ fontSize: 14, margin: '0 0 16px' }}>No shopping lists yet</p>
            <button
              onClick={() => setShowNewListInput(true)}
              style={{
                background: C.surfaceHigh, border: 'none', color: C.accent,
                padding: '12px 24px', borderRadius: 12, fontWeight: 600,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Create your first list
            </button>
          </div>
        ) : (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Grouped items */}
            {orderedSections.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: C.textSecondary }}>
                <p style={{ fontSize: 14, margin: '0 0 8px' }}>This list is empty</p>
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Add items manually or generate from your meal plan</p>
              </div>
            )}

            {orderedSections.map((section) => {
              const sectionItems = groupedItems.get(section)!;
              return (
                <section key={section} style={{ marginBottom: 40 }}>
                  {/* Section header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <h3 style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                      textTransform: 'uppercase', color: C.textSecondary, margin: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {SECTION_LABELS[section]}
                    </h3>
                    <div style={{
                      height: 1, flex: 1,
                      background: `linear-gradient(to right, ${C.outlineVariant}4D, transparent)`,
                    }} />
                  </div>

                  {/* Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sectionItems.map((item) => {
                      const checked = !!item.is_checked;
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 16, borderRadius: 16,
                            background: checked ? `${C.surfaceLow}66` : C.surfaceLow,
                            transition: 'all 0.2s',
                            cursor: 'default',
                          }}
                          onMouseEnter={(e) => {
                            if (!checked) e.currentTarget.style.background = C.surfaceHigh;
                            const del = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                            if (del) del.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            if (!checked) e.currentTarget.style.background = C.surfaceLow;
                            const del = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                            if (del) del.style.opacity = '0';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: checked ? 0.4 : 1 }}>
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggle(item.id)}
                              style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                border: checked ? `2px solid ${C.accent}` : `2px solid ${C.outlineVariant}`,
                                background: checked ? C.accent : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s', padding: 0,
                              }}
                            >
                              {checked && (
                                <span style={{ color: C.accentOnPrimary, fontSize: 12, fontWeight: 700 }}>&#10003;</span>
                              )}
                            </button>

                            <div>
                              <p style={{
                                fontSize: 14, fontWeight: 600, margin: 0,
                                textDecoration: checked ? 'line-through' : 'none',
                                transition: 'color 0.15s',
                              }}>
                                {item.item}
                              </p>
                              <p style={{ fontSize: 10, color: C.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '3px 0 0' }}>
                                {item.is_custom ? 'Manual Entry' : item.recipe_id ? `Source: Recipe` : ''}
                              </p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: checked ? 0.4 : 1 }}>
                            {(item.quantity || item.unit) && (
                              <span style={{ fontSize: 12, fontWeight: 500, color: `${C.text}99` }}>
                                {formatQuantity(item.quantity, item.unit)}
                              </span>
                            )}
                            <button
                              data-delete
                              onClick={() => handleRemoveItem(item.id)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: C.textSecondary, fontSize: 16, padding: 4,
                                opacity: 0, transition: 'opacity 0.15s, color 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = C.danger; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = C.textSecondary; }}
                              title="Remove item"
                            >
                              &#128465;
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Shopping Progress */}
            {summary.totalItems > 0 && (
              <div style={{
                marginTop: 48, padding: 32, borderRadius: 24,
                background: C.glass,
                backdropFilter: 'blur(20px)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(135deg, ${C.accent}0D, transparent)`,
                  opacity: 0.5,
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <p style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                        textTransform: 'uppercase', color: C.textSecondary, margin: '0 0 8px',
                      }}>
                        Shopping Progress
                      </p>
                      <h4 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                        {summary.checkedItems} of {summary.totalItems} items found
                      </h4>
                      {/* Progress bar */}
                      <div style={{
                        width: '100%', maxWidth: 280, height: 4,
                        background: C.surfaceHighest, borderRadius: 9999,
                        marginTop: 16, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', background: C.accent,
                          borderRadius: 9999, width: `${progressPct}%`,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        style={{
                          background: C.surfaceHighest, border: 'none',
                          color: C.text, padding: '12px 24px', borderRadius: 9999,
                          fontWeight: 700, fontSize: 13,
                          display: 'flex', alignItems: 'center', gap: 8,
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHigh; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = C.surfaceHighest; }}
                      >
                        <span style={{ fontSize: 14 }}>&#128279;</span>
                        Share
                      </button>
                      <button
                        onClick={() => window.print()}
                        style={{
                          background: C.accent, border: 'none',
                          color: C.accentOnPrimary, padding: '12px 32px', borderRadius: 9999,
                          fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', transition: 'transform 0.15s',
                          boxShadow: '0 8px 24px rgba(201,137,77,0.15)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        Print List
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB for adding items */}
      {activeListId && (
        <>
          {showAddItem && (
            <div style={{
              position: 'fixed', bottom: 96, right: 32,
              background: C.surfaceHigh, borderRadius: 20, padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
              width: 280, zIndex: 50,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Add Item
              </p>
              <input
                type="text"
                placeholder="Item name..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                autoFocus
                style={{
                  width: '100%', background: C.surfaceHighest,
                  border: 'none', borderRadius: 12,
                  padding: '10px 14px', fontSize: 13, color: C.text,
                  outline: 'none', marginBottom: 10, boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                placeholder="Quantity (e.g. 2 bags)..."
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                style={{
                  width: '100%', background: C.surfaceHighest,
                  border: 'none', borderRadius: 12,
                  padding: '10px 14px', fontSize: 13, color: C.text,
                  outline: 'none', marginBottom: 14, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowAddItem(false); setNewItemName(''); setNewItemQty(''); }}
                  style={{
                    flex: 1, background: C.surfaceHighest, border: 'none',
                    color: C.textSecondary, padding: '10px 0', borderRadius: 12,
                    fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={!newItemName.trim()}
                  style={{
                    flex: 1, background: C.accent, border: 'none',
                    color: C.accentOnPrimary, padding: '10px 0', borderRadius: 12,
                    fontWeight: 700, fontSize: 12, cursor: newItemName.trim() ? 'pointer' : 'not-allowed',
                    opacity: newItemName.trim() ? 1 : 0.5,
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            style={{
              position: 'fixed', bottom: 32, right: 32,
              width: 56, height: 56, borderRadius: 9999,
              background: C.accent, border: 'none',
              color: C.accentOnPrimary,
              boxShadow: '0 8px 32px rgba(201,137,77,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 28, fontWeight: 300,
              transition: 'transform 0.15s',
              zIndex: 50,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {showAddItem ? '\u00D7' : '+'}
          </button>
        </>
      )}
    </div>
  );
}
