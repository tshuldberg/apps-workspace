'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  doAddFoodLogItem,
  doCreateFood,
  doCreateFoodLogEntry,
  doLogMealTemplate,
  doSearchFoods,
  fetchFavoriteFoods,
  fetchFoodLogEntries,
  fetchMealTemplates,
  fetchRecentFoods,
} from '../actions';
import { NUTRITION_CHROME, NUTRITION_MEALS, alpha } from '../_lib/design';
import {
  MaterialSymbol,
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function NutritionLogPageContent() {
  const params = useSearchParams();
  const initialMeal = params.get('meal') ?? 'breakfast';

  const [mealType, setMealType] = useState(initialMeal);
  const [date, setDate] = useState(todayIso);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [recentFoods, setRecentFoods] = useState<Food[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [servingCount, setServingCount] = useState('1');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFood, setCustomFood] = useState({
    name: '',
    brand: '',
    servingSize: '1',
    servingUnit: 'serving',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
  });
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchRecentFoods(16), fetchFavoriteFoods(16), fetchMealTemplates()])
      .then(([recent, favorites, mealTemplates]) => {
        setRecentFoods(recent as Food[]);
        setFavoriteFoods(favorites as Food[]);
        setTemplates(mealTemplates);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Failed to load logging rails.');
      });
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      doSearchFoods(trimmed, 24)
        .then((foods) => setResults(foods as Food[]))
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : 'Search failed.');
        })
        .finally(() => setSearching(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const combinedRails = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...recentFoods, ...favoriteFoods];
    return merged.filter((food) => {
      if (seen.has(food.id)) return false;
      seen.add(food.id);
      return true;
    });
  }, [favoriteFoods, recentFoods]);

  async function resolveLogId() {
    const existing = await fetchFoodLogEntries(date) as Array<{ id: string; mealType: string }>;
    const match = existing.find((entry) => entry.mealType === mealType);
    if (match) return match.id;
    const nextId = crypto.randomUUID();
    await doCreateFoodLogEntry(nextId, { date, mealType });
    return nextId;
  }

  async function handleAddFood(food: Food, count: number) {
    try {
      const logId = await resolveLogId();
      await doAddFoodLogItem(crypto.randomUUID(), {
        logId,
        foodId: food.id,
        servingCount: count,
        calories: food.calories * count,
        proteinG: food.proteinG * count,
        carbsG: food.carbsG * count,
        fatG: food.fatG * count,
      });
      setSelectedFood(null);
      setServingCount('1');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to add this food.');
    }
  }

  async function handleCreateCustomFood() {
    if (!customFood.name.trim() || !customFood.calories.trim()) {
      setError('Custom foods need at least a name and calories.');
      return;
    }

    try {
      const nextId = crypto.randomUUID();
      const createdFood: Food = {
        id: nextId,
        name: customFood.name.trim(),
        brand: customFood.brand.trim() || null,
        servingSize: Number.parseFloat(customFood.servingSize) || 1,
        servingUnit: customFood.servingUnit,
        calories: Number.parseFloat(customFood.calories) || 0,
        proteinG: Number.parseFloat(customFood.proteinG) || 0,
        carbsG: Number.parseFloat(customFood.carbsG) || 0,
        fatG: Number.parseFloat(customFood.fatG) || 0,
        source: 'custom',
      };
      await doCreateFood(nextId, {
        name: createdFood.name,
        brand: createdFood.brand ?? undefined,
        servingSize: createdFood.servingSize,
        servingUnit: createdFood.servingUnit,
        calories: createdFood.calories,
        proteinG: createdFood.proteinG,
        carbsG: createdFood.carbsG,
        fatG: createdFood.fatG,
        source: 'custom',
      });
      await handleAddFood(createdFood, 1);
      setCustomFood({
        name: '',
        brand: '',
        servingSize: '1',
        servingUnit: 'serving',
        calories: '',
        proteinG: '',
        carbsG: '',
        fatG: '',
      });
      setShowCustomModal(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create custom food.');
    }
  }

  async function handleLogTemplate(template: Template) {
    try {
      await doLogMealTemplate(template.id, mealType, date);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to log meal template.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Log Food"
        description="Pick a meal, search the nutrition library, drop in favorites and templates, or create a custom item from scratch."
        action={(
          <>
            <Link href="/nutrition/search">
              <NutritionButton tone="ghost">Open Search</NutritionButton>
            </Link>
            <NutritionButton tone="calorie" onClick={() => setShowCustomModal(true)}>Custom Food</NutritionButton>
          </>
        )}
      />

      <NutritionPanel tone="focus" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {NUTRITION_MEALS.map((meal) => (
              <button
                key={meal.key}
                type="button"
                onClick={() => setMealType(meal.key)}
                style={{
                  minHeight: 40,
                  padding: '0 16px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  background: mealType === meal.key ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.04),
                  color: mealType === meal.key ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                  boxShadow: mealType === meal.key ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accent, 0.24)}` : 'none',
                  fontWeight: 700,
                }}
              >
                {meal.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr) 180px auto' }}>
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
                placeholder={`Search foods for ${mealType}...`}
                style={{ ...inputStyle, width: '100%', paddingLeft: 46 }}
              />
            </div>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
            <NutritionButton tone="ghost" onClick={() => setShowCustomModal(true)}>Create</NutritionButton>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <QuickTile href="/nutrition/search" icon="search" label="Deep Search" body="Browse every food source" />
            <QuickTile href="/nutrition/water" icon="water_drop" label="Water" body="Log hydration alongside meals" />
            <QuickTile href="/nutrition/restaurants" icon="restaurant" label="Menus" body="Bring in restaurant items" />
            <QuickTile href="/nutrition/diary" icon="menu_book" label="Diary" body="Review today’s grouped meals" />
          </div>
        </div>
      </NutritionPanel>

      {error ? (
        <NutritionPanel style={{ padding: 16, color: NUTRITION_CHROME.danger }}>{error}</NutritionPanel>
      ) : null}

      {searching ? (
        <NutritionPanel style={{ padding: 18 }}>Searching the nutrition library...</NutritionPanel>
      ) : null}

      {results.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {results.map((food) => (
            <FoodCard key={food.id} food={food} onAdd={() => setSelectedFood(food)} />
          ))}
        </div>
      ) : null}

      {combinedRails.length > 0 ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Recents & Favorites</div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {combinedRails.map((food) => (
              <FoodCard key={food.id} food={food} compact onAdd={() => setSelectedFood(food)} />
            ))}
          </div>
        </section>
      ) : null}

      {templates.length > 0 ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Meal Templates</div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {templates.map((template) => (
              <NutritionPanel key={template.id} style={{ padding: 18 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <strong>{template.name}</strong>
                  <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                    {template.items.length} items saved for {template.mealType}.
                  </span>
                  <div>
                    <NutritionButton tone="accent" onClick={() => void handleLogTemplate(template)}>Log Template</NutritionButton>
                  </div>
                </div>
              </NutritionPanel>
            ))}
          </div>
        </section>
      ) : (
        <NutritionEmptyState
          title="No template library yet"
          description="Once you save recurring breakfasts, lunches, dinners, or snack packs, they will appear here for one-click logging."
        />
      )}

      <NutritionModal
        open={selectedFood !== null}
        onClose={() => setSelectedFood(null)}
        title={selectedFood ? `Add ${selectedFood.name}` : 'Add food'}
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setSelectedFood(null)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => selectedFood && void handleAddFood(selectedFood, Number.parseFloat(servingCount) || 1)}>Log to Meal</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input type="number" min="0.1" step="0.1" value={servingCount} onChange={(event) => setServingCount(event.target.value)} style={inputStyle} />
          {selectedFood ? (
            <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
              Adds {(selectedFood.calories * (Number.parseFloat(servingCount) || 1)).toFixed(0)} kcal to {mealType}.
            </div>
          ) : null}
        </div>
      </NutritionModal>

      <NutritionModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="Create Custom Food"
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setShowCustomModal(false)}>Cancel</NutritionButton>
            <NutritionButton tone="calorie" onClick={() => void handleCreateCustomFood()}>Create & Log</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input placeholder="Food name" value={customFood.name} onChange={(event) => setCustomFood((current) => ({ ...current, name: event.target.value }))} style={inputStyle} />
          <input placeholder="Brand" value={customFood.brand} onChange={(event) => setCustomFood((current) => ({ ...current, brand: event.target.value }))} style={inputStyle} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Serving size" value={customFood.servingSize} onChange={(event) => setCustomFood((current) => ({ ...current, servingSize: event.target.value }))} style={inputStyle} />
            <input placeholder="Serving unit" value={customFood.servingUnit} onChange={(event) => setCustomFood((current) => ({ ...current, servingUnit: event.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <input placeholder="kcal" value={customFood.calories} onChange={(event) => setCustomFood((current) => ({ ...current, calories: event.target.value }))} style={inputStyle} />
            <input placeholder="Protein" value={customFood.proteinG} onChange={(event) => setCustomFood((current) => ({ ...current, proteinG: event.target.value }))} style={inputStyle} />
            <input placeholder="Carbs" value={customFood.carbsG} onChange={(event) => setCustomFood((current) => ({ ...current, carbsG: event.target.value }))} style={inputStyle} />
            <input placeholder="Fat" value={customFood.fatG} onChange={(event) => setCustomFood((current) => ({ ...current, fatG: event.target.value }))} style={inputStyle} />
          </div>
        </div>
      </NutritionModal>
    </div>
  );
}

function FoodCard({
  food,
  compact = false,
  onAdd,
}: {
  food: Food;
  compact?: boolean;
  onAdd: () => void;
}) {
  return (
    <NutritionPanel style={{ padding: compact ? 16 : 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong>{food.name}</strong>
            <NutritionSourceBadge source={food.source} />
          </div>
          <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
            {food.brand ? `${food.brand} • ` : ''}{food.servingSize} {food.servingUnit}
          </span>
          <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
            <span style={{ color: NUTRITION_CHROME.calorie }}>{Math.round(food.calories)} kcal</span>
            {` • ${Math.round(food.proteinG)}g P • ${Math.round(food.carbsG)}g C • ${Math.round(food.fatG)}g F`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/nutrition/food/${food.id}`}>
            <NutritionButton tone="ghost">Detail</NutritionButton>
          </Link>
          <NutritionButton tone="accent" onClick={onAdd}>Add</NutritionButton>
        </div>
      </div>
    </NutritionPanel>
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

export default function NutritionLogPage() {
  return (
    <Suspense fallback={null}>
      <NutritionLogPageContent />
    </Suspense>
  );
}
