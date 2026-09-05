'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchVisitsChronological, fetchVisitStats, fetchRestaurants } from '../actions';

interface Visit {
  id: string;
  restaurant_id: string;
  visited_at: string;
  overall_rating: number;
  occasion: string | null;
  party_size: number | null;
}

interface VisitStats {
  totalVisits: number;
  avgRating: number | null;
}

interface Restaurant {
  id: string;
  name: string;
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.12)';
const ACCENT_BORDER = 'rgba(220,38,38,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const SURFACE = 'var(--surface-elevated, #2A292F)';

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#FFB877', fontSize: 13, letterSpacing: 1 }}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  );
}

function formatMonthKey(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return 'Unknown';
  }
}

function formatMonthLabel(key: string): string {
  try {
    const [year, month] = key.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return key;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function DiningVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [restaurantMap, setRestaurantMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchVisitsChronological({ sort_by: 'visited_at', sort_dir: 'DESC', limit: 500 }),
      fetchVisitStats(),
      fetchRestaurants({ sort_by: 'name', sort_dir: 'ASC', limit: 500 }),
    ]).then(([visitData, statsData, restData]) => {
      if (cancelled) return;
      setVisits(visitData as Visit[]);
      setStats(statsData as VisitStats);
      const map: Record<string, string> = {};
      for (const r of restData as Restaurant[]) {
        map[r.id] = r.name;
      }
      setRestaurantMap(map);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: TEXT_SEC }}>Loading visits...</p>
      </div>
    );
  }

  // Group visits by month
  const grouped: Record<string, Visit[]> = {};
  for (const v of visits) {
    const key = formatMonthKey(v.visited_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  }
  const monthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={eyebrowStyle}>Dining</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 800, color: TEXT }}>
            Visits
          </h1>
        </div>
        <Link
          href="/dining/visit/add"
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
          + Log Visit
        </Link>
      </div>

      {/* Stats summary */}
      {stats && stats.totalVisits > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={statCardStyle}>
            <span style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>{stats.totalVisits}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 1 }}>
              Total Visits
            </span>
          </div>
          {stats.avgRating != null && (
            <div style={statCardStyle}>
              <span style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>
                {stats.avgRating.toFixed(1)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 1 }}>
                Avg Rating
              </span>
            </div>
          )}
        </div>
      )}

      {/* Visit list */}
      {visits.length === 0 ? (
        <div
          style={{
            padding: 48,
            borderRadius: 20,
            border: `1px dashed ${ACCENT_BORDER}`,
            backgroundColor: GLASS,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 48, marginBottom: 8 }}>{'\uD83D\uDCDD'}</p>
          <p style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>No visits yet</p>
          <p style={{ color: TEXT_SEC, marginTop: 8 }}>
            After you add a restaurant, log your visits with ratings and notes.
          </p>
          <Link
            href="/dining/visit/add"
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
            Log your first visit
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 32 }}>
          {monthKeys.map((monthKey) => (
            <div key={monthKey}>
              <h2 style={{
                margin: '0 0 14px',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: TEXT_SEC,
              }}>
                {formatMonthLabel(monthKey)}
              </h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {grouped[monthKey].map((v) => (
                  <Link
                    key={v.id}
                    href={`/dining/visit/${v.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 18px',
                      borderRadius: 14,
                      backgroundColor: SURFACE,
                      border: `1px solid ${BORDER}`,
                      textDecoration: 'none',
                      color: TEXT,
                    }}
                  >
                    {/* Date */}
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: TEXT_SEC,
                      minWidth: 60,
                    }}>
                      {formatShortDate(v.visited_at)}
                    </span>

                    {/* Restaurant name */}
                    <span style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {restaurantMap[v.restaurant_id] || 'Unknown Restaurant'}
                    </span>

                    {/* Rating */}
                    <Stars rating={v.overall_rating} />

                    {/* Occasion badge */}
                    {v.occasion && (
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        backgroundColor: ACCENT_DIM,
                        color: TEXT,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {v.occasion}
                      </span>
                    )}

                    {/* Party size */}
                    {v.party_size != null && (
                      <span style={{
                        fontSize: 12,
                        color: TEXT_SEC,
                        fontWeight: 600,
                      }}>
                        {v.party_size}p
                      </span>
                    )}

                    {/* Chevron */}
                    <span style={{ fontSize: 18, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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

const statCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '16px 24px',
  borderRadius: 16,
  backgroundColor: 'var(--surface-elevated, #2A292F)',
  border: '1px solid var(--border)',
  minWidth: 120,
};
