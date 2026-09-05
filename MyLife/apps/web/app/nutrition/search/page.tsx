'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  doAddFoodLogItem,
  doCreateFoodLogEntry,
  doImportOnlineFood,
  doLogMealTemplate,
  doSearchFoods,
  doSearchFoodsOnline,
  fetchFavoriteFoods,
  fetchFoodLogEntries,
  fetchMealTemplates,
  fetchRecentFoods,
} from '../actions';
import {
  NUTRITION_CHROME,
  NUTRITION_MEALS,
  alpha,
  getSourceBadge,
  humanizeNutritionValue,
} from '../_lib/design';
import {
  MaterialSymbol,
  NutritionBadge,
  NutritionButton,
  NutritionEmptyState,
  NutritionModal,
  NutritionPageHeader,
  NutritionPanel,
  NutritionSourceBadge,
} from '../_components/NutritionPrimitives';

type Food = {
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: string;
};

type Template = Awaited<ReturnType<typeof fetchMealTemplates>>[number];

type OnlineFood = Awaited<ReturnType<typeof doSearchFoodsOnline>>[number];

type SearchTab = 'results' | 'online' | 'recent' | 'favorites' | 'templates';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function NutritionSearchPageContent() {
  const searchParams = useSearchParams();
  const logIdParam = searchParams.get('logId');
  const mealParam = searchParams.get('meal') ?? 'breakfast';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [onlineResults, setOnlineResults] = useState<OnlineFood[]>([]);
  const [onlineSearching, setOnlineSearching] = useState(false);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [recentFoods, setRecentFoods] = useState<Food[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTab, setActiveTab] = useState<SearchTab>('results');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerFood, setPickerFood] = useState<Food | null>(null);
  const [targetDate, setTargetDate] = useState(todayIso);
  const [targetMeal, setTargetMeal] = useState(mealParam);
  const [servingCount, setServingCount] = useState('1');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRecentFoods(16), fetchFavoriteFoods(16), fetchMealTemplates()])
      .then(([recent, favorites, mealTemplates]) => {
        if (cancelled) return;
        setRecentFoods(recent as Food[]);
        setFavoriteFoods(favorites as Food[]);
        setTemplates(mealTemplates);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load search rails.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      doSearchFoods(trimmed, 30)
        .then((foods) => {
          setResults(foods as Food[]);
          setActiveTab('results');
        })
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : 'Search failed.');
        })
        .finally(() => {
          setSearching(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  // Live Open Food Facts search on a slower debounce (network + rate limits).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setOnlineResults([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setOnlineSearching(true);
      doSearchFoodsOnline(trimmed)
        .then((foods) => setOnlineResults(foods))
        .catch(() => setOnlineResults([]))
        .finally(() => setOnlineSearching(false));
    }, 600);

    return () => window.clearTimeout(timer);
  }, [query]);

  async function handleImportOnlineFood(food: OnlineFood) {
    const key = `${food.name}|${food.barcode ?? ''}`;
    setImportingKey(key);
    try {
      const id = await doImportOnlineFood({
        name: food.name,
        brand: food.brand,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        fiberG: food.fiberG,
        sugarG: food.sugarG,
        sodiumMg: food.sodiumMg,
        barcode: food.barcode,
      });
      setPickerFood({
        id,
        name: food.name,
        brand: food.brand,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        source: 'open_food_facts',
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save online food.');
    } finally {
      setImportingKey(null);
    }
  }

  const visibleFoods = useMemo(() => {
    if (activeTab === 'recent') return recentFoods;
    if (activeTab === 'favorites') return favoriteFoods;
    return results;
  }, [activeTab, favoriteFoods, recentFoods, results]);

  const tabs: Array<{ key: SearchTab; label: string; count: number }> = [
    { key: 'results', label: 'My Foods', count: results.length },
    { key: 'online', label: 'Online', count: onlineResults.length },
    { key: 'recent', label: 'Recent', count: recentFoods.length },
    { key: 'favorites', label: 'Favorites', count: favoriteFoods.length },
    { key: 'templates', label: 'Templates', count: templates.length },
  ];

  async function createOrResolveLogId(): Promise<string> {
    if (logIdParam) return logIdParam;
    const existing = await fetchFoodLogEntries(targetDate) as Array<{ id: string; mealType: string }>;
    const match = existing.find((entry) => entry.mealType === targetMeal);
    if (match) return match.id;

    const nextId = crypto.randomUUID();
    await doCreateFoodLogEntry(nextId, { date: targetDate, mealType: targetMeal });
    return nextId;
  }

  async function handleAddFood() {
    if (!pickerFood) return;
    const count = Number.parseFloat(servingCount) || 1;
    try {
      const logId = await createOrResolveLogId();
      await doAddFoodLogItem(crypto.randomUUID(), {
        logId,
        foodId: pickerFood.id,
        servingCount: count,
        calories: pickerFood.calories * count,
        proteinG: pickerFood.proteinG * count,
        carbsG: pickerFood.carbsG * count,
        fatG: pickerFood.fatG * count,
      });
      setPickerFood(null);
      setServingCount('1');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to add food.');
    }
  }

  async function handleLogTemplate(template: Template) {
    try {
      await doLogMealTemplate(template.id, targetMeal, targetDate);
      setActiveTab('templates');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to log template.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Food Search"
        description={logIdParam
          ? 'Pick a result and send it straight into the diary entry you opened from.'
          : 'Search live foods, revisit recent wins, and drop saved templates into any meal.'}
        action={(
          <>
            <Link href="/nutrition/log">
              <NutritionButton tone="ghost">Open Log Studio</NutritionButton>
            </Link>
            <Link href="/nutrition/restaurants">
              <NutritionButton tone="accent">Restaurants</NutritionButton>
            </Link>
          </>
        )}
      />

      <NutritionPanel tone="focus" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
            <div style={{ position: 'relative' }}>
              <MaterialSymbol
                name="search"
                size={20}
                color={NUTRITION_CHROME.textDim}
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chicken breast, yogurt bowl, overnight oats..."
                style={{ ...inputStyle, width: '100%', paddingLeft: 46 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {searching ? <NutritionBadge color={NUTRITION_CHROME.calorie}>Searching</NutritionBadge> : null}
              <div style={{ minWidth: 170 }}>
                <select value={targetMeal} onChange={(event) => setTargetMeal(event.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {NUTRITION_MEALS.map((meal) => (
                    <option key={meal.key} value={meal.key}>{meal.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <QuickTile href="/nutrition/log" icon="add_circle" label="Custom Food" body="Build your own entry" />
            <QuickTile href="/nutrition/diary" icon="menu_book" label="Open Diary" body="Review grouped meals" />
            <QuickTile href="/nutrition/water" icon="water_drop" label="Hydration" body="Log water and trends" />
            <QuickTile href="/nutrition/restaurants" icon="restaurant" label="Menus" body="Browse restaurant chains" />
          </div>
        </div>
      </NutritionPanel>

      {error ? (
        <NutritionPanel style={{ padding: 16, color: NUTRITION_CHROME.danger }}>
          {error}
        </NutritionPanel>
      ) : null}

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                minHeight: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab.key ? alpha(NUTRITION_CHROME.accent, 0.18) : alpha('#FFFFFF', 0.04),
                color: activeTab === tab.key ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                boxShadow: activeTab === tab.key ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accent, 0.28)}` : 'none',
                fontWeight: 700,
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {activeTab === 'online' ? (
          onlineResults.length > 0 ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {onlineResults.map((food) => {
                const key = `${food.name}|${food.barcode ?? ''}`;
                return (
                  <NutritionPanel key={key} style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 17 }}>{food.name}</strong>
                          <NutritionSourceBadge source="open_food_facts" />
                        </div>
                        <div style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                          {food.brand ? `${food.brand} • ` : ''}{food.servingSize} {food.servingUnit}
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
                          <span style={{ color: NUTRITION_CHROME.calorie }}>{Math.round(food.calories)} kcal</span>
                          <span style={{ color: NUTRITION_CHROME.protein }}>{Math.round(food.proteinG)}g protein</span>
                          <span style={{ color: NUTRITION_CHROME.carbs }}>{Math.round(food.carbsG)}g carbs</span>
                          <span style={{ color: NUTRITION_CHROME.fat }}>{Math.round(food.fatG)}g fat</span>
                        </div>
                      </div>
                      <NutritionButton
                        tone="calorie"
                        onClick={() => void handleImportOnlineFood(food)}
                      >
                        {importingKey === key ? 'Saving...' : 'Save + Add'}
                      </NutritionButton>
                    </div>
                  </NutritionPanel>
                );
              })}
              <div style={{ color: NUTRITION_CHROME.textDim, fontSize: 12 }}>
                Data from Open Food Facts (openfoodfacts.org), licensed under ODbL.
                Values are per 100 g unless the product declares a serving.
              </div>
            </div>
          ) : (
            <NutritionEmptyState
              title={onlineSearching ? 'Searching Open Food Facts...' : 'No online results'}
              description={query.trim().length < 3
                ? 'Type at least 3 characters to search the Open Food Facts database live.'
                : 'Nothing matched on Open Food Facts. Try a different phrase or create a custom food.'}
            />
          )
        ) : activeTab === 'templates' ? (
          templates.length > 0 ? (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {templates.map((template) => (
                <NutritionPanel key={template.id} style={{ padding: 20 }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <strong style={{ fontSize: 18 }}>{template.name}</strong>
                        <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                          {humanizeNutritionValue(template.mealType)} • {template.items.length} items
                        </span>
                      </div>
                      <MaterialSymbol name="inventory_2" size={20} color={NUTRITION_CHROME.accentLight} />
                    </div>
                    <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                      Use a saved meal to rapidly fill the current {humanizeNutritionValue(targetMeal)} slot.
                    </div>
                    <div>
                      <NutritionButton tone="accent" onClick={() => void handleLogTemplate(template)}>Log Template</NutritionButton>
                    </div>
                  </div>
                </NutritionPanel>
              ))}
            </div>
          ) : (
            <NutritionEmptyState
              title="No saved templates yet"
              description="Meal templates appear here after you save recurring breakfasts, lunches, dinners, or snack packs."
            />
          )
        ) : visibleFoods.length > 0 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {visibleFoods.map((food) => {
              const badge = getSourceBadge(food.source);
              return (
                <NutritionPanel key={food.id} style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 17 }}>{food.name}</strong>
                        <NutritionSourceBadge source={food.source} />
                      </div>
                      <div style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                        {food.brand ? `${food.brand} • ` : ''}{food.servingSize} {food.servingUnit}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
                        <span style={{ color: NUTRITION_CHROME.calorie }}>{Math.round(food.calories)} kcal</span>
                        <span style={{ color: NUTRITION_CHROME.protein }}>{Math.round(food.proteinG)}g protein</span>
                        <span style={{ color: NUTRITION_CHROME.carbs }}>{Math.round(food.carbsG)}g carbs</span>
                        <span style={{ color: NUTRITION_CHROME.fat }}>{Math.round(food.fatG)}g fat</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <NutritionBadge color={badge.color} background={alpha(badge.color, 0.12)}>
                        <MaterialSymbol name={badge.icon} size={13} color={badge.color} />
                        {badge.label}
                      </NutritionBadge>
                      <Link href={`/nutrition/food/${food.id}`}>
                        <NutritionButton tone="ghost">Detail</NutritionButton>
                      </Link>
                      <NutritionButton tone="calorie" onClick={() => setPickerFood(food)}>Add</NutritionButton>
                    </div>
                  </div>
                </NutritionPanel>
              );
            })}
          </div>
        ) : (
          <NutritionEmptyState
            title="No foods found"
            description="Try a broader search phrase or switch to recent, favorites, or templates. You can also create a custom item in Log Food."
            action={(
              <Link href="/nutrition/log">
                <NutritionButton tone="calorie">Create Custom Food</NutritionButton>
              </Link>
            )}
          />
        )}
      </div>

      <NutritionModal
        open={pickerFood !== null}
        onClose={() => setPickerFood(null)}
        title={pickerFood ? `Add ${pickerFood.name}` : 'Add food'}
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setPickerFood(null)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleAddFood()}>Log to Meal</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} style={inputStyle} />
          <select value={targetMeal} onChange={(event) => setTargetMeal(event.target.value)} style={inputStyle}>
            {NUTRITION_MEALS.map((meal) => (
              <option key={meal.key} value={meal.key}>{meal.label}</option>
            ))}
          </select>
          <input type="number" min="0.1" step="0.1" value={servingCount} onChange={(event) => setServingCount(event.target.value)} style={inputStyle} />
          {pickerFood ? (
            <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
              Each serving adds {Math.round(pickerFood.calories)} kcal, {Math.round(pickerFood.proteinG)}g protein,
              {` ${Math.round(pickerFood.carbsG)}g carbs, and ${Math.round(pickerFood.fatG)}g fat.`}
            </div>
          ) : null}
        </div>
      </NutritionModal>
    </div>
  );
}

function QuickTile({
  href,
  icon,
  label,
  body,
}: {
  href: string;
  icon: string;
  label: string;
  body: string;
}) {
  return (
    <Link href={href}>
      <NutritionPanel style={{ padding: 18, height: '100%' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ width: 42, height: 42, borderRadius: 16, display: 'grid', placeItems: 'center', background: alpha(NUTRITION_CHROME.accent, 0.14) }}>
            <MaterialSymbol name={icon} size={20} color={NUTRITION_CHROME.accentLight} />
          </div>
          <strong>{label}</strong>
          <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.6 }}>{body}</span>
        </div>
      </NutritionPanel>
    </Link>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 14,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.text,
};

export default function NutritionSearchPage() {
  return (
    <Suspense fallback={null}>
      <NutritionSearchPageContent />
    </Suspense>
  );
}
