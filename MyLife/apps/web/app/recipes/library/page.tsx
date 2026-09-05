'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchRecipes, fetchRecipeCount } from '@/app/recipes/actions';

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
  created_at: string;
}

type SortOption = 'recent' | 'rating' | 'cook_time' | 'alpha';
type Difficulty = 'easy' | 'medium' | 'hard';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLowest: '#0E0E13',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  gold: '#C9894D',
  goldLight: '#FFB877',
  glass: 'rgba(19,19,24,0.7)',
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(mins: number | null): string {
  if (mins === null || mins === 0) return '--';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} min`;
}

function renderStars(rating: number): string {
  const full = Math.round(rating);
  return '\u2605'.repeat(full) + '\u2606'.repeat(5 - full);
}

function sortRecipes(recipes: RecipeSummary[], sort: SortOption): RecipeSummary[] {
  const copy = [...recipes];
  switch (sort) {
    case 'rating':
      return copy.sort((a, b) => b.rating - a.rating);
    case 'cook_time':
      return copy.sort((a, b) => (a.total_time_mins ?? 999) - (b.total_time_mins ?? 999));
    case 'alpha':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'recent':
    default:
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Most Recent',
  rating: 'Rating',
  cook_time: 'Cook Time',
  alpha: 'Alphabetical',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Beginner Friendly',
  medium: 'Intermediate Artisan',
  hard: 'Professional / Avant-Garde',
};

const PAGE_SIZE = 24;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function RecipeLibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [sort, setSort] = useState<SortOption>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [difficulties, setDifficulties] = useState<Set<Difficulty>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get('tag') ?? null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  // Derive unique tags from recipes (loaded once with a broad fetch)
  const loadTags = useCallback(async () => {
    try {
      const all = await fetchRecipes({ limit: 500 });
      const tagSet = new Set<string>();
      // Tags are not returned in the recipe list, so we skip tag extraction here.
      // Tags are filtered server-side via the `tag` filter param.
      // We'll collect tags from description/title patterns or leave tag filter as text input.
      setAllTags(Array.from(tagSet).sort());
    } catch {
      // silently ignore
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const diffArr = Array.from(difficulties);
      // The API supports one difficulty at a time; if multiple selected, fetch all and filter client-side
      const filters: {
        search?: string;
        difficulty?: Difficulty;
        tag?: string;
        limit?: number;
        offset?: number;
      } = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };

      if (search.trim()) filters.search = search.trim();
      if (diffArr.length === 1) filters.difficulty = diffArr[0] as Difficulty;
      if (selectedTag) filters.tag = selectedTag;

      let results = (await fetchRecipes(filters)) as RecipeSummary[];

      // Client-side multi-difficulty filter
      if (diffArr.length > 1) {
        results = results.filter((r) => r.difficulty && diffArr.includes(r.difficulty as Difficulty));
      }

      setRecipes(sortRecipes(results, sort));

      const count = await fetchRecipeCount();
      setTotalCount(count);
    } catch (err) {
      console.error('Failed to load recipes:', err);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [search, difficulties, selectedTag, page, sort]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Re-sort when sort changes without re-fetching
  useEffect(() => {
    setRecipes((prev) => sortRecipes(prev, sort));
  }, [sort]);

  const toggleDifficulty = (d: Difficulty) => {
    setDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
    setPage(0);
  };

  const resetFilters = () => {
    setSearch('');
    setDifficulties(new Set());
    setSelectedTag(null);
    setPage(0);
  };

  const applyFilters = () => {
    setPage(0);
    loadRecipes();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ---------------------------------------------------------------- */
  /*  Styles                                                           */
  /* ---------------------------------------------------------------- */

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  };

  const sidebarStyle: React.CSSProperties = {
    width: 280,
    flexShrink: 0,
    padding: '32px 24px',
    background: `rgba(14,14,19,0.5)`,
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    overflowY: 'auto',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    padding: 32,
    overflowY: 'auto',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: T.gold,
    marginBottom: 16,
  };

  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    padding: '4px 0',
  };

  const checkboxStyle = (checked: boolean): React.CSSProperties => ({
    width: 18,
    height: 18,
    borderRadius: 4,
    background: checked ? T.gold : T.surfaceHighest,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.2s',
    fontSize: 12,
    color: checked ? '#1a1a1a' : 'transparent',
    fontWeight: 700,
  });

  const tagPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: active ? 'rgba(201,137,77,0.1)' : T.surfaceHigh,
    color: active ? T.gold : T.textSecondary,
    border: active ? '1px solid rgba(201,137,77,0.2)' : '1px solid transparent',
  });

  const applyBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 0',
    borderRadius: 9999,
    background: `linear-gradient(135deg, ${T.goldLight}, ${T.gold})`,
    color: '#1a1a1a',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.2s',
  };

  const resetBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 0',
    background: 'transparent',
    color: T.textSecondary,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    border: 'none',
    marginTop: 8,
  };

  const controlsBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  };

  const sortWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const sortDropStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    background: T.surfaceHigh,
    borderRadius: 12,
    padding: '8px 0',
    minWidth: 180,
    zIndex: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  };

  const sortItemStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    color: active ? T.gold : T.text,
    cursor: 'pointer',
    transition: 'background 0.15s',
  });

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 32,
  };

  const cardStyle: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const imageWrapStyle: React.CSSProperties = {
    position: 'relative',
    aspectRatio: '3/4',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    background: T.surfaceLow,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'filter 0.5s',
  };

  const gradientPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${T.surfaceLow} 0%, ${T.surfaceHigh} 50%, ${T.gold}22 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
  };

  const imageOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, rgba(19,19,24,0.9) 0%, transparent 50%)',
    opacity: 0.6,
  };

  const tagBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: '4px 12px',
    borderRadius: 9999,
    background: 'rgba(53,52,58,0.6)',
    backdropFilter: 'blur(12px)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: T.gold,
    textTransform: 'uppercase' as const,
  };

  const cardMetaStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const starStyle: React.CSSProperties = {
    fontSize: 12,
    color: T.gold,
    letterSpacing: 1,
  };

  const timeStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(228,225,233,0.8)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    marginBottom: 4,
    transition: 'color 0.2s',
    padding: '0 8px',
  };

  const cardDiffStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: T.textSecondary,
    padding: '0 8px',
  };

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 64,
  };

  const pageNumStyle = (active: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? 'rgba(201,137,77,0.2)' : 'transparent',
    color: active ? T.gold : T.textSecondary,
    border: 'none',
    transition: 'background 0.2s',
  });

  const arrowBtnStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 9999,
    border: `1px solid rgba(82,68,58,0.3)`,
    background: 'transparent',
    color: T.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 20,
    transition: 'all 0.2s',
  };

  const headerBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    marginBottom: 8,
  };

  const searchInputStyle: React.CSSProperties = {
    background: T.surfaceHighest,
    border: 'none',
    borderRadius: 9999,
    padding: '10px 16px 10px 40px',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.12em',
    color: T.text,
    outline: 'none',
    width: 260,
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '80px 0',
    color: T.textSecondary,
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '80px 0',
    color: T.textSecondary,
    fontSize: 14,
  };

  const countStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: T.textSecondary,
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const pageNums: number[] = [];
  for (let i = 0; i < Math.min(totalPages, 5); i++) pageNums.push(i);
  if (totalPages > 5) pageNums.push(totalPages - 1);

  return (
    <div style={pageStyle}>
      {/* Filter Sidebar */}
      <aside style={sidebarStyle}>
        {/* Search */}
        <div>
          <div style={sectionLabelStyle}>Search</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: T.textSecondary }}>
              &#x1F50D;
            </span>
            <input
              type="text"
              placeholder="SEARCH COLLECTION..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              style={searchInputStyle}
            />
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <div style={sectionLabelStyle}>Difficulty</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <label key={d} style={checkboxRowStyle} onClick={() => toggleDifficulty(d)}>
                <div style={checkboxStyle(difficulties.has(d))}>
                  {difficulties.has(d) ? '\u2713' : ''}
                </div>
                <span style={{ fontSize: 12, color: T.textSecondary, transition: 'color 0.2s' }}>
                  {DIFFICULTY_LABELS[d]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tag pills */}
        {allTags.length > 0 && (
          <div>
            <div style={sectionLabelStyle}>Cuisine</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allTags.slice(0, 10).map((tag) => (
                <button
                  key={tag}
                  style={tagPillStyle(selectedTag === tag)}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 'auto' }}>
          <button style={applyBtnStyle} onClick={applyFilters}>Apply Filters</button>
          <button style={resetBtnStyle} onClick={resetFilters}>Reset to Default</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={mainStyle}>
        {/* Header */}
        <div style={headerBarStyle}>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Library</h1>
          <div style={{ width: 1, height: 16, background: 'rgba(82,68,58,0.3)' }} />
          <span style={countStyle}>{totalCount} Curated Recipes</span>
        </div>

        {/* Controls bar */}
        <div style={controlsBarStyle}>
          <div />
          <div style={sortWrapperStyle}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: T.textSecondary }}>
              SORT BY:
            </span>
            <button
              style={{ background: 'none', border: 'none', color: T.text, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setSortOpen(!sortOpen)}
            >
              {SORT_LABELS[sort].toUpperCase()} &#x25BE;
            </button>
            {sortOpen && (
              <div style={sortDropStyle}>
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <div
                    key={opt}
                    style={sortItemStyle(sort === opt)}
                    onClick={() => { setSort(opt); setSortOpen(false); }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    {SORT_LABELS[opt]}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && <div style={loadingStyle}>Loading recipes...</div>}

        {/* Empty */}
        {!loading && recipes.length === 0 && (
          <div style={emptyStyle}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F373;</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No recipes found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your filters or add some recipes to get started.</div>
          </div>
        )}

        {/* Recipe Grid */}
        {!loading && recipes.length > 0 && (
          <>
            <div style={gridStyle}>
              {recipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/recipes/library/${recipe.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <article
                    style={cardStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    <div style={imageWrapStyle}>
                      {recipe.image_uri ? (
                        <img src={recipe.image_uri} alt={recipe.title} style={imgStyle} />
                      ) : (
                        <div style={gradientPlaceholderStyle}>&#x1F372;</div>
                      )}
                      <div style={imageOverlayStyle} />
                      {recipe.difficulty && (
                        <div style={tagBadgeStyle}>{recipe.difficulty.toUpperCase()}</div>
                      )}
                      <div style={cardMetaStyle}>
                        <div style={starStyle}>
                          {renderStars(recipe.rating)}{' '}
                          <span style={{ color: T.text, fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{recipe.rating.toFixed(1)}</span>
                        </div>
                        <div style={timeStyle}>
                          &#x23F0; {formatTime(recipe.total_time_mins ?? recipe.cook_time_mins)}
                        </div>
                      </div>
                    </div>
                    <h3 style={cardTitleStyle}>{recipe.title}</h3>
                    <p style={cardDiffStyle}>
                      {recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty as Difficulty] ?? recipe.difficulty : ''}
                    </p>
                  </article>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <footer style={paginationStyle}>
                <button
                  style={arrowBtnStyle}
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  &#x2190;
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pageNums.map((p, i) => {
                    // Show ellipsis before last if gap
                    const showEllipsis = i > 0 && p - pageNums[i - 1] > 1;
                    return (
                      <span key={p}>
                        {showEllipsis && <span style={{ color: 'rgba(214,195,181,0.4)', padding: '0 8px' }}>...</span>}
                        <button style={pageNumStyle(page === p)} onClick={() => setPage(p)}>
                          {p + 1}
                        </button>
                      </span>
                    );
                  })}
                </div>
                <button
                  style={arrowBtnStyle}
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page === totalPages - 1}
                >
                  &#x2192;
                </button>
              </footer>
            )}
          </>
        )}
      </main>

      {/* Close sort dropdown on outside click */}
      {sortOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 5 }}
          onClick={() => setSortOpen(false)}
        />
      )}
    </div>
  );
}

export default function RecipeLibraryPage() {
  return (
    <Suspense fallback={null}>
      <RecipeLibraryPageContent />
    </Suspense>
  );
}
