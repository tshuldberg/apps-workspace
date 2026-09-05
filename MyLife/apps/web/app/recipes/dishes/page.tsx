'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  searchDishesAction,
  getDishCategoriesAction,
  getCuisinesAction,
} from '../cloud-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DishSummary {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  category: string;
  cuisine: string;
  region: string | null;
  description: string | null;
  photoUrl: string | null;
  submissionCount: number;
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
} as const;

const CATEGORIES = [
  'appetizer', 'soup', 'salad', 'main', 'side', 'dessert',
  'bread', 'beverage', 'condiment', 'snack', 'breakfast',
] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  appetizer: '\u{1F960}',
  soup: '\u{1F35C}',
  salad: '\u{1F957}',
  main: '\u{1F356}',
  side: '\u{1F954}',
  dessert: '\u{1F370}',
  bread: '\u{1F35E}',
  beverage: '\u{1F376}',
  condiment: '\u{1F9C2}',
  snack: '\u{1F36A}',
  breakfast: '\u{1F373}',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DishBrowserPage() {
  const [dishes, setDishes] = useState<DishSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 24;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const offset = reset ? 0 : page * PAGE_SIZE;
      const result = await searchDishesAction(query, {
        category: selectedCategory ?? undefined,
        cuisine: selectedCuisine ?? undefined,
      });
      if (result.ok && result.data) {
        const items = result.data as DishSummary[];
        if (reset) {
          setDishes(items.slice(0, PAGE_SIZE));
          setPage(0);
        } else {
          setDishes(items.slice(0, (page + 1) * PAGE_SIZE));
        }
        setHasMore(items.length > (reset ? PAGE_SIZE : (page + 1) * PAGE_SIZE));
      }
    } catch (err) {
      console.error('[dishes] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, selectedCuisine, page]);

  // Load cuisines list once
  useEffect(() => {
    getCuisinesAction().then((r) => {
      if (r.ok && r.data) setCuisines(r.data);
    });
  }, []);

  // Load dishes on filter/search change
  useEffect(() => {
    load(true);
  }, [query, selectedCategory, selectedCuisine]);

  const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(value);
    }, 300);
  };

  const loadMore = () => {
    setPage((p) => p + 1);
    load(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link
          href="/recipes"
          style={{
            color: T.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            marginBottom: 16,
            display: 'inline-block',
          }}
        >
          &#x2190; Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Dish Browser
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          Explore dishes from around the world and discover the best recipes.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search dishes by name, cuisine, or description..."
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 9999,
            border: 'none',
            background: T.lift,
            color: T.text,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '8px 16px',
              borderRadius: 9999,
              border: 'none',
              background: selectedCategory === null ? T.accent : T.lift,
              color: selectedCategory === null ? '#131318' : T.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              style={{
                padding: '8px 16px',
                borderRadius: 9999,
                border: 'none',
                background: selectedCategory === cat ? T.accent : T.lift,
                color: selectedCategory === cat ? '#131318' : T.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {CATEGORY_EMOJI[cat] ?? ''} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Cuisine dropdown */}
        <select
          value={selectedCuisine ?? ''}
          onChange={(e) => setSelectedCuisine(e.target.value || null)}
          style={{
            padding: '8px 16px',
            borderRadius: 9999,
            border: 'none',
            background: T.lift,
            color: T.text,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            minWidth: 160,
          }}
        >
          <option value="">All Cuisines</option>
          {cuisines.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      {loading && dishes.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading dishes...
        </div>
      ) : dishes.length === 0 ? (
        <div style={{
          padding: '80px 0',
          textAlign: 'center',
          color: T.dimText,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F50D}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: T.text }}>No dishes found</div>
          <div style={{ fontSize: 14 }}>
            Try adjusting your search or filters.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {dishes.map((dish) => (
              <Link
                key={dish.id}
                href={`/recipes/dishes/${dish.slug}`}
                style={{
                  background: T.lift,
                  borderRadius: 16,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.2s, background 0.2s',
                  display: 'block',
                }}
              >
                {/* Photo */}
                <div style={{
                  aspectRatio: '16/10',
                  background: `linear-gradient(135deg, ${T.focus} 0%, ${T.highest} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {dish.photoUrl ? (
                    <img
                      src={dish.photoUrl}
                      alt={dish.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span>{CATEGORY_EMOJI[dish.category] ?? '\u{1F372}'}</span>
                  )}
                  {/* Category badge */}
                  <span style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: 'rgba(19,19,24,0.7)',
                    backdropFilter: 'blur(12px)',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: T.accent,
                  }}>
                    {dish.category}
                  </span>
                </div>

                {/* Content */}
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: T.goldLight, marginBottom: 4 }}>
                    {dish.cuisine}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: T.text }}>
                    {dish.name}
                  </div>
                  {dish.nativeName && (
                    <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8, fontStyle: 'italic' }}>
                      {dish.nativeName}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.textSecondary }}>
                      {dish.submissionCount} {dish.submissionCount === 1 ? 'recipe' : 'recipes'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                style={{
                  padding: '12px 32px',
                  borderRadius: 9999,
                  border: 'none',
                  background: T.focus,
                  color: T.text,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
