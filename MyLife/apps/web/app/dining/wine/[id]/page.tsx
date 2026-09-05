'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchWine, deleteWineAction, fetchRestaurant } from '../../actions';

interface WineDetail {
  id: string;
  visit_id: string | null;
  restaurant_id: string;
  producer: string;
  name: string;
  vintage: number | null;
  region: string | null;
  varietal: string | null;
  color: string | null;
  rating: number | null;
  price_cents: number | null;
  by_glass: number;
  pairing_notes: string | null;
  created_at: string;
  updated_at: string;
}

const COLOR_LABELS: Record<string, string> = {
  red: 'Red',
  white: 'White',
  rose: 'Ros\u00e9',
  sparkling: 'Sparkling',
  orange: 'Orange',
  dessert: 'Dessert',
};

const COLOR_HUES: Record<string, string> = {
  red: '#8B1A1A',
  white: '#D4C36A',
  rose: '#E8A0BF',
  sparkling: '#C9B44C',
  orange: '#E07020',
  dessert: '#B8860B',
};

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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function WineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const wineId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [wine, setWine] = useState<WineDetail | null | undefined>(undefined);
  const [restaurantName, setRestaurantName] = useState<string>('');

  useEffect(() => {
    if (!wineId) return;
    let cancelled = false;
    void fetchWine(wineId).then((data) => {
      if (cancelled) return;
      setWine(data as WineDetail | null);
      if (data) {
        void fetchRestaurant((data as WineDetail).restaurant_id).then((r) => {
          if (!cancelled && r) {
            setRestaurantName((r as { name: string }).name);
          }
        });
      }
    });
    return () => { cancelled = true; };
  }, [wineId]);

  if (wine === undefined) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading wine...</p>;
  }

  if (!wine) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Wine not found</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          This wine does not exist in your collection.
        </p>
        <Link href="/dining" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Restaurants
        </Link>
      </div>
    );
  }

  const handleDelete = () => {
    if (!confirm('Delete this wine? This cannot be undone.')) return;
    void deleteWineAction(wine.id).then(() => {
      if (wine.visit_id) {
        router.push(`/dining/visit/${wine.visit_id}`);
      } else {
        router.push(`/dining/restaurant/${wine.restaurant_id}`);
      }
    });
  };

  const colorLabel = wine.color ? COLOR_LABELS[wine.color] || wine.color : null;
  const colorHue = wine.color ? COLOR_HUES[wine.color] || 'rgba(255,255,255,0.1)' : null;

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        {restaurantName ? (
          <>
            <Link
              href={`/dining/restaurant/${wine.restaurant_id}`}
              style={{ color: TEXT_SEC, textDecoration: 'none' }}
            >
              {restaurantName}
            </Link>
            <span style={{ opacity: 0.4 }}>&gt;</span>
          </>
        ) : null}
        <span style={{ color: TEXT }}>{wine.name}</span>
      </nav>

      {/* Hero */}
      <div style={{ display: 'grid', gap: 8 }}>
        {restaurantName && (
          <Link
            href={`/dining/restaurant/${wine.restaurant_id}`}
            style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
          >
            {restaurantName}
          </Link>
        )}
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
          {wine.producer} {wine.name}
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {wine.vintage && (
            <span style={{
              padding: '4px 12px',
              borderRadius: 999,
              backgroundColor: 'rgba(220,38,38,0.12)',
              color: TEXT,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {wine.vintage}
            </span>
          )}
          {colorLabel && colorHue && (
            <span style={{
              padding: '4px 12px',
              borderRadius: 999,
              backgroundColor: `${colorHue}30`,
              color: colorHue,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {colorLabel}
            </span>
          )}
          {wine.rating != null && <Stars rating={wine.rating} size={20} />}
          {wine.price_cents != null && (
            <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
              ${(wine.price_cents / 100).toFixed(2)}
            </span>
          )}
          <span style={{
            padding: '4px 12px',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: TEXT_SEC,
            fontSize: 13,
            fontWeight: 600,
          }}>
            {wine.by_glass ? 'Glass' : 'Bottle'}
          </span>
        </div>
      </div>

      {/* Details */}
      {(wine.region || wine.varietal) && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Details</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {wine.region && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: TEXT_SEC, fontWeight: 600, minWidth: 60 }}>Region</span>
                <span style={{ fontSize: 15, color: TEXT }}>{wine.region}</span>
              </div>
            )}
            {wine.varietal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: TEXT_SEC, fontWeight: 600, minWidth: 60 }}>Varietal</span>
                <span style={{ fontSize: 15, color: TEXT }}>{wine.varietal}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Pairing Notes */}
      {wine.pairing_notes && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Pairing Notes</h2>
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 15, lineHeight: 1.7 }}>
            {wine.pairing_notes}
          </p>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
          Delete Wine
        </button>
      </div>

      {/* Timestamps */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: TEXT_SEC, paddingBottom: 20 }}>
        <span>Added {formatDate(wine.created_at)}</span>
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
