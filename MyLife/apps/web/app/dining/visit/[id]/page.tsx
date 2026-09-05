'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchVisit, deleteVisitAction, fetchRestaurant, fetchDishesByVisit, fetchWinesByVisit } from '../../actions';

interface Companion {
  id: string;
  visit_id: string;
  display_name: string;
  notes: string | null;
  created_at: string;
}

interface VisitDetail {
  id: string;
  restaurant_id: string;
  visited_at: string;
  party_size: number | null;
  occasion: string | null;
  reservation_platform: string | null;
  overall_rating: number;
  vibe_rating: number | null;
  food_rating: number | null;
  service_rating: number | null;
  notes_md: string | null;
  total_cost_cents: number | null;
  who_paid: string | null;
  created_at: string;
  updated_at: string;
  photos: unknown[];
  companions: Companion[];
}

interface DishRow {
  id: string;
  name: string;
  course: string | null;
  rating: number | null;
  price_cents: number | null;
}

interface WineRow {
  id: string;
  producer: string;
  name: string;
  vintage: number | null;
  color: string | null;
  rating: number | null;
}

const ACCENT = '#DC2626';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ color: '#FFB877', fontSize: size, letterSpacing: 2 }}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function SubRating({ label, rating }: { label: string; rating: number | null }) {
  if (rating == null) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13, color: TEXT_SEC, fontWeight: 600, minWidth: 60 }}>{label}</span>
      <Stars rating={rating} size={14} />
    </div>
  );
}

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const visitId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [visit, setVisit] = useState<VisitDetail | null | undefined>(undefined);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [wines, setWines] = useState<WineRow[]>([]);

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    void fetchVisit(visitId).then((data) => {
      if (cancelled) return;
      setVisit(data as VisitDetail | null);
      if (data) {
        void fetchRestaurant((data as VisitDetail).restaurant_id).then((r) => {
          if (!cancelled && r) {
            setRestaurantName((r as { name: string }).name);
          }
        });
      }
    });
    void fetchDishesByVisit(visitId).then((data) => {
      if (!cancelled) setDishes(data as DishRow[]);
    });
    void fetchWinesByVisit(visitId).then((data) => {
      if (!cancelled) setWines(data as WineRow[]);
    });
    return () => { cancelled = true; };
  }, [visitId]);

  if (visit === undefined) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading visit...</p>;
  }

  if (!visit) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Visit not found</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          This visit does not exist in your collection.
        </p>
        <Link href="/dining/visits" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Visits
        </Link>
      </div>
    );
  }

  const handleDelete = () => {
    if (!confirm('Delete this visit? This cannot be undone.')) return;
    void deleteVisitAction(visit.id).then(() => {
      router.push('/dining/visits');
    });
  };

  const hasSubRatings = visit.vibe_rating != null || visit.food_rating != null || visit.service_rating != null;

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        {restaurantName ? (
          <>
            <Link
              href={`/dining/restaurant/${visit.restaurant_id}`}
              style={{ color: TEXT_SEC, textDecoration: 'none' }}
            >
              {restaurantName}
            </Link>
            <span style={{ opacity: 0.4 }}>&gt;</span>
          </>
        ) : null}
        <span style={{ color: TEXT }}>Visit</span>
      </nav>

      {/* Hero */}
      <div style={{ display: 'grid', gap: 8 }}>
        {restaurantName && (
          <Link
            href={`/dining/restaurant/${visit.restaurant_id}`}
            style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
          >
            {restaurantName}
          </Link>
        )}
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
          {formatDate(visit.visited_at)}
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
          <Stars rating={visit.overall_rating} size={20} />
          {visit.occasion && (
            <span style={{
              padding: '4px 12px',
              borderRadius: 999,
              backgroundColor: 'rgba(220,38,38,0.12)',
              color: TEXT,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {visit.occasion}
            </span>
          )}
          {visit.party_size != null && (
            <span style={{ fontSize: 14, color: TEXT_SEC }}>
              Party of {visit.party_size}
            </span>
          )}
        </div>
      </div>

      {/* Sub-ratings */}
      {hasSubRatings && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Ratings</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <SubRating label="Vibe" rating={visit.vibe_rating} />
            <SubRating label="Food" rating={visit.food_rating} />
            <SubRating label="Service" rating={visit.service_rating} />
          </div>
        </section>
      )}

      {/* Companions */}
      {visit.companions.length > 0 && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Companions</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {visit.companions.map((c) => (
              <span
                key={c.id}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: TEXT,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {c.display_name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {visit.notes_md && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Notes</h2>
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 15, lineHeight: 1.7 }}>
            {visit.notes_md}
          </p>
        </section>
      )}

      {/* Dishes */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionHeading}>Dishes</h2>
          <Link
            href={`/dining/dish/add?restaurantId=${visit.restaurant_id}&visitId=${visit.id}`}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              backgroundColor: ACCENT,
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Add Dish
          </Link>
        </div>
        {dishes.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No dishes logged for this visit.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {dishes.map((d) => (
              <Link
                key={d.id}
                href={`/dining/dish/${d.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 12,
                  backgroundColor: 'var(--surface-elevated, #2A292F)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: TEXT,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{d.name}</span>
                {d.course && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(220,38,38,0.12)',
                    color: TEXT,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {d.course.charAt(0).toUpperCase() + d.course.slice(1)}
                  </span>
                )}
                {d.rating != null && <Stars rating={d.rating} size={13} />}
                {d.price_cents != null && (
                  <span style={{ fontSize: 13, color: TEXT_SEC }}>${(d.price_cents / 100).toFixed(2)}</span>
                )}
                <span style={{ fontSize: 16, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Wines */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionHeading}>Wines</h2>
          <Link
            href={`/dining/wine/add?restaurantId=${visit.restaurant_id}&visitId=${visit.id}`}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              backgroundColor: ACCENT,
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Add Wine
          </Link>
        </div>
        {wines.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No wines logged for this visit.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {wines.map((w) => (
              <Link
                key={w.id}
                href={`/dining/wine/${w.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 12,
                  backgroundColor: 'var(--surface-elevated, #2A292F)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: TEXT,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                  {w.producer} {w.name}
                </span>
                {w.vintage && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(220,38,38,0.12)',
                    color: TEXT,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {w.vintage}
                  </span>
                )}
                {w.color && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: TEXT_SEC,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {w.color.charAt(0).toUpperCase() + w.color.slice(1)}
                  </span>
                )}
                {w.rating != null && <Stars rating={w.rating} size={13} />}
                <span style={{ fontSize: 16, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href={`/nutrition/add?meal=${encodeURIComponent(`Dining at ${restaurantName || 'Unknown'}`)}&date=${visit.visited_at}&source=dining`}
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            backgroundColor: 'rgba(220,38,38,0.12)',
            border: '1px solid rgba(220,38,38,0.2)',
            color: ACCENT,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
            fontFamily: 'inherit',
          }}
        >
          Log to Nutrition
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,180,171,0.2)',
            color: '#FFB4AB',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Delete Visit
        </button>
      </div>

      {/* Timestamps */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: TEXT_SEC, paddingBottom: 20 }}>
        <span>Logged {formatDate(visit.created_at)}</span>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 20,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
};

const sectionHeading: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};
