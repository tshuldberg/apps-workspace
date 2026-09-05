'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  searchChefsAction,
  getTopChefsAction,
} from '../chef-actions';
import { getCuisinesAction } from '../cloud-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChefCard {
  profileId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  totalSubmissions: number;
  dishesWon: number;
  avgScore: number;
  topCuisine: string | null;
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChefsPage() {
  const [chefs, setChefs] = useState<ChefCard[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTopChefs = useCallback(async (cuisine?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTopChefsAction({
        cuisine: cuisine ?? undefined,
        limit: 30,
      });
      if (!result.ok) {
        setError(result.error ?? 'Failed to load chefs');
        setChefs([]);
      } else {
        setChefs((result.data ?? []) as unknown as ChefCard[]);
      }
    } catch {
      setError('Failed to load chefs');
      setChefs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchForChefs = useCallback(async (query: string, cuisine?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchChefsAction(query, {
        cuisine: cuisine ?? undefined,
        limit: 30,
      });
      if (!result.ok) {
        setError(result.error ?? 'Search failed');
        setChefs([]);
      } else {
        setChefs((result.data ?? []) as unknown as ChefCard[]);
      }
    } catch {
      setError('Search failed');
      setChefs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: top chefs + cuisines
  useEffect(() => {
    loadTopChefs();
    getCuisinesAction().then((res) => {
      if (res.ok && res.data) setCuisines(res.data);
    });
  }, [loadTopChefs]);

  // Debounced search
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length > 0) {
        searchForChefs(value.trim(), selectedCuisine ?? undefined);
      } else {
        loadTopChefs(selectedCuisine ?? undefined);
      }
    }, 350);
  };

  const handleCuisineFilter = (cuisine: string | null) => {
    setSelectedCuisine(cuisine);
    if (searchQuery.trim().length > 0) {
      searchForChefs(searchQuery.trim(), cuisine ?? undefined);
    } else {
      loadTopChefs(cuisine ?? undefined);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <Link
        href="/recipes"
        style={{
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          marginBottom: 24,
          display: 'inline-block',
        }}
      >
        &#x2190; Dashboard
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Discover Chefs
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          Find talented home cooks and follow their culinary journeys.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search chefs by name or handle..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: T.surfaceLow,
            color: T.text,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      {/* Cuisine filter chips */}
      {cuisines.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
          <button
            type="button"
            onClick={() => handleCuisineFilter(null)}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              border: 'none',
              background: selectedCuisine === null ? T.accent : T.surfaceHigh,
              color: selectedCuisine === null ? '#131318' : T.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            All
          </button>
          {cuisines.slice(0, 12).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleCuisineFilter(selectedCuisine === c ? null : c)}
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                border: 'none',
                background: selectedCuisine === c ? T.accent : T.surfaceHigh,
                color: selectedCuisine === c ? '#131318' : T.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'background 0.2s',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Section title */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontSize: 14,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: T.text,
        }}>
          {searchQuery.trim() ? 'Search Results' : 'Top Chefs'}
        </h2>
      </div>

      {/* States */}
      {loading && (
        <div style={{
          padding: '80px 0',
          textAlign: 'center',
          color: T.dimText,
          fontSize: 14,
        }}>
          Loading chefs...
        </div>
      )}

      {error && !loading && (
        <div style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '60px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F614}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#FFB4AB', marginBottom: 8 }}>
            {error}
          </div>
          <button
            type="button"
            onClick={() => loadTopChefs(selectedCuisine ?? undefined)}
            style={{
              padding: '10px 24px',
              borderRadius: 9999,
              border: 'none',
              background: T.surfaceHigh,
              color: T.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && chefs.length === 0 && (
        <div style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '60px 24px',
          textAlign: 'center',
          color: T.dimText,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F468}\u{200D}\u{1F373}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            No chefs found
          </div>
          <div style={{ fontSize: 14 }}>
            {searchQuery.trim()
              ? 'Try a different search term or remove filters.'
              : 'Be the first to submit a recipe and show up here!'}
          </div>
        </div>
      )}

      {/* Chef grid */}
      {!loading && !error && chefs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {chefs.map((chef) => (
            <Link
              key={chef.profileId}
              href={`/recipes/chefs/${chef.handle}`}
              style={{
                background: T.surfaceLow,
                borderRadius: 16,
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transition: 'background 0.2s',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {/* Avatar + name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: `2px solid ${T.accent}`,
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: T.surfaceHigh,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {chef.avatarUrl ? (
                    <img
                      src={chef.avatarUrl}
                      alt={chef.displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 20, color: T.accent }}>
                      {chef.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: T.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {chef.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>
                    @{chef.handle}
                  </div>
                </div>
              </div>

              {/* Top cuisine badge */}
              {chef.topCuisine && (
                <div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 9999,
                    background: `${T.accent}1A`,
                    color: T.accent,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    {chef.topCuisine}
                  </span>
                </div>
              )}

              {/* Stats row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}>
                <StatPill value={chef.totalSubmissions} label="Dishes" />
                <StatPill value={chef.dishesWon} label="Wins" />
                <StatPill value={chef.followerCount} label="Followers" />
                <StatPill value={formatScore(chef.avgScore)} label="Avg" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatPill({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#E4E1E9' }}>
        {value}
      </div>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#D6C3B5',
        marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}

function formatScore(score: number): string {
  if (score === 0) return '--';
  return (score * 100).toFixed(0);
}
