'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  doCreateRestaurant,
  doSearchRestaurants,
  fetchAllRestaurants,
  fetchPopularChains,
} from '../actions';
import { NUTRITION_CHROME, alpha, humanizeNutritionValue } from '../_lib/design';
import {
  MaterialSymbol,
  NutritionButton,
  NutritionEmptyState,
  NutritionModal,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type Restaurant = Awaited<ReturnType<typeof fetchAllRestaurants>>[number];

const CATEGORIES = ['all', 'fast_food', 'casual', 'fine_dining', 'cafe', 'pizza', 'asian', 'mexican', 'other'] as const;

export default function NutritionRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [popular, setPopular] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'casual', logoEmoji: '🍽️', website: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAllRestaurants(200), fetchPopularChains(24)])
      .then(([all, chains]) => {
        setRestaurants(all as Restaurant[]);
        setPopular(chains as Restaurant[]);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Failed to load restaurants.');
      });
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      doSearchRestaurants(query.trim())
        .then((rows) => setRestaurants(rows as Restaurant[]))
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Search failed.'));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const visible = useMemo(() => {
    return restaurants.filter((restaurant) => category === 'all' || restaurant.category === category);
  }, [category, restaurants]);

  async function handleCreate() {
    if (!form.name.trim()) {
      setError('Restaurant name is required.');
      return;
    }
    try {
      await doCreateRestaurant(crypto.randomUUID(), {
        name: form.name.trim(),
        category: form.category as Exclude<typeof category, 'all'>,
        logoEmoji: form.logoEmoji || '🍽️',
        website: form.website.trim() || undefined,
        chain: false,
      });
      setShowModal(false);
      setForm({ name: '', category: 'casual', logoEmoji: '🍽️', website: '' });
      const refreshed = await fetchAllRestaurants(200);
      setRestaurants(refreshed as Restaurant[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create restaurant.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Restaurants"
        description="Search chains, filter the menu library by cuisine, and add your own local spots when the default list is not enough."
        action={<NutritionButton tone="accent" onClick={() => setShowModal(true)}>Add Restaurant</NutritionButton>}
      />

      <NutritionPanel tone="focus" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chains and local restaurants..."
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                style={{
                  minHeight: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  background: option === category ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.04),
                  color: option === category ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                  boxShadow: option === category ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accent, 0.24)}` : 'none',
                  fontWeight: 700,
                }}
              >
                {option === 'all' ? 'All categories' : humanizeNutritionValue(option)}
              </button>
            ))}
          </div>
        </div>
      </NutritionPanel>

      {error ? <NutritionPanel style={{ padding: 16, color: NUTRITION_CHROME.danger }}>{error}</NutritionPanel> : null}

      {popular.length > 0 ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Popular chains</div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {popular.slice(0, 6).map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      ) : null}

      {visible.length > 0 ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>All restaurants</div>
          <div style={{ display: 'grid', gap: 14 }}>
            {visible.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} horizontal />
            ))}
          </div>
        </section>
      ) : (
        <NutritionEmptyState
          title="No restaurants match the current filter"
          description="Adjust the search or add a local favorite to start building your menu library."
          action={<NutritionButton tone="accent" onClick={() => setShowModal(true)}>Add Restaurant</NutritionButton>}
        />
      )}

      <NutritionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add Restaurant"
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setShowModal(false)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleCreate()}>Save Restaurant</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input placeholder="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} style={inputStyle} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '120px 1fr' }}>
            <input placeholder="Emoji" value={form.logoEmoji} onChange={(event) => setForm((current) => ({ ...current, logoEmoji: event.target.value }))} style={inputStyle} />
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} style={inputStyle}>
              {CATEGORIES.filter((option) => option !== 'all').map((option) => (
                <option key={option} value={option}>{humanizeNutritionValue(option)}</option>
              ))}
            </select>
          </div>
          <input placeholder="Website" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} style={inputStyle} />
        </div>
      </NutritionModal>
    </div>
  );
}

function RestaurantCard({
  restaurant,
  horizontal = false,
}: {
  restaurant: Restaurant;
  horizontal?: boolean;
}) {
  return (
    <Link href={`/nutrition/restaurants/${restaurant.id}`}>
      <NutritionPanel style={{ padding: 18, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', justifyContent: 'space-between', gap: 14, alignItems: horizontal ? 'center' : 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, display: 'grid', placeItems: 'center', background: alpha(NUTRITION_CHROME.accent, 0.14), fontSize: 24 }}>
              {restaurant.logoEmoji ?? '🍽️'}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <strong style={{ fontSize: 17 }}>{restaurant.name}</strong>
              <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                {humanizeNutritionValue(restaurant.category)} • {restaurant.chain ? 'Chain' : 'Local'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: NUTRITION_CHROME.textMuted }}>
            <MaterialSymbol name="chevron_right" size={18} />
          </div>
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
