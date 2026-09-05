'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  doAddFoodLogItem,
  doCreateFoodLogEntry,
  doDeleteFoodLogEntry,
  doDeleteFoodLogItem,
  doUpdateFoodLogItem,
  fetchDailySummary,
  fetchFoodById,
  fetchFoodLogEntries,
  fetchFoodLogItems,
  fetchMealBreakdown,
} from '../actions';
import {
  NUTRITION_CHROME,
  NUTRITION_MEALS,
  alpha,
  formatNutritionDate,
} from '../_lib/design';
import {
  MaterialSymbol,
  NutritionButton,
  NutritionEmptyState,
  NutritionKicker,
  NutritionModal,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type DailySummary = Awaited<ReturnType<typeof fetchDailySummary>>;
type MealBreakdownList = Awaited<ReturnType<typeof fetchMealBreakdown>>;

type LogEntry = {
  id: string;
  date: string;
  mealType: string;
  notes: string | null;
  createdAt: string;
};

type LogItem = {
  id: string;
  logId: string;
  foodId: string;
  servingCount: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date: string, delta: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + delta);
  return value.toISOString().slice(0, 10);
}

export default function NutritionDiaryPage() {
  const [date, setDate] = useState(todayIso);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [mealStats, setMealStats] = useState<MealBreakdownList>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [entryItems, setEntryItems] = useState<Record<string, LogItem[]>>({});
  const [foodNames, setFoodNames] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copyTargetDate, setCopyTargetDate] = useState(todayIso);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editServing, setEditServing] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailySummary, meals, logEntries] = await Promise.all([
        fetchDailySummary(date),
        fetchMealBreakdown(date),
        fetchFoodLogEntries(date),
      ]);

      const itemsByEntry: Record<string, LogItem[]> = {};
      for (const entry of logEntries as LogEntry[]) {
        itemsByEntry[entry.id] = await fetchFoodLogItems(entry.id) as LogItem[];
      }

      const uniqueFoodIds = Array.from(
        new Set(
          Object.values(itemsByEntry)
            .flat()
            .map((item) => item.foodId),
        ),
      );

      const foods = await Promise.all(uniqueFoodIds.map((id) => fetchFoodById(id)));
      const nextFoodNames: Record<string, string> = {};
      uniqueFoodIds.forEach((id, index) => {
        nextFoodNames[id] = foods[index]?.name ?? 'Food';
      });

      setSummary(dailySummary);
      setMealStats(meals);
      setEntries(logEntries as LogEntry[]);
      setEntryItems(itemsByEntry);
      setFoodNames(nextFoodNames);
      setCollapsed((current) => {
        const next = { ...current };
        NUTRITION_MEALS.forEach((meal) => {
          if (next[meal.key] === undefined) next[meal.key] = false;
        });
        return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load food diary.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const isToday = date === todayIso();
  const hasLoggedFood = entries.length > 0;
  const copyDisabled = !copyTargetDate || copyTargetDate === date || entries.length === 0;

  const totals = useMemo(() => [
    { label: 'Calories', value: Math.round(summary?.calories ?? 0), suffix: 'kcal', color: NUTRITION_CHROME.calorie },
    { label: 'Protein', value: Math.round(summary?.proteinG ?? 0), suffix: 'g', color: NUTRITION_CHROME.protein },
    { label: 'Carbs', value: Math.round(summary?.carbsG ?? 0), suffix: 'g', color: NUTRITION_CHROME.carbs },
    { label: 'Fat', value: Math.round(summary?.fatG ?? 0), suffix: 'g', color: NUTRITION_CHROME.fat },
  ], [summary]);

  const handleCreateMeal = useCallback(async (mealType: string) => {
    try {
      await doCreateFoodLogEntry(crypto.randomUUID(), { date, mealType });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create meal entry.');
    }
  }, [date, load]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      await doDeleteFoodLogEntry(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete meal.');
    }
  }, [load]);

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      await doDeleteFoodLogItem(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete food item.');
    }
  }, [load]);

  const handleSaveEdit = useCallback(async (item: LogItem) => {
    const parsed = Number.parseFloat(editServing);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setEditingItemId(null);
      return;
    }

    const ratio = parsed / item.servingCount;
    try {
      await doUpdateFoodLogItem(item.id, {
        servingCount: parsed,
        calories: item.calories * ratio,
        proteinG: item.proteinG * ratio,
        carbsG: item.carbsG * ratio,
        fatG: item.fatG * ratio,
      });
      setEditingItemId(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to update serving.');
    }
  }, [editServing, load]);

  const handleCopyDay = useCallback(async () => {
    try {
      for (const entry of entries) {
        const nextEntryId = crypto.randomUUID();
        await doCreateFoodLogEntry(nextEntryId, { date: copyTargetDate, mealType: entry.mealType });
        const items = entryItems[entry.id] ?? [];
        for (const item of items) {
          await doAddFoodLogItem(crypto.randomUUID(), {
            logId: nextEntryId,
            foodId: item.foodId,
            servingCount: item.servingCount,
            calories: item.calories,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
          });
        }
      }
      setCopyModalOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to copy this day.');
    }
  }, [copyTargetDate, entries, entryItems]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPageHeader
          kicker={<NutritionKicker color={NUTRITION_CHROME.accent}>Diary</NutritionKicker>}
          title="Food Diary"
          description="Loading your meal groups and editable rows."
        />
        <NutritionPanel style={{ minHeight: 180, opacity: 0.52 }} />
        <NutritionPanel style={{ minHeight: 420, opacity: 0.38 }} />
      </div>
    );
  }

  if (error) {
    return (
      <NutritionEmptyState
        title="Food diary unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        kicker={<NutritionKicker color={NUTRITION_CHROME.accent}>Diary</NutritionKicker>}
        title="Food Diary"
        description={`Editable meal groups for ${formatNutritionDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`}
        action={(
          <>
            <NutritionButton tone="ghost" onClick={() => setCopyModalOpen(true)} disabled={!hasLoggedFood}>
              Copy Day
            </NutritionButton>
            <Link href="/nutrition/log">
              <NutritionButton tone="calorie">Log Meal</NutritionButton>
            </Link>
          </>
        )}
      />

      <NutritionPanel tone="focus" style={{ padding: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setDate((value) => shiftDate(value, -1))} style={navButtonStyle}>
              <MaterialSymbol name="chevron_left" size={18} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={() => setDate((value) => shiftDate(value, 1))} style={navButtonStyle}>
              <MaterialSymbol name="chevron_right" size={18} />
            </button>
            {!isToday ? (
              <NutritionButton tone="accent" onClick={() => setDate(todayIso())}>
                Today
              </NutritionButton>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(4, minmax(110px, 1fr))', width: 'min(100%, 640px)' }}>
            {totals.map((item) => (
              <div key={item.label} style={summaryCardStyle}>
                <span style={{ fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: NUTRITION_CHROME.textDim }}>{item.label}</span>
                <strong style={{ fontSize: 22, color: item.color }}>{item.value}{item.suffix}</strong>
              </div>
            ))}
          </div>
        </div>
      </NutritionPanel>

      {!hasLoggedFood ? (
        <NutritionEmptyState
          title="No meals logged for this day"
          description="Create a breakfast, lunch, dinner, or snack section and the diary will start grouping your foods automatically."
          action={<NutritionButton onClick={() => void handleCreateMeal('breakfast')}>Add Breakfast</NutritionButton>}
        />
      ) : null}

      <div style={{ display: 'grid', gap: 16 }}>
        {NUTRITION_MEALS.map((meal) => {
          const mealEntries = entries.filter((entry) => entry.mealType === meal.key);
          const mealSummary = mealStats.find((item) => item.mealType === meal.key);
          const collapsedSection = collapsed[meal.key];

          return (
            <NutritionPanel key={meal.key} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                  <button
                    type="button"
                    onClick={() => setCollapsed((current) => ({ ...current, [meal.key]: !current[meal.key] }))}
                    style={toggleStyle}
                  >
                    <MaterialSymbol name={meal.icon} size={20} color={NUTRITION_CHROME.accentLight} />
                    <div style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
                      <span style={{ fontSize: 17, fontWeight: 700 }}>{meal.label}</span>
                      <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                        {mealSummary
                          ? `${Math.round(mealSummary.calories)} kcal • ${Math.round(mealSummary.proteinG)}g protein`
                          : 'No foods logged yet'}
                      </span>
                    </div>
                    <MaterialSymbol
                      name={collapsedSection ? 'expand_more' : 'expand_less'}
                      size={20}
                      color={NUTRITION_CHROME.textMuted}
                      style={{ marginLeft: 'auto' }}
                    />
                  </button>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link href={`/nutrition/search?meal=${meal.key}`}>
                      <NutritionButton tone="ghost">Search</NutritionButton>
                    </Link>
                    <NutritionButton tone="accent" onClick={() => void handleCreateMeal(meal.key)}>
                      Add
                    </NutritionButton>
                  </div>
                </div>

                {!collapsedSection ? (
                  mealEntries.length > 0 ? (
                    mealEntries.map((entry) => (
                      <div key={entry.id} style={{ display: 'grid', gap: 10 }}>
                        {(entryItems[entry.id] ?? []).map((item) => (
                          <div key={item.id} style={foodRowStyle}>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <strong>{foodNames[item.foodId] ?? 'Food'}</strong>
                              <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
                                {editingItemId === item.id ? 'Press Enter to save servings' : `${Math.round(item.proteinG)}g protein • ${Math.round(item.carbsG)}g carbs • ${Math.round(item.fatG)}g fat`}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {editingItemId === item.id ? (
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={editServing}
                                  onChange={(event) => setEditServing(event.target.value)}
                                  onBlur={() => void handleSaveEdit(item)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      void handleSaveEdit(item);
                                    }
                                  }}
                                  style={{ ...inputStyle, width: 90 }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditServing(String(item.servingCount));
                                  }}
                                  style={iconTextButtonStyle}
                                >
                                  {item.servingCount}x
                                </button>
                              )}

                              <span style={{ color: NUTRITION_CHROME.calorie, fontWeight: 700, minWidth: 70, textAlign: 'right' }}>
                                {Math.round(item.calories)} kcal
                              </span>

                              <button type="button" onClick={() => void handleDeleteItem(item.id)} style={iconButtonStyle} aria-label="Delete food item">
                                <MaterialSymbol name="delete" size={18} color={NUTRITION_CHROME.danger} />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <Link href={`/nutrition/search?logId=${entry.id}&meal=${meal.key}`}>
                            <NutritionButton tone="ghost">Add Food</NutritionButton>
                          </Link>
                          <button type="button" onClick={() => void handleDeleteEntry(entry.id)} style={iconTextButtonStyle}>
                            Delete meal
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                        No foods logged under {meal.label.toLowerCase()} yet.
                      </div>
                      <div>
                        <Link href={`/nutrition/log?meal=${meal.key}`}>
                          <NutritionButton tone="calorie">Log {meal.label}</NutritionButton>
                        </Link>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </NutritionPanel>
          );
        })}
      </div>

      <NutritionModal
        open={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        title="Copy diary to another date"
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setCopyModalOpen(false)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleCopyDay()} disabled={copyDisabled}>Copy meals</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
            Duplicate all meals and food rows from {formatNutritionDate(date)} to a new target day.
          </div>
          <input
            type="date"
            value={copyTargetDate}
            onChange={(event) => setCopyTargetDate(event.target.value)}
            style={inputStyle}
          />
        </div>
      </NutritionModal>
    </div>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 14,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.text,
};

const navButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 16,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.text,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const toggleStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: 'none',
  background: 'transparent',
  color: NUTRITION_CHROME.text,
  cursor: 'pointer',
  padding: 0,
};

const summaryCardStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 14,
  borderRadius: 18,
  background: alpha('#FFFFFF', 0.04),
};

const foodRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: 16,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.04),
  boxShadow: `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
};

const iconButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: 'none',
  background: alpha(NUTRITION_CHROME.danger, 0.14),
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const iconTextButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 14,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.textMuted,
  cursor: 'pointer',
  fontWeight: 700,
};
