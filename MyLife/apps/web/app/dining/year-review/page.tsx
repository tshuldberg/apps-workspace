'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchYearInReview } from '../actions';

interface YearInReview {
  period: { start: string; end: string };
  totalVisits: number;
  totalRestaurants: number;
  totalDishes: number;
  totalWines: number;
  totalSpentCents: number;
  averageRating: number | null;
  topRestaurants: Array<{ id: string; name: string; visitCount: number; avgRating: number }>;
  topDishes: Array<{ id: string; name: string; restaurantName: string; rating: number }>;
  topWines: Array<{ id: string; name: string; producer: string; rating: number }>;
  cuisineBreakdown: Array<{ cuisine: string; count: number }>;
  monthlyVisits: Array<{ month: string; count: number }>;
  bestMeal: { visitId: string; restaurantName: string; date: string; rating: number } | null;
  mostVisitedRestaurant: { id: string; name: string; count: number } | null;
  dishOfTheYear: { id: string; name: string; restaurantName: string; rating: number } | null;
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.12)';
const ACCENT_BORDER = 'rgba(220,38,38,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const SURFACE = 'var(--surface-elevated, #2A292F)';
const STARS = '#FFB877';
const SUCCESS = '#30D158';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString(undefined, { month: 'short' });
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span style={{ color: STARS, fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  );
}

export default function YearReviewPage() {
  const [review, setReview] = useState<YearInReview | null>(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const startDate = `${currentYear}-01-01T00:00:00Z`;
  const endDate = `${currentYear}-12-31T23:59:59Z`;

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchYearInReview(startDate, endDate);
        setReview(data as YearInReview);
      } catch (err) {
        console.error('[Dining] Failed to fetch year in review', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: TEXT_SEC }}>Loading your year in review...</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: TEXT_SEC }}>Failed to load year in review.</p>
      </div>
    );
  }

  const maxMonthly = Math.max(...review.monthlyVisits.map((m) => m.count), 1);
  const maxCuisine = Math.max(...review.cuisineBreakdown.map((c) => c.count), 1);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <p style={eyebrowStyle}>YEAR IN REVIEW</p>
        <h1 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 800, color: TEXT }}>
          Your Year in Dining
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT_SEC }}>
          {formatDate(review.period.start)} - {formatDate(review.period.end)}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <StatCard label="Visits" value={String(review.totalVisits)} />
        <StatCard label="Restaurants" value={String(review.totalRestaurants)} />
        <StatCard label="Dishes" value={String(review.totalDishes)} />
        <StatCard label="Wines" value={String(review.totalWines)} />
        <StatCard
          label="Total Spent"
          value={review.totalSpentCents > 0 ? formatCurrency(review.totalSpentCents) : '-'}
        />
        <StatCard
          label="Avg Rating"
          value={review.averageRating != null ? review.averageRating.toFixed(1) : '-'}
          extra={review.averageRating != null ? <Stars rating={review.averageRating} /> : undefined}
        />
      </div>

      {/* Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Best Meal */}
        {review.bestMeal && (
          <div style={highlightCardStyle}>
            <p style={highlightLabelStyle}>Best Meal</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>
              {review.bestMeal.restaurantName}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: TEXT_SEC }}>
                {formatDate(review.bestMeal.date)}
              </span>
              <span style={{ fontSize: 14, color: STARS, fontWeight: 700 }}>
                {'★'.repeat(review.bestMeal.rating)} {review.bestMeal.rating}/5
              </span>
            </div>
          </div>
        )}

        {/* Most Visited */}
        {review.mostVisitedRestaurant && (
          <div style={cardStyle}>
            <p style={cardLabelStyle}>Most Visited</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>
              {review.mostVisitedRestaurant.name}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
              {review.mostVisitedRestaurant.count} visit{review.mostVisitedRestaurant.count !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Dish of the Year */}
        {review.dishOfTheYear && (
          <div style={cardStyle}>
            <p style={cardLabelStyle}>Dish of the Year</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>
              {review.dishOfTheYear.name}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
              at {review.dishOfTheYear.restaurantName} - {review.dishOfTheYear.rating}/5
            </p>
          </div>
        )}
      </div>

      {/* Top Restaurants */}
      {review.topRestaurants.length > 0 && (
        <div>
          <h2 style={sectionTitleStyle}>Top Restaurants</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {review.topRestaurants.slice(0, 5).map((r, i) => (
              <Link
                key={r.id}
                href={`/dining/restaurant/${r.id}`}
                style={listItemStyle}
              >
                <span style={rankStyle}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{r.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>
                    {r.visitCount} visit{r.visitCount !== 1 ? 's' : ''} - {r.avgRating.toFixed(1)} avg
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top Dishes */}
      {review.topDishes.length > 0 && (
        <div>
          <h2 style={sectionTitleStyle}>Top Dishes</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {review.topDishes.slice(0, 5).map((d, i) => (
              <div key={d.id} style={listItemStyle}>
                <span style={rankStyle}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{d.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>
                    {d.restaurantName} - {d.rating}/5
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Visits */}
      {review.monthlyVisits.length > 0 && (
        <div>
          <h2 style={sectionTitleStyle}>Monthly Visits</h2>
          <div style={{ display: 'grid', gap: 6 }}>
            {review.monthlyVisits.map((m) => (
              <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, fontSize: 13, fontWeight: 600, color: TEXT_SEC, textAlign: 'right' }}>
                  {formatMonth(m.month)}
                </span>
                <div style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: SURFACE, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(m.count / maxMonthly) * 100}%`,
                      minWidth: 4,
                      borderRadius: 6,
                      backgroundColor: ACCENT,
                    }}
                  />
                </div>
                <span style={{ width: 24, fontSize: 13, fontWeight: 700, color: TEXT, textAlign: 'right' }}>
                  {m.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cuisine Breakdown */}
      {review.cuisineBreakdown.length > 0 && (
        <div>
          <h2 style={sectionTitleStyle}>Cuisine Breakdown</h2>
          <div style={{ display: 'grid', gap: 6 }}>
            {review.cuisineBreakdown.slice(0, 8).map((c) => (
              <div key={c.cuisine} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 90, fontSize: 13, fontWeight: 600, color: TEXT_SEC, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.cuisine}
                </span>
                <div style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: SURFACE, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(c.count / maxCuisine) * 100}%`,
                      minWidth: 4,
                      borderRadius: 6,
                      backgroundColor: SUCCESS,
                    }}
                  />
                </div>
                <span style={{ width: 24, fontSize: 13, fontWeight: 700, color: TEXT, textAlign: 'right' }}>
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {review.totalVisits === 0 && (
        <div style={{
          padding: 48,
          borderRadius: 20,
          border: `1px dashed ${ACCENT_BORDER}`,
          backgroundColor: GLASS,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>{'\uD83C\uDF7D\uFE0F'}</p>
          <p style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>No visits this year yet</p>
          <p style={{ color: TEXT_SEC, marginTop: 8 }}>
            Start logging your dining experiences to see your year-in-review stats.
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
      )}
    </div>
  );
}

function StatCard({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div style={{
      padding: 16,
      borderRadius: 14,
      backgroundColor: GLASS,
      border: `1px solid ${BORDER}`,
      textAlign: 'center',
    }}>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT }}>{value}</p>
      {extra && <div style={{ marginTop: 4 }}>{extra}</div>}
      <p style={{
        margin: '6px 0 0',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: TEXT_SEC,
      }}>
        {label}
      </p>
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: ACCENT,
};

const highlightCardStyle: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  backgroundColor: ACCENT_DIM,
  border: `1px solid ${ACCENT}`,
  display: 'grid',
  gap: 8,
};

const highlightLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: ACCENT,
};

const cardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  display: 'grid',
  gap: 4,
};

const cardLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: ACCENT,
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 18,
  fontWeight: 700,
  color: TEXT,
};

const listItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  borderRadius: 12,
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  textDecoration: 'none',
  color: TEXT,
};

const rankStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: ACCENT,
  width: 24,
  textAlign: 'center',
};
