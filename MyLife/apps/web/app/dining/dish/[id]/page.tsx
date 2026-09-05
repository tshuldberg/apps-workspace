'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchDish, deleteDishAction, fetchRestaurant } from '../../actions';

interface DishDetail {
  id: string;
  visit_id: string | null;
  restaurant_id: string;
  name: string;
  course: string | null;
  price_cents: number | null;
  rating: number | null;
  would_order_again: number;
  allergens: string | null;
  notes: string | null;
  photo_id: string | null;
  created_at: string;
  updated_at: string;
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

function parseAllergens(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
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

export default function DishDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const dishId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [dish, setDish] = useState<DishDetail | null | undefined>(undefined);
  const [restaurantName, setRestaurantName] = useState<string>('');

  useEffect(() => {
    if (!dishId) return;
    let cancelled = false;
    void fetchDish(dishId).then((data) => {
      if (cancelled) return;
      setDish(data as DishDetail | null);
      if (data) {
        void fetchRestaurant((data as DishDetail).restaurant_id).then((r) => {
          if (!cancelled && r) {
            setRestaurantName((r as { name: string }).name);
          }
        });
      }
    });
    return () => { cancelled = true; };
  }, [dishId]);

  if (dish === undefined) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading dish...</p>;
  }

  if (!dish) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Dish not found</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          This dish does not exist in your collection.
        </p>
        <Link href="/dining" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Restaurants
        </Link>
      </div>
    );
  }

  const allergens = parseAllergens(dish.allergens);

  const handleDelete = () => {
    if (!confirm('Delete this dish? This cannot be undone.')) return;
    void deleteDishAction(dish.id).then(() => {
      if (dish.visit_id) {
        router.push(`/dining/visit/${dish.visit_id}`);
      } else {
        router.push(`/dining/restaurant/${dish.restaurant_id}`);
      }
    });
  };

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        {restaurantName ? (
          <>
            <Link
              href={`/dining/restaurant/${dish.restaurant_id}`}
              style={{ color: TEXT_SEC, textDecoration: 'none' }}
            >
              {restaurantName}
            </Link>
            <span style={{ opacity: 0.4 }}>&gt;</span>
          </>
        ) : null}
        <span style={{ color: TEXT }}>{dish.name}</span>
      </nav>

      {/* Hero */}
      <div style={{ display: 'grid', gap: 8 }}>
        {restaurantName && (
          <Link
            href={`/dining/restaurant/${dish.restaurant_id}`}
            style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
          >
            {restaurantName}
          </Link>
        )}
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
          {dish.name}
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {dish.course && (
            <span style={{
              padding: '4px 12px',
              borderRadius: 999,
              backgroundColor: 'rgba(220,38,38,0.12)',
              color: TEXT,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {dish.course.charAt(0).toUpperCase() + dish.course.slice(1)}
            </span>
          )}
          {dish.rating != null && <Stars rating={dish.rating} size={20} />}
          {dish.price_cents != null && (
            <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
              ${(dish.price_cents / 100).toFixed(2)}
            </span>
          )}
          {dish.would_order_again === 1 && (
            <span style={{
              padding: '4px 12px',
              borderRadius: 999,
              backgroundColor: 'rgba(48,209,88,0.15)',
              fontSize: 13,
              fontWeight: 600,
              color: TEXT,
            }}>
              Would order again
            </span>
          )}
        </div>
      </div>

      {/* Allergens */}
      {allergens.length > 0 && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Allergens</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {allergens.map((a) => (
              <span
                key={a}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  color: '#F59E0B',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {a}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {dish.notes && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Notes</h2>
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 15, lineHeight: 1.7 }}>
            {dish.notes}
          </p>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href={`/recipes/add?name=${encodeURIComponent(`${dish.name} (inspired by ${restaurantName || 'Unknown'})`)}&notes=${encodeURIComponent([dish.notes, dish.course ? `Course: ${dish.course}` : null, `Inspired by a dish at ${restaurantName || 'Unknown'}`].filter(Boolean).join('\n'))}&source=dining`}
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
          Recreate as Recipe
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
          Delete Dish
        </button>
      </div>

      {/* Timestamps */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: TEXT_SEC, paddingBottom: 20 }}>
        <span>Added {formatDate(dish.created_at)}</span>
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
