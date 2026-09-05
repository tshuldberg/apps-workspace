'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchRestaurants, updateRestaurantAction } from './actions';

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  cuisines: string | null;
  price_tier: number | null;
  average_rating: number | null;
  visit_count: number;
  is_wishlist: number;
  is_visited: number;
  photo_id: string | null;
  created_at: string;
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.12)';
const ACCENT_BORDER = 'rgba(220,38,38,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

type StatusFilter = 'all' | 'visited' | 'wishlist';
type SortOption = 'created_at' | 'visit_count' | 'average_rating' | 'name';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'created_at', label: 'Recently Added' },
  { key: 'visit_count', label: 'Most Visited' },
  { key: 'average_rating', label: 'Highest Rated' },
  { key: 'name', label: 'Alphabetical' },
];

function parseCuisines(cuisines: string | null): string[] {
  if (!cuisines) return [];
  try {
    return JSON.parse(cuisines);
  } catch {
    return [cuisines];
  }
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  return (
    <span style={{ color: '#FFB877', fontSize: 13, letterSpacing: 1 }}>
      {'★'.repeat(full)}
      {half ? '★' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

export default function DiningPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [loading, setLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch restaurants
  const loadRestaurants = useCallback(async () => {
    try {
      const filters: Record<string, unknown> = {
        sort_by: sortBy,
        sort_dir: sortBy === 'name' ? 'ASC' : 'DESC',
        limit: 500,
      };
      if (debouncedSearch) filters.search = debouncedSearch;
      if (statusFilter === 'visited') filters.is_visited = 1;
      if (statusFilter === 'wishlist') filters.is_wishlist = 1;
      if (priceFilter) {
        filters.price_tier_min = priceFilter;
        filters.price_tier_max = priceFilter;
      }
      const data = await fetchRestaurants(filters);
      setRestaurants(data as Restaurant[]);
    } catch (err) {
      console.error('[Dining] Failed to fetch restaurants', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, priceFilter, sortBy]);

  useEffect(() => {
    void loadRestaurants();
  }, [loadRestaurants]);

  const toggleWishlist = async (r: Restaurant) => {
    try {
      await updateRestaurantAction(r.id, {
        is_wishlist: r.is_wishlist ? 0 : 1,
      });
      void loadRestaurants();
    } catch (err) {
      console.error('[Dining] Failed to toggle wishlist', err);
    }
  };

  const hasActiveFilters = debouncedSearch || statusFilter !== 'all' || priceFilter !== null;

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: TEXT_SEC }}>Loading restaurants...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={eyebrowStyle}>Restaurants</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 800, color: TEXT }}>
            MyDining
          </h1>
        </div>
        <Link
          href="/dining/restaurant/add"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 14,
            background: ACCENT,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          + Add Restaurant
        </Link>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search restaurants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
            color: TEXT,
            fontSize: 15,
            outline: 'none',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {(['all', 'visited', 'wishlist'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              border: statusFilter === s ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
              backgroundColor: statusFilter === s ? ACCENT : 'transparent',
              color: statusFilter === s ? '#FFFFFF' : TEXT_SEC,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {s === 'all' ? 'All' : s === 'visited' ? 'Visited' : 'Wishlist'}
          </button>
        ))}

        {[1, 2, 3, 4].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriceFilter(priceFilter === p ? null : p)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: priceFilter === p ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
              backgroundColor: priceFilter === p ? ACCENT : 'transparent',
              color: priceFilter === p ? '#FFFFFF' : TEXT_SEC,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {PRICE_LABELS[p]}
          </button>
        ))}

        <div style={{ marginLeft: 'auto' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              backgroundColor: GLASS,
              color: TEXT_SEC,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Restaurant grid */}
      {restaurants.length === 0 ? (
        <div
          style={{
            padding: 48,
            borderRadius: 20,
            border: hasActiveFilters ? `1px dashed ${BORDER}` : `1px dashed ${ACCENT_BORDER}`,
            backgroundColor: GLASS,
            textAlign: 'center',
          }}
        >
          {hasActiveFilters ? (
            <>
              <p style={{ fontSize: 32, marginBottom: 8 }}>{'\uD83D\uDD0D'}</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>No restaurants match</p>
              <p style={{ color: TEXT_SEC, marginTop: 8 }}>
                Adjust your search or filters to find what you are looking for.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setStatusFilter('all');
                  setPriceFilter(null);
                }}
                style={{
                  marginTop: 16,
                  padding: '10px 20px',
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  backgroundColor: 'transparent',
                  color: TEXT,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 48, marginBottom: 8 }}>{'\uD83C\uDF7D\uFE0F'}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>Your restaurant journal</p>
              <p style={{ color: TEXT_SEC, marginTop: 8 }}>
                Track your favorite spots, log visits, and remember every great meal.
              </p>
              <Link
                href="/dining/restaurant/add"
                style={{
                  display: 'inline-block',
                  marginTop: 16,
                  padding: '12px 24px',
                  borderRadius: 12,
                  backgroundColor: ACCENT,
                  color: '#FFFFFF',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Add your first restaurant
              </Link>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {restaurants.map((r) => {
            const cuisines = parseCuisines(r.cuisines);
            return (
              <Link
                key={r.id}
                href={`/dining/restaurant/${r.id}`}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  textDecoration: 'none',
                  color: TEXT,
                  position: 'relative',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    backgroundColor: r.photo_id ? ACCENT : '#2A292F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    flexShrink: 0,
                  }}
                >
                  {'\uD83C\uDF7D\uFE0F'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, display: 'grid', gap: 4, minWidth: 0 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.name}
                  </h3>
                  {(r.neighborhood || r.city) && (
                    <p style={{
                      margin: 0,
                      fontSize: 13,
                      color: TEXT_SEC,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {[r.neighborhood, r.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2 }}>
                    {r.price_tier && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                        {PRICE_LABELS[r.price_tier]}
                      </span>
                    )}
                    {r.average_rating != null && <Stars rating={r.average_rating} />}
                    {r.visit_count > 0 && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: TEXT_SEC,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}>
                        {r.visit_count} visit{r.visit_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {cuisines.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {cuisines.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: ACCENT,
                            backgroundColor: ACCENT_DIM,
                            padding: '3px 8px',
                            borderRadius: 999,
                          }}
                        >
                          {c}
                        </span>
                      ))}
                      {cuisines.length > 3 && (
                        <span style={{ fontSize: 11, color: TEXT_SEC }}>
                          +{cuisines.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Wishlist toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void toggleWishlist(r);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 20,
                    padding: 4,
                    alignSelf: 'flex-start',
                    color: r.is_wishlist ? ACCENT : TEXT_SEC,
                  }}
                >
                  {r.is_wishlist ? '\u2764\uFE0F' : '\u2661'}
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {/* Year in Review CTA */}
      <Link
        href="/dining/year-review"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          borderRadius: 16,
          backgroundColor: ACCENT_DIM,
          border: `1px solid ${ACCENT_BORDER}`,
          textDecoration: 'none',
          color: TEXT,
        }}
      >
        <span style={{ fontSize: 28 }}>{'\uD83C\uDF1F'}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>Year in Review</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>
            See your dining highlights for the year
          </p>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>{'>'}</span>
      </Link>

      {/* Map link */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Link
          href="/dining/map"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            backgroundColor: GLASS,
            color: TEXT_SEC,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          {'\uD83D\uDDFA\uFE0F'} View on Map
        </Link>
      </div>
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};
