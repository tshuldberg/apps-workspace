'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  doCreateFoodLogEntry,
  doCreateMenuItem,
  doLogMenuItemAsMeal,
  fetchFoodLogEntries,
  fetchMenuItems,
  fetchRestaurantById,
} from '../../actions';
import { NUTRITION_CHROME, NUTRITION_MEALS, alpha, humanizeNutritionValue } from '../../_lib/design';
import {
  NutritionButton,
  NutritionEmptyState,
  NutritionModal,
  NutritionPageHeader,
  NutritionPanel,
} from '../../_components/NutritionPrimitives';

type Restaurant = Awaited<ReturnType<typeof fetchRestaurantById>>;
type MenuItem = Awaited<ReturnType<typeof fetchMenuItems>>[number];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionRestaurantDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [targetItem, setTargetItem] = useState<MenuItem | null>(null);
  const [targetDate, setTargetDate] = useState(todayIso);
  const [targetMeal, setTargetMeal] = useState('dinner');
  const [servingCount, setServingCount] = useState('1');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    category: '',
    servingSize: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [details, items] = await Promise.all([fetchRestaurantById(id), fetchMenuItems(id)]);
      setRestaurant(details);
      setMenuItems(items as MenuItem[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load restaurant.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedItems = useMemo(() => {
    return menuItems.reduce<Record<string, MenuItem[]>>((accumulator, item) => {
      const category = item.category || 'Signature';
      accumulator[category] ??= [];
      accumulator[category].push(item);
      return accumulator;
    }, {});
  }, [menuItems]);

  async function resolveLogId() {
    const entries = await fetchFoodLogEntries(targetDate) as Array<{ id: string; mealType: string }>;
    const match = entries.find((entry) => entry.mealType === targetMeal);
    if (match) return match.id;
    const nextId = crypto.randomUUID();
    await doCreateFoodLogEntry(nextId, { date: targetDate, mealType: targetMeal });
    return nextId;
  }

  async function handleLogMenuItem() {
    if (!restaurant || !targetItem) return;
    try {
      const logId = await resolveLogId();
      await doLogMenuItemAsMeal(
        { foodId: crypto.randomUUID(), logItemId: crypto.randomUUID() },
        {
          menuItem: targetItem,
          restaurantName: restaurant.name,
          logId,
          servingCount: Number.parseFloat(servingCount) || 1,
        },
      );
      setTargetItem(null);
      setServingCount('1');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to log menu item.');
    }
  }

  async function handleCreateMenuItem() {
    if (!newItem.name.trim() || !newItem.calories.trim()) {
      setError('Menu items need at least a name and calories.');
      return;
    }
    try {
      await doCreateMenuItem(crypto.randomUUID(), {
        restaurantId: id,
        name: newItem.name.trim(),
        description: newItem.description.trim() || undefined,
        category: newItem.category.trim() || undefined,
        servingSize: newItem.servingSize.trim() || undefined,
        calories: Number.parseFloat(newItem.calories) || 0,
        proteinG: Number.parseFloat(newItem.proteinG) || 0,
        carbsG: Number.parseFloat(newItem.carbsG) || 0,
        fatG: Number.parseFloat(newItem.fatG) || 0,
      });
      setShowCreateModal(false);
      setNewItem({
        name: '',
        description: '',
        category: '',
        servingSize: '',
        calories: '',
        proteinG: '',
        carbsG: '',
        fatG: '',
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create menu item.');
    }
  }

  if (!restaurant) {
    return (
      <NutritionEmptyState
        title="Restaurant not found"
        description={error ?? 'The requested restaurant could not be loaded.'}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title={restaurant.name}
        description={`${humanizeNutritionValue(restaurant.category)} • ${restaurant.chain ? 'Chain menu' : 'Local menu'} • ${menuItems.length} menu items available`}
        action={<NutritionButton tone="accent" onClick={() => setShowCreateModal(true)}>Add Menu Item</NutritionButton>}
      />

      <NutritionPanel tone="focus" style={{ padding: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 86, height: 86, borderRadius: 28, display: 'grid', placeItems: 'center', background: alpha(NUTRITION_CHROME.accent, 0.16), fontSize: 40 }}>
              {restaurant.logoEmoji ?? '🍽️'}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                Browse menu items by category, then send any pick straight to breakfast, lunch, dinner, or snacks.
              </span>
              {restaurant.website ? (
                <a href={restaurant.website} target="_blank" rel="noreferrer" style={{ color: NUTRITION_CHROME.accentLight }}>
                  Visit website
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </NutritionPanel>

      {error ? <NutritionPanel style={{ padding: 16, color: NUTRITION_CHROME.danger }}>{error}</NutritionPanel> : null}

      {Object.keys(groupedItems).length > 0 ? (
        <div style={{ display: 'grid', gap: 18 }}>
          {Object.entries(groupedItems).map(([category, items]) => (
            <section key={category} style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{category}</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {items.map((item) => (
                  <NutritionPanel key={item.id} style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <strong>{item.name}</strong>
                        <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                          {item.description || 'No description provided'}
                        </span>
                        <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
                          {item.servingSize || 'Standard serving'} • {Math.round(item.calories)} kcal •
                          {` ${Math.round(item.proteinG)}g P • ${Math.round(item.carbsG)}g C • ${Math.round(item.fatG)}g F`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <NutritionButton tone="calorie" onClick={() => setTargetItem(item)}>Add to Meal</NutritionButton>
                      </div>
                    </div>
                  </NutritionPanel>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <NutritionEmptyState
          title="No menu items yet"
          description="Add a first menu item to start logging restaurant meals into the diary."
          action={<NutritionButton tone="accent" onClick={() => setShowCreateModal(true)}>Add Menu Item</NutritionButton>}
        />
      )}

      <NutritionModal
        open={targetItem !== null}
        onClose={() => setTargetItem(null)}
        title={targetItem ? `Add ${targetItem.name}` : 'Add menu item'}
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setTargetItem(null)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleLogMenuItem()}>Log Item</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} style={inputStyle} />
          <select value={targetMeal} onChange={(event) => setTargetMeal(event.target.value)} style={inputStyle}>
            {NUTRITION_MEALS.map((meal) => (
              <option key={meal.key} value={meal.key}>{meal.label}</option>
            ))}
          </select>
          <input type="number" min="0.1" step="0.1" value={servingCount} onChange={(event) => setServingCount(event.target.value)} style={inputStyle} />
        </div>
      </NutritionModal>

      <NutritionModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Menu Item"
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setShowCreateModal(false)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleCreateMenuItem()}>Save Item</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input placeholder="Name" value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} style={inputStyle} />
          <input placeholder="Description" value={newItem.description} onChange={(event) => setNewItem((current) => ({ ...current, description: event.target.value }))} style={inputStyle} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Category" value={newItem.category} onChange={(event) => setNewItem((current) => ({ ...current, category: event.target.value }))} style={inputStyle} />
            <input placeholder="Serving size" value={newItem.servingSize} onChange={(event) => setNewItem((current) => ({ ...current, servingSize: event.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <input placeholder="kcal" value={newItem.calories} onChange={(event) => setNewItem((current) => ({ ...current, calories: event.target.value }))} style={inputStyle} />
            <input placeholder="Protein" value={newItem.proteinG} onChange={(event) => setNewItem((current) => ({ ...current, proteinG: event.target.value }))} style={inputStyle} />
            <input placeholder="Carbs" value={newItem.carbsG} onChange={(event) => setNewItem((current) => ({ ...current, carbsG: event.target.value }))} style={inputStyle} />
            <input placeholder="Fat" value={newItem.fatG} onChange={(event) => setNewItem((current) => ({ ...current, fatG: event.target.value }))} style={inputStyle} />
          </div>
        </div>
      </NutritionModal>
    </div>
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
