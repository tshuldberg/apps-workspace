'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getTopDishesAction,
  getTrendingDishesAction,
  getDishCategoriesAction,
} from '../cloud-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DishEntry {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  category: string;
  cuisine: string;
  region: string | null;
  photoUrl: string | null;
  submissionCount: number;
}

type Tab = 'top' | 'trending' | 'category';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  accentLight: '#4ADE80',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
} as const;

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

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('top');
  const [dishes, setDishes] = useState<DishEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load categories once
  useEffect(() => {
    getDishCategoriesAction().then((r) => {
      if (r.ok && r.data) setCategories(r.data);
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let result;
      if (activeTab === 'top') {
        result = await getTopDishesAction({ limit: 30 });
      } else if (activeTab === 'trending') {
        result = await getTrendingDishesAction({ limit: 30 });
      } else {
        result = await getTopDishesAction({
          category: selectedCategory ?? undefined,
          limit: 30,
        });
      }
      if (result.ok && result.data) {
        setDishes(result.data as unknown as DishEntry[]);
      }
    } catch (err) {
      console.error('[leaderboard] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------------------------------------------------------- */
  /*  Tab styles                                                       */
  /* ---------------------------------------------------------------- */

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 24px',
    borderRadius: 9999,
    border: 'none',
    background: active ? T.accent : T.surfaceLow,
    color: active ? '#131318' : T.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

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
          {'\u{1F3C6}'} Global Leaderboard
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          The most popular dishes and recipes from around the world.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setActiveTab('top')}
          style={tabStyle(activeTab === 'top')}
        >
          Top Dishes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trending')}
          style={tabStyle(activeTab === 'trending')}
        >
          Trending
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('category')}
          style={tabStyle(activeTab === 'category')}
        >
          By Category
        </button>
      </div>

      {/* Category filter (for By Category tab) */}
      {activeTab === 'category' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              border: 'none',
              background: selectedCategory === null ? T.goldLight : T.surfaceLow,
              color: selectedCategory === null ? '#131318' : T.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                border: 'none',
                background: selectedCategory === cat ? T.goldLight : T.surfaceLow,
                color: selectedCategory === cat ? '#131318' : T.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {CATEGORY_EMOJI[cat] ?? ''} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading leaderboard...
        </div>
      ) : dishes.length === 0 ? (
        <div style={{
          padding: '80px 0',
          textAlign: 'center',
          color: T.dimText,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F3C6}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            No dishes yet
          </div>
          <div style={{ fontSize: 14 }}>
            Be the first to explore and submit recipes.
          </div>
          <Link
            href="/recipes/dishes"
            style={{
              display: 'inline-block',
              marginTop: 16,
              color: T.accent,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Browse Dishes
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dishes.map((dish, idx) => {
            const rank = idx + 1;
            const isTopThree = rank <= 3;

            return (
              <Link
                key={dish.id}
                href={`/recipes/dishes/${dish.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  borderRadius: 16,
                  background: T.surfaceLow,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.2s',
                }}
              >
                {/* Rank */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 9999,
                  background: isTopThree ? RANK_COLORS[rank - 1] : T.surfaceHigh,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 800,
                  color: isTopThree ? '#131318' : T.text,
                  flexShrink: 0,
                }}>
                  {rank}
                </div>

                {/* Photo */}
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: T.surfaceHigh,
                  flexShrink: 0,
                }}>
                  {dish.photoUrl ? (
                    <img
                      src={dish.photoUrl}
                      alt={dish.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}>
                      {CATEGORY_EMOJI[dish.category] ?? '\u{1F372}'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                    {dish.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: T.goldLight,
                    }}>
                      {dish.cuisine}
                    </span>
                    <span style={{ fontSize: 10, color: T.dimText }}>{'\u00B7'}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: T.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}>
                      {dish.category}
                    </span>
                  </div>
                </div>

                {/* Submissions count */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.accent }}>
                    {dish.submissionCount}
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    color: T.textSecondary,
                  }}>
                    Recipes
                  </div>
                </div>

                {/* Arrow */}
                <span style={{ color: T.textSecondary, fontSize: 14, flexShrink: 0 }}>&#x2192;</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
