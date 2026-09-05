'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchRestaurant,
  updateRestaurantAction,
  deleteRestaurantAction,
  fetchVisitsByRestaurant,
  fetchDishesByRestaurant,
  fetchReservations,
  fetchBookingUrl,
  fetchBestPlatform,
} from '../../actions';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  kind: string;
}

interface RestaurantDetail {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  cuisines: string | null;
  price_tier: number | null;
  website_url: string | null;
  resy_url: string | null;
  opentable_url: string | null;
  tock_url: string | null;
  yelp_url: string | null;
  instagram_handle: string | null;
  notes_md: string | null;
  is_wishlist: number;
  is_visited: number;
  visit_count: number;
  average_rating: number | null;
  first_visited_at: string | null;
  last_visited_at: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

interface VisitRow {
  id: string;
  restaurant_id: string;
  visited_at: string;
  overall_rating: number;
  occasion: string | null;
  party_size: number | null;
}

interface DishRow {
  id: string;
  name: string;
  course: string | null;
  rating: number | null;
  would_order_again: number;
  allergens: string | null;
}

interface ReservationRow {
  id: string;
  restaurant_id: string;
  reserved_at: string;
  party_size: number;
  platform: string | null;
  status: 'upcoming' | 'completed' | 'cancelled' | 'no_show';
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.12)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  return (
    <span style={{ color: '#FFB877', fontSize: size, letterSpacing: 2 }}>
      {'★'.repeat(full)}
      {half ? '★' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

function parseCuisines(cuisines: string | null): string[] {
  if (!cuisines) return [];
  try {
    return JSON.parse(cuisines);
  } catch {
    return [cuisines];
  }
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

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const restaurantId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null | undefined>(undefined);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [bookingPlatform, setBookingPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    void fetchRestaurant(restaurantId).then((data) => {
      if (!cancelled) setRestaurant(data as RestaurantDetail | null);
    });
    void fetchVisitsByRestaurant(restaurantId).then((data) => {
      if (!cancelled) setVisits(data as VisitRow[]);
    });
    void fetchDishesByRestaurant(restaurantId).then((data) => {
      if (!cancelled) setDishes(data as DishRow[]);
    });
    void fetchReservations({ restaurant_id: restaurantId, sort_by: 'reserved_at', sort_dir: 'DESC', limit: 10 }).then((data) => {
      if (!cancelled) setReservations(data as ReservationRow[]);
    });
    void fetchBookingUrl(restaurantId).then((url) => {
      if (!cancelled) setBookingUrl(url);
    });
    void fetchBestPlatform(restaurantId).then((p) => {
      if (!cancelled) setBookingPlatform(p);
    });
    return () => { cancelled = true; };
  }, [restaurantId]);

  if (restaurant === undefined) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading restaurant...</p>;
  }

  if (!restaurant) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Restaurant not found</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          This restaurant is not in your collection.
        </p>
        <Link href="/dining" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Restaurants
        </Link>
      </div>
    );
  }

  const cuisines = parseCuisines(restaurant.cuisines);

  const handleDelete = () => {
    if (!confirm(`Delete "${restaurant.name}"? This cannot be undone.`)) return;
    void deleteRestaurantAction(restaurant.id).then(() => {
      router.push('/dining');
    });
  };

  const handleToggleWishlist = () => {
    void updateRestaurantAction(restaurant.id, {
      is_wishlist: restaurant.is_wishlist ? 0 : 1,
    }).then(() => {
      setRestaurant((prev) =>
        prev ? { ...prev, is_wishlist: prev.is_wishlist ? 0 : 1 } : prev,
      );
    });
  };

  const externalLinks = [
    { label: 'Resy', url: restaurant.resy_url, icon: '\uD83C\uDF7D\uFE0F' },
    { label: 'OpenTable', url: restaurant.opentable_url, icon: '\uD83D\uDCCB' },
    { label: 'Tock', url: restaurant.tock_url, icon: '\uD83C\uDFAB' },
    { label: 'Yelp', url: restaurant.yelp_url, icon: '\u2B50' },
    {
      label: 'Instagram',
      url: restaurant.instagram_handle
        ? `https://instagram.com/${restaurant.instagram_handle.replace('@', '')}`
        : null,
      icon: '\uD83D\uDCF7',
    },
    { label: 'Website', url: restaurant.website_url, icon: '\uD83C\uDF10' },
  ].filter((l) => l.url);

  const directionsUrl = restaurant.lat && restaurant.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`
    : restaurant.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.address)}`
      : null;

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>{restaurant.name}</span>
      </nav>

      {/* Hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        {/* Left: photo placeholder */}
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 16,
            backgroundColor: SURFACE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
            border: `1px solid ${BORDER}`,
          }}
        >
          {'\uD83C\uDF7D\uFE0F'}
        </div>

        {/* Right: metadata */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: TEXT }}>
              {restaurant.name}
            </h1>
            {(restaurant.neighborhood || restaurant.city) && (
              <p style={{ margin: '6px 0 0', fontSize: 16, color: TEXT_SEC }}>
                {[restaurant.neighborhood, restaurant.city].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {restaurant.price_tier && (
              <span style={{
                padding: '6px 14px',
                borderRadius: 999,
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                color: ACCENT,
                fontSize: 14,
                fontWeight: 700,
              }}>
                {PRICE_LABELS[restaurant.price_tier]}
              </span>
            )}
            {restaurant.average_rating != null && <Stars rating={restaurant.average_rating} />}
            {restaurant.is_visited === 1 && (
              <span style={{
                padding: '6px 12px',
                borderRadius: 999,
                backgroundColor: 'rgba(48,209,88,0.15)',
                fontSize: 13,
                fontWeight: 600,
                color: TEXT,
              }}>
                Visited {restaurant.visit_count > 0 ? `(${restaurant.visit_count}x)` : ''}
              </span>
            )}
            {restaurant.is_wishlist === 1 && (
              <span style={{
                padding: '6px 12px',
                borderRadius: 999,
                backgroundColor: ACCENT_DIM,
                fontSize: 13,
                fontWeight: 600,
                color: TEXT,
              }}>
                {'\u2764\uFE0F'} Wishlist
              </span>
            )}
            {restaurant.tags.some((t) => t.name.toLowerCase() === 'pet-friendly') && (
              <span style={{
                padding: '6px 12px',
                borderRadius: 999,
                backgroundColor: 'rgba(48,209,88,0.15)',
                fontSize: 13,
                fontWeight: 600,
                color: '#30D158',
              }}>
                {'\uD83D\uDC3E'} Pet-Friendly
              </span>
            )}
          </div>

          {cuisines.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cuisines.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: ACCENT,
                    backgroundColor: ACCENT_DIM,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  backgroundColor: ACCENT,
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                Book on {bookingPlatform === 'opentable' ? 'OpenTable' : bookingPlatform ? bookingPlatform.charAt(0).toUpperCase() + bookingPlatform.slice(1) : 'Platform'}
              </a>
            )}
            <Link
              href={`/dining/reservation/add?restaurantId=${restaurant.id}`}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                color: TEXT,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Add Reservation
            </Link>
            <Link
              href={`/dining/restaurant/${restaurant.id}/edit`}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                color: TEXT,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={handleToggleWishlist}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                color: TEXT,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {restaurant.is_wishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
            </button>
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
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tags */}
      {restaurant.tags.length > 0 && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Tags</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {restaurant.tags.map((tag) => (
              <span
                key={tag.id}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  backgroundColor: tag.color ? `${tag.color}20` : 'rgba(255,255,255,0.06)',
                  color: tag.color || TEXT_SEC,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {restaurant.notes_md && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Notes</h2>
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 15, lineHeight: 1.7 }}>
            {restaurant.notes_md}
          </p>
        </section>
      )}

      {/* Visit History */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionHeading}>Visit History</h2>
          <Link
            href={`/dining/visit/add?restaurantId=${restaurant.id}`}
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
            Log Visit
          </Link>
        </div>
        {visits.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No visits logged yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {visits.slice(0, 5).map((v) => (
              <Link
                key={v.id}
                href={`/dining/visit/${v.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 12,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  textDecoration: 'none',
                  color: TEXT,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC, minWidth: 70 }}>
                  {formatDate(v.visited_at)}
                </span>
                <Stars rating={v.overall_rating} size={13} />
                {v.occasion && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: ACCENT_DIM,
                    color: TEXT,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {v.occasion}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 16, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
              </Link>
            ))}
            {visits.length > 5 && (
              <Link
                href={`/dining/visits?restaurant=${restaurant.id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: ACCENT,
                  textDecoration: 'none',
                }}
              >
                View all {visits.length} visits
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Reservations */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionHeading}>Reservations</h2>
          <Link
            href={`/dining/reservation/add?restaurantId=${restaurant.id}`}
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
            Add Reservation
          </Link>
        </div>
        {reservations.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No reservations yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {reservations.slice(0, 5).map((r) => {
              const statusMap: Record<string, { bg: string; text: string }> = {
                upcoming: { bg: 'rgba(139,207,240,0.15)', text: '#8BCFF0' },
                completed: { bg: 'rgba(48,209,88,0.15)', text: '#30D158' },
                cancelled: { bg: 'rgba(228,225,233,0.12)', text: 'rgba(228,225,233,0.6)' },
                no_show: { bg: 'rgba(255,180,171,0.15)', text: '#FFB4AB' },
              };
              const sc = statusMap[r.status] ?? statusMap.upcoming;
              return (
                <Link
                  key={r.id}
                  href={`/dining/reservation/${r.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    backgroundColor: SURFACE,
                    border: `1px solid ${BORDER}`,
                    textDecoration: 'none',
                    color: TEXT,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC, minWidth: 70 }}>
                    {formatDate(r.reserved_at)}
                  </span>
                  <span style={{ fontSize: 13, color: TEXT_SEC }}>
                    {r.party_size}p
                  </span>
                  {r.platform && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: ACCENT_DIM,
                      color: TEXT,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {r.platform === 'opentable' ? 'OpenTable' : r.platform.charAt(0).toUpperCase() + r.platform.slice(1)}
                    </span>
                  )}
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: sc.bg,
                    color: sc.text,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    marginLeft: 'auto',
                  }}>
                    {r.status === 'no_show' ? 'No Show' : r.status}
                  </span>
                  <span style={{ fontSize: 16, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
                </Link>
              );
            })}
            {reservations.length > 5 && (
              <Link
                href={`/dining/reservations?restaurant=${restaurant.id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: ACCENT,
                  textDecoration: 'none',
                }}
              >
                View all {reservations.length} reservations
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Dishes */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionHeading}>Dishes</h2>
          <Link
            href={`/dining/dish/add?restaurantId=${restaurant.id}`}
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
            No dishes recorded yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {dishes.slice(0, 5).map((d) => {
              const allergens = parseAllergens(d.allergens);
              return (
                <Link
                  key={d.id}
                  href={`/dining/dish/${d.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    backgroundColor: SURFACE,
                    border: `1px solid ${BORDER}`,
                    textDecoration: 'none',
                    color: TEXT,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                  {d.course && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: ACCENT_DIM,
                      color: TEXT,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {d.course.charAt(0).toUpperCase() + d.course.slice(1)}
                    </span>
                  )}
                  {d.rating != null && <Stars rating={d.rating} size={13} />}
                  {d.would_order_again === 1 && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: 'rgba(48,209,88,0.15)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: TEXT,
                    }}>
                      Reorder
                    </span>
                  )}
                  {allergens.length > 0 && allergens.map((a) => (
                    <span
                      key={a}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        color: '#F59E0B',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {a}
                    </span>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: 16, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
                </Link>
              );
            })}
            {dishes.length > 5 && (
              <p style={{
                textAlign: 'center',
                padding: '8px 0',
                fontSize: 13,
                fontWeight: 600,
                color: ACCENT,
                margin: 0,
              }}>
                {dishes.length - 5} more dishes
              </p>
            )}
          </div>
        )}
      </section>

      {/* External Links */}
      {externalLinks.length > 0 && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Links</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {externalLinks.map((link) => (
              <a
                key={link.label}
                href={link.url!}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 12,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: TEXT,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Directions */}
      {directionsUrl && (
        <section style={cardStyle}>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textDecoration: 'none',
              color: TEXT,
            }}
          >
            <span style={{ fontSize: 24 }}>{'\uD83D\uDCCD'}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>
                Get Directions
              </p>
              {restaurant.address && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>
                  {restaurant.address}
                </p>
              )}
            </div>
            <span style={{ fontSize: 20, color: TEXT_SEC }}>{'\u203A'}</span>
          </a>
        </section>
      )}

      {/* Timestamps */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: TEXT_SEC, paddingBottom: 20 }}>
        <span>Added {formatDate(restaurant.created_at)}</span>
        {restaurant.last_visited_at && (
          <span>Last visited {formatDate(restaurant.last_visited_at)}</span>
        )}
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
