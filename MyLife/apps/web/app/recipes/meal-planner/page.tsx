'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchMealPlanBundle,
  addMealPlanItem,
  removeMealItem,
  fetchRecipes,
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
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.06)',
  green: '#22C55E',
  danger: '#FFB4AB',
} as const;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealSlot = (typeof SLOTS)[number];

const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: '\u2615',
  lunch: '\uD83C\uDF7D\uFE0F',
  dinner: '\uD83C\uDF7D\uFE0F',
  snack: '\uD83C\uDF4E',
};

interface RecipeSummary {
  id: string;
  title: string;
  image_uri: string | null;
  total_time_mins: number | null;
  servings: number | null;
  is_favorite: number;
}

interface MealPlanItem {
  id: string;
  recipe_id: string;
  day_of_week: number;
  meal_slot: string;
  servings: number;
  recipe_title: string;
  recipe_image_uri: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(weekStart: string): Date[] {
  const start = new Date(weekStart + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatDateRange(weekStart: string): string {
  const dates = getWeekDates(weekStart);
  const first = dates[0];
  const last = dates[6];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (first.getMonth() === last.getMonth()) {
    return `${months[first.getMonth()].toUpperCase()} ${first.getDate()} - ${last.getDate()}`;
  }
  return `${months[first.getMonth()].toUpperCase()} ${first.getDate()} - ${months[last.getMonth()].toUpperCase()} ${last.getDate()}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MealPlannerPage() {
  const [weekStart, setWeekStart] = useState(getWeekStart);
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerFilter, setDrawerFilter] = useState<'all' | 'favorites'>('all');
  const [generating, setGenerating] = useState(false);

  const weekDates = getWeekDates(weekStart);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bundle, allRecipes] = await Promise.all([
        fetchMealPlanBundle(weekStart),
        fetchRecipes(),
      ]);
      setItems(bundle.items ?? []);
      setRecipes(allRecipes ?? []);
    } catch {
      /* handled by server action */
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const nextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const goToday = () => setWeekStart(getWeekStart());

  const handleCellClick = async (dayOfWeek: number, slot: MealSlot) => {
    if (!selectedRecipe) return;
    try {
      await addMealPlanItem({
        weekStart,
        recipeId: selectedRecipe,
        dayOfWeek,
        mealSlot: slot,
      });
      setSelectedRecipe(null);
      load();
    } catch {
      /* handled */
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeMealItem(itemId);
      load();
    } catch {
      /* handled */
    }
  };

  const handleGenerateShoppingList = async () => {
    setGenerating(true);
    try {
      await generateShoppingListFromPlan(weekStart);
    } catch {
      /* handled */
    } finally {
      setGenerating(false);
    }
  };

  const getItemForCell = (dayOfWeek: number, slot: MealSlot): MealPlanItem | undefined =>
    items.find((i) => i.day_of_week === dayOfWeek && i.meal_slot === slot);

  const getMealsPerDay = (dayOfWeek: number): number =>
    items.filter((i) => i.day_of_week === dayOfWeek).length;

  const filteredRecipes = recipes.filter((r) => {
    if (drawerSearch && !r.title.toLowerCase().includes(drawerSearch.toLowerCase())) return false;
    if (drawerFilter === 'favorites' && !r.is_favorite) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '24px 32px 0', flexShrink: 0 }}>
          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={prevWeek}
                style={{
                  background: 'none', border: 'none', color: C.textSecondary,
                  cursor: 'pointer', fontSize: 20, padding: 4, borderRadius: 8,
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
              >
                &#9664;
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {formatDateRange(weekStart)}
              </h2>
              <button
                onClick={nextWeek}
                style={{
                  background: 'none', border: 'none', color: C.textSecondary,
                  cursor: 'pointer', fontSize: 20, padding: 4, borderRadius: 8,
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
              >
                &#9654;
              </button>
              <button
                onClick={goToday}
                style={{
                  background: C.surfaceHigh, border: 'none', color: C.textSecondary,
                  cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: '6px 14px',
                  borderRadius: 9999, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >
                Today
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {selectedRecipe && (
                <span style={{ fontSize: 11, color: C.green, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Click a cell to assign
                </span>
              )}
            </div>
          </div>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: C.accentContainer, textTransform: 'uppercase', margin: '0 0 6px' }}>
                Weekly Overview
              </p>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
                Kitchen Planning
              </h1>
            </div>
            <button
              onClick={handleGenerateShoppingList}
              disabled={generating || items.length === 0}
              style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentContainer})`,
                color: C.accentOnPrimary,
                border: 'none', padding: '12px 28px', borderRadius: 9999,
                fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: items.length === 0 || generating ? 'not-allowed' : 'pointer',
                opacity: items.length === 0 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 8px 24px rgba(201,137,77,0.2)',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => { if (items.length > 0) e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: 16 }}>&#128722;</span>
              {generating ? 'Generating...' : 'Generate Shopping List'}
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.textSecondary }}>
              Loading meal plan...
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 4 }}>
                {weekDates.map((date, i) => {
                  const today = isToday(date);
                  return (
                    <div key={i} style={{ textAlign: 'center', paddingBottom: 8 }}>
                      <p style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                        color: today ? C.accent : `${C.textSecondary}99`, margin: '0 0 4px',
                      }}>
                        {DAYS[i]}
                      </p>
                      <p style={{
                        fontSize: 20, fontWeight: 700, margin: 0,
                        color: today ? C.accent : C.text,
                      }}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Meal slot rows */}
              {SLOTS.map((slot) => (
                <div key={slot}>
                  {/* Slot divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', opacity: 0.6 }}>
                    <div style={{ height: 1, flex: 1, background: C.surfaceHighest }} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                      color: C.textSecondary,
                    }}>
                      {slot}
                    </span>
                    <div style={{ height: 1, flex: 1, background: C.surfaceHighest }} />
                  </div>

                  {/* Cells grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
                    {weekDates.map((_, dayIdx) => {
                      const item = getItemForCell(dayIdx, slot);
                      if (item) {
                        return (
                          <div
                            key={dayIdx}
                            style={{
                              aspectRatio: '1',
                              background: C.surface,
                              borderRadius: 20,
                              padding: 14,
                              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHigh; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = C.surface; }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 16, opacity: 0.5 }}>{SLOT_ICONS[slot]}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: `${C.text}44`, fontSize: 14, padding: 2,
                                  borderRadius: 6, display: 'flex',
                                  transition: 'color 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = C.danger; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = `${C.text}44`; }}
                                title="Remove"
                              >
                                &#10005;
                              </button>
                            </div>
                            <p style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, margin: 0 }}>
                              {item.recipe_title}
                            </p>
                          </div>
                        );
                      }

                      // Empty cell
                      return (
                        <div
                          key={dayIdx}
                          onClick={() => handleCellClick(dayIdx, slot)}
                          style={{
                            aspectRatio: '1',
                            background: selectedRecipe ? C.surfaceLow : 'transparent',
                            borderRadius: 20,
                            padding: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px dashed ${selectedRecipe ? `${C.accent}55` : `${C.text}15`}`,
                            cursor: selectedRecipe ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedRecipe) {
                              e.currentTarget.style.borderColor = `${C.accent}88`;
                              e.currentTarget.style.background = C.surface;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedRecipe) {
                              e.currentTarget.style.borderColor = `${C.accent}55`;
                              e.currentTarget.style.background = C.surfaceLow;
                            }
                          }}
                        >
                          {selectedRecipe && (
                            <span style={{ fontSize: 18, color: `${C.accent}55` }}>+</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Daily meal count row */}
              <div style={{
                marginTop: 24, padding: '16px 24px',
                background: C.surfaceLowest, borderRadius: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  {weekDates.map((date, i) => {
                    const count = getMealsPerDay(i);
                    const today = isToday(date);
                    return (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <p style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                          color: today ? C.accent : `${C.textSecondary}66`, margin: '0 0 4px',
                        }}>
                          {DAYS[i]}
                        </p>
                        <p style={{
                          fontSize: 13, fontWeight: 700, margin: 0,
                          color: today ? C.accent : C.text,
                        }}>
                          {count > 0 ? `${count} meal${count > 1 ? 's' : ''}` : '--'}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: `${C.textSecondary}99`, margin: '0 0 4px' }}>
                    Total
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: 0 }}>
                    {items.length} meal{items.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recipe Drawer (right sidebar) */}
      <aside style={{
        width: 300, flexShrink: 0,
        background: C.surfaceLow,
        borderLeft: `1px solid ${C.glassBorder}`,
        display: 'flex', flexDirection: 'column',
        padding: 24, overflow: 'hidden',
      }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Recipe Drawer</h3>
          <p style={{ fontSize: 10, color: `${C.textSecondary}99`, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            Click to select, then assign
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search recipes..."
            value={drawerSearch}
            onChange={(e) => setDrawerSearch(e.target.value)}
            style={{
              width: '100%', background: C.surfaceHighest,
              border: 'none', borderRadius: 9999,
              padding: '10px 16px 10px 36px',
              fontSize: 12, color: C.text,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.textSecondary, opacity: 0.5 }}>
            &#128269;
          </span>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['all', 'favorites'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDrawerFilter(f)}
              style={{
                background: drawerFilter === f ? C.accent : C.surfaceHighest,
                color: drawerFilter === f ? C.accentOnPrimary : C.textSecondary,
                border: 'none', borderRadius: 9999,
                padding: '6px 16px', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? 'All' : 'Favorites'}
            </button>
          ))}
        </div>

        {/* Recipe list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredRecipes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textSecondary, fontSize: 12 }}>
              {recipes.length === 0 ? 'No recipes yet' : 'No matching recipes'}
            </div>
          ) : (
            filteredRecipes.map((recipe) => {
              const isSelected = selectedRecipe === recipe.id;
              return (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(isSelected ? null : recipe.id)}
                  style={{
                    background: isSelected ? `${C.accent}18` : C.surfaceHighest,
                    borderRadius: 16, padding: 12,
                    display: 'flex', gap: 12, alignItems: 'center',
                    cursor: 'pointer',
                    border: isSelected ? `1px solid ${C.accent}44` : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.borderColor = `${C.accent}22`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: C.surfaceHigh,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, overflow: 'hidden',
                  }}>
                    {recipe.image_uri ? (
                      <img src={recipe.image_uri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '\uD83C\uDF73'
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {recipe.title}
                    </p>
                    <p style={{ fontSize: 10, color: `${C.textSecondary}99`, margin: '3px 0 0' }}>
                      {recipe.total_time_mins ? `${recipe.total_time_mins}m` : '--'}
                      {recipe.is_favorite ? ' \u2764' : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <div style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: C.green, flexShrink: 0,
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Create new recipe shortcut */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.glassBorder}` }}>
          <a
            href="/recipes/add"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 0',
              background: `${C.text}08`, borderRadius: 16, border: 'none',
              color: C.text, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              textDecoration: 'none',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.text}12`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${C.text}08`; }}
          >
            <span style={{ fontSize: 16 }}>+</span>
            Create New Recipe
          </a>
        </div>
      </aside>
    </div>
  );
}
