'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  fetchRecipes,
  fetchRecipeCount,
  fetchMealPlanBundle,
  fetchCollections,
} from './actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecipeSummary {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  total_time_mins: number | null;
  servings: number | null;
  is_favorite: number;
  rating: number;
  image_uri: string | null;
}

interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  cover_recipe_id: string | null;
  sort_order: number;
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

function fmtTime(mins: number | null): string {
  if (!mins) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function difficultyLabel(d: string | null): string {
  if (!d) return '';
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function getTodayDow(): number {
  return new Date().getDay();
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  depth: '#0E0E13',
  base: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  gold: '#C9894D',
  ctaFrom: '#FFB877',
  ctaTo: '#C9894D',
  glass: 'rgba(19,19,24,0.7)',
  glassBorder: 'rgba(255,255,255,0.06)',
  dimText: 'rgba(228,225,233,0.45)',
  hoverLift: 'rgba(255,255,255,0.04)',
} as const;

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s: Record<string, React.CSSProperties> = {
  /* Layout */
  page: {
    display: 'flex',
    minHeight: '100vh',
  },

  /* Sidebar */
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: `linear-gradient(180deg, ${T.base} 0%, ${T.depth} 100%)`,
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem 1rem',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  sidebarBrand: {
    padding: '0 1rem',
    marginBottom: '2.5rem',
  },
  sidebarTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: T.text,
    letterSpacing: '-0.01em',
  },
  sidebarTagline: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: T.gold,
    marginTop: 4,
    opacity: 0.8,
  },
  navList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem 1rem',
    borderRadius: 9999,
    color: 'rgba(228,225,233,0.55)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  navItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem 1rem',
    borderRadius: 9999,
    color: T.gold,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.05)',
    textDecoration: 'none',
    fontSize: 14,
    borderRight: `2px solid ${T.gold}`,
  },
  navDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.05)',
    margin: '1.5rem 0',
  },
  sidebarFooter: {
    marginTop: 'auto',
    padding: '1rem',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${T.ctaFrom}, ${T.ctaTo})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#1a1a1a',
    flexShrink: 0,
  },
  avatarName: {
    fontSize: 14,
    fontWeight: 600,
    color: T.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  avatarSub: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: T.textSecondary,
  },

  /* Main content */
  main: {
    flex: 1,
    padding: '2.5rem 2rem',
    maxWidth: 1080,
    margin: '0 auto',
  },

  /* Hero bento */
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 24,
    marginBottom: 48,
  },
  heroBanner: {
    background: T.lift,
    borderRadius: 16,
    padding: '2.5rem',
    position: 'relative' as const,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    minHeight: 220,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: T.ctaFrom,
    marginBottom: 12,
  },
  heroHeadline: {
    fontSize: '2.25rem',
    fontWeight: 800,
    lineHeight: 1.15,
    color: T.text,
    marginBottom: 24,
    letterSpacing: '-0.02em',
  },
  heroAccent: {
    color: T.ctaFrom,
  },
  heroButtons: {
    display: 'flex',
    gap: 12,
  },
  btnPrimary: {
    padding: '0.75rem 2rem',
    background: `linear-gradient(135deg, ${T.ctaFrom}, ${T.ctaTo})`,
    color: '#1a1a1a',
    borderRadius: 9999,
    border: 'none',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  btnGlass: {
    padding: '0.75rem 2rem',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    color: T.text,
    borderRadius: 9999,
    border: 'none',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  statsCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  },
  statCard: {
    background: T.focus,
    borderRadius: 16,
    padding: '1.5rem',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 12,
    color: T.ctaFrom,
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: T.text,
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: T.textSecondary,
    marginTop: 4,
  },

  /* Section header */
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: T.text,
  },
  sectionLink: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: T.ctaFrom,
    textDecoration: 'none',
    cursor: 'pointer',
  },

  /* Collections carousel */
  collectionsSection: {
    marginBottom: 48,
  },
  carousel: {
    display: 'flex',
    gap: 16,
    overflowX: 'auto' as const,
    paddingBottom: 8,
    scrollbarWidth: 'none' as const,
  },
  collectionCard: {
    minWidth: 260,
    aspectRatio: '4/5',
    background: T.lift,
    borderRadius: 16,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-end',
    position: 'relative' as const,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.3s',
    flexShrink: 0,
  },
  collectionGradient: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(to top, rgba(19,19,24,0.95) 0%, transparent 60%)',
    zIndex: 1,
  },
  collectionContent: {
    position: 'relative' as const,
    zIndex: 2,
  },
  collectionTag: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: T.ctaFrom,
    fontWeight: 700,
    marginBottom: 4,
  },
  collectionName: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: T.text,
    lineHeight: 1.3,
  },
  collectionCount: {
    fontSize: 12,
    color: T.textSecondary,
    marginTop: 8,
  },

  /* Bottom grid (recipes + today's plan) */
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: 32,
  },

  /* Recipe grid */
  recipeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  recipeCard: {
    background: T.lift,
    borderRadius: 16,
    padding: 16,
    cursor: 'pointer',
    transition: 'background 0.2s',
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  recipeThumb: {
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    background: T.highest,
  },
  recipeImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transition: 'transform 0.5s',
  },
  recipePlaceholder: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${T.focus} 0%, ${T.highest} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
  },
  recipeMeta: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: T.textSecondary,
    marginBottom: 4,
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: T.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  recipeFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  favIcon: {
    fontSize: 16,
    color: T.textSecondary,
  },
  favIconActive: {
    fontSize: 16,
    color: T.ctaFrom,
  },

  /* Today's plan sidebar */
  planSection: {},
  mealCard: {
    background: T.lift,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mealCardHighlight: {
    background: T.lift,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: `inset 0 0 0 1px rgba(201,137,77,0.2)`,
  },
  mealThumb: {
    height: 96,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  mealImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  mealPlaceholder: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${T.focus}, ${T.highest})`,
  },
  mealBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    padding: '4px 8px',
    background: T.glass,
    backdropFilter: 'blur(12px)',
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: T.text,
  },
  mealBadgeAccent: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    padding: '4px 8px',
    background: T.ctaFrom,
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: '#1a1a1a',
  },
  mealBody: {
    padding: 16,
  },
  mealTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: T.text,
  },
  mealTime: {
    fontSize: 10,
    color: T.textSecondary,
    marginTop: 4,
  },
  emptyState: {
    background: T.lift,
    borderRadius: 16,
    padding: 24,
    textAlign: 'center' as const,
    color: T.dimText,
    fontSize: 13,
  },

  /* Loading */
  loadingCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
    color: T.dimText,
    fontSize: 14,
  },

  /* Skeleton */
  skeleton: {
    background: T.focus,
    borderRadius: 16,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};

/* ------------------------------------------------------------------ */
/*  Sidebar nav items                                                  */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '\u{1F4CA}', href: '/recipes', active: true },
  { label: 'Library', icon: '\u{1F4D6}', href: '/recipes/library' },
  { label: 'Meal Planner', icon: '\u{1F4C5}', href: '/recipes/meal-planner' },
  { label: 'Pantry', icon: '\u{1F4E6}', href: '/recipes/pantry' },
  { label: 'Dishes', icon: '\u{1F30D}', href: '/recipes/dishes' },
  { label: 'Chefs', icon: '\u{1F468}\u{200D}\u{1F373}', href: '/recipes/chefs' },
  { label: 'Leaderboard', icon: '\u{1F3C6}', href: '/recipes/leaderboard' },
  { label: 'Submit', icon: '\u{1F4E4}', href: '/recipes/submit' },
];

const NAV_BOTTOM = [
  { label: 'Grocery Lists', icon: '\u{1F6D2}', href: '/recipes/grocery' },
];

/* ------------------------------------------------------------------ */
/*  Collection placeholder colors                                      */
/* ------------------------------------------------------------------ */

const COLLECTION_GRADIENTS = [
  `linear-gradient(135deg, #2D1B0E 0%, ${T.lift} 100%)`,
  `linear-gradient(135deg, #1B2D0E 0%, ${T.lift} 100%)`,
  `linear-gradient(135deg, #0E1B2D 0%, ${T.lift} 100%)`,
  `linear-gradient(135deg, #2D0E1B 0%, ${T.lift} 100%)`,
];

/* ------------------------------------------------------------------ */
/*  Meal slot display config                                           */
/* ------------------------------------------------------------------ */

const MEAL_SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RecipesDashboard() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [recipeCount, setRecipeCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const weekStart = getWeekStart(new Date());
      const [recipesData, count, collectionsData, mealBundle] = await Promise.all([
        fetchRecipes(),
        fetchRecipeCount(),
        fetchCollections(),
        fetchMealPlanBundle(weekStart),
      ]);

      const typed = (recipesData ?? []) as RecipeSummary[];
      setRecipes(typed.slice(0, 6));
      setRecipeCount(count ?? 0);
      setFavCount(typed.filter((r) => r.is_favorite === 1).length);
      setCollections((collectionsData ?? []) as CollectionSummary[]);

      const dow = getTodayDow();
      const items = ((mealBundle as { items?: MealPlanItem[] })?.items ?? []) as MealPlanItem[];
      const todayItems = items
        .filter((it) => it.day_of_week === dow)
        .sort((a, b) => MEAL_SLOT_ORDER.indexOf(a.meal_slot) - MEAL_SLOT_ORDER.indexOf(b.meal_slot));
      setTodayMeals(todayItems);
    } catch (err) {
      console.error('[recipes] dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={s.page}>
      {/* ---- Sidebar ---- */}
      <aside style={s.sidebar}>
        <div style={s.sidebarBrand}>
          <div style={s.sidebarTitle}>BestChef</div>
          <div style={s.sidebarTagline}>The Digital Curator</div>
        </div>

        <nav style={s.navList}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={item.active ? s.navItemActive : s.navItem}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          <div style={s.navDivider} />

          {NAV_BOTTOM.map((item) => (
            <Link key={item.href} href={item.href} style={s.navItem}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.avatarCircle}>U</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={s.avatarName}>User</div>
            <div style={s.avatarSub}>MyLife Pro</div>
          </div>
        </div>
      </aside>

      {/* ---- Main content ---- */}
      <main style={s.main}>
        {loading ? (
          <div style={s.loadingCenter}>Loading dashboard...</div>
        ) : (
          <>
            {/* Hero + Stats */}
            <section style={s.heroGrid}>
              <div style={s.heroBanner}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={s.heroLabel}>Welcome Back</div>
                  <h2 style={s.heroHeadline}>
                    Explore your
                    <br />
                    <span style={s.heroAccent}>culinary archives.</span>
                  </h2>
                  <div style={s.heroButtons}>
                    <Link href="/recipes/add" style={{ textDecoration: 'none' }}>
                      <button type="button" style={s.btnPrimary}>
                        Create Recipe
                      </button>
                    </Link>
                    <Link href="/recipes/library" style={{ textDecoration: 'none' }}>
                      <button type="button" style={s.btnGlass}>
                        View Collections
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              <div style={s.statsCol}>
                <div style={s.statCard}>
                  <div style={s.statIcon}>{'\u{1F4D6}'}</div>
                  <div>
                    <div style={s.statValue}>{recipeCount}</div>
                    <div style={s.statLabel}>Recipes Curated</div>
                  </div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statIcon}>{'\u{2764}'}</div>
                  <div>
                    <div style={s.statValue}>{favCount}</div>
                    <div style={s.statLabel}>Favorites Saved</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Curated Collections */}
            <section style={s.collectionsSection}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Curated Collections</h3>
                <Link href="/recipes/library" style={s.sectionLink}>
                  See All
                </Link>
              </div>

              {collections.length === 0 ? (
                <div style={s.emptyState}>
                  No collections yet. Create your first collection from the Library.
                </div>
              ) : (
                <div
                  ref={carouselRef}
                  style={s.carousel}
                  className="hide-scrollbar"
                >
                  {collections.map((col, i) => (
                    <div
                      key={col.id}
                      style={{
                        ...s.collectionCard,
                        background: COLLECTION_GRADIENTS[i % COLLECTION_GRADIENTS.length],
                      }}
                    >
                      <div style={s.collectionGradient} />
                      <div style={s.collectionContent}>
                        <div style={s.collectionTag}>Collection</div>
                        <div style={s.collectionName}>{col.name}</div>
                        {col.description && (
                          <div style={s.collectionCount}>{col.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Recipes + Today's Plan */}
            <div style={s.bottomGrid}>
              {/* Recent Recipes */}
              <div>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Recent Recipes</h3>
                  <Link href="/recipes/library" style={s.sectionLink}>
                    View All
                  </Link>
                </div>

                {recipes.length === 0 ? (
                  <div style={s.emptyState}>
                    No recipes yet. Add your first recipe to get started.
                  </div>
                ) : (
                  <div style={s.recipeGrid}>
                    {recipes.map((recipe) => (
                      <Link
                        key={recipe.id}
                        href={`/recipes/library/${recipe.id}`}
                        style={s.recipeCard}
                      >
                        <div style={s.recipeThumb}>
                          {recipe.image_uri ? (
                            <img
                              src={recipe.image_uri}
                              alt={recipe.title}
                              style={s.recipeImg}
                            />
                          ) : (
                            <div style={s.recipePlaceholder}>{'\u{1F373}'}</div>
                          )}
                        </div>
                        <div style={s.recipeMeta}>
                          {fmtTime(recipe.total_time_mins ?? recipe.cook_time_mins)}
                          {recipe.difficulty ? ` \u00B7 ${difficultyLabel(recipe.difficulty)}` : ''}
                        </div>
                        <div style={s.recipeTitle}>{recipe.title}</div>
                        <div style={s.recipeFooter}>
                          <span />
                          <span
                            style={
                              recipe.is_favorite ? s.favIconActive : s.favIcon
                            }
                          >
                            {recipe.is_favorite ? '\u2605' : '\u2606'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Today's Plan */}
              <div style={s.planSection}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Today&apos;s Plan</h3>
                </div>

                {todayMeals.length === 0 ? (
                  <div style={s.emptyState}>
                    <div style={{ marginBottom: 8 }}>{'\u{1F4C5}'}</div>
                    No meals planned for today.
                    <br />
                    <Link
                      href="/recipes/meal-planner"
                      style={{
                        color: T.ctaFrom,
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: 12,
                        marginTop: 8,
                        display: 'inline-block',
                      }}
                    >
                      Plan your week
                    </Link>
                  </div>
                ) : (
                  todayMeals.map((meal, idx) => {
                    const isLast = idx === todayMeals.length - 1;
                    return (
                      <div
                        key={meal.id}
                        style={isLast ? s.mealCardHighlight : s.mealCard}
                      >
                        <div style={s.mealThumb}>
                          {meal.recipe_image_uri ? (
                            <img
                              src={meal.recipe_image_uri}
                              alt={meal.recipe_title}
                              style={s.mealImg}
                            />
                          ) : (
                            <div style={s.mealPlaceholder} />
                          )}
                          <div
                            style={isLast ? s.mealBadgeAccent : s.mealBadge}
                          >
                            {MEAL_SLOT_LABELS[meal.meal_slot] ?? meal.meal_slot}
                          </div>
                        </div>
                        <div style={s.mealBody}>
                          <div style={s.mealTitle}>{meal.recipe_title}</div>
                          <div style={s.mealTime}>
                            {meal.servings} serving{meal.servings !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Scrollbar hide + pulse animation */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
