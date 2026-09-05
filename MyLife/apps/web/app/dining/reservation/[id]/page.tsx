'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchReservation,
  fetchRestaurant,
  fetchBookingUrl,
  deleteReservationAction,
  cancelReservationAction,
  completeReservationAction,
  markNoShowAction,
} from '../../actions';

interface ReservationDetail {
  id: string;
  restaurant_id: string;
  reserved_at: string;
  party_size: number;
  confirmation_code: string | null;
  platform: string | null;
  status: 'upcoming' | 'completed' | 'cancelled' | 'no_show';
  cancel_reason: string | null;
  reminder_minutes: number | null;
  notes: string | null;
  visit_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RestaurantSummary {
  id: string;
  name: string;
}

const ACCENT = '#DC2626';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: 'rgba(139,207,240,0.15)', text: '#8BCFF0' },
  completed: { bg: 'rgba(48,209,88,0.15)', text: '#30D158' },
  cancelled: { bg: 'rgba(228,225,233,0.12)', text: 'rgba(228,225,233,0.6)' },
  no_show: { bg: 'rgba(255,180,171,0.15)', text: '#FFB4AB' },
};

const PLATFORM_LABELS: Record<string, string> = {
  resy: 'Resy',
  opentable: 'OpenTable',
  tock: 'Tock',
  yelp: 'Yelp',
  phone: 'Phone',
  walkin: 'Walk-in',
  other: 'Other',
};

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

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatReminder(minutes: number | null): string {
  if (minutes === null || minutes === 0) return 'None';
  if (minutes === 90) return '90 min before';
  if (minutes === 1440) return '1 day before';
  if (minutes === 10080) return '1 week before';
  return `${minutes} min before`;
}

export default function ReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const reservationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [reservation, setReservation] = useState<ReservationDetail | null | undefined>(undefined);
  const [restaurant, setRestaurant] = useState<RestaurantSummary | null>(null);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    void fetchReservation(reservationId).then((data) => {
      if (cancelled) return;
      const r = data as ReservationDetail | null;
      setReservation(r);
      if (r) {
        void fetchRestaurant(r.restaurant_id).then((rest) => {
          if (!cancelled && rest) setRestaurant({ id: rest.id, name: rest.name });
        });
        void fetchBookingUrl(r.restaurant_id).then((url) => {
          if (!cancelled) setBookingUrl(url);
        });
      }
    });
    return () => { cancelled = true; };
  }, [reservationId]);

  if (reservation === undefined) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading reservation...</p>;
  }

  if (!reservation) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Reservation not found</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          This reservation does not exist.
        </p>
        <Link href="/dining/reservations" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Reservations
        </Link>
      </div>
    );
  }

  const statusColors = STATUS_COLORS[reservation.status] ?? STATUS_COLORS.upcoming;

  const handleCancel = () => {
    const reason = prompt('Reason for cancellation (optional):');
    if (reason === null) return;
    void cancelReservationAction(reservation.id, reason || undefined).then(() => {
      setReservation((prev) => prev ? { ...prev, status: 'cancelled', cancel_reason: reason || null } : prev);
    });
  };

  const handleComplete = () => {
    void completeReservationAction(reservation.id).then(() => {
      setReservation((prev) => prev ? { ...prev, status: 'completed' } : prev);
    });
  };

  const handleNoShow = () => {
    if (!confirm('Mark this reservation as a no-show?')) return;
    void markNoShowAction(reservation.id).then(() => {
      setReservation((prev) => prev ? { ...prev, status: 'no_show' } : prev);
    });
  };

  const handleDelete = () => {
    if (!confirm('Delete this reservation? This cannot be undone.')) return;
    void deleteReservationAction(reservation.id).then(() => {
      router.push('/dining/reservations');
    });
  };

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        {restaurant && (
          <>
            <Link href={`/dining/restaurant/${restaurant.id}`} style={{ color: TEXT_SEC, textDecoration: 'none' }}>
              {restaurant.name}
            </Link>
            <span style={{ opacity: 0.4 }}>&gt;</span>
          </>
        )}
        <span style={{ color: TEXT }}>Reservation</span>
      </nav>

      {/* Header Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            {restaurant && (
              <Link
                href={`/dining/restaurant/${restaurant.id}`}
                style={{ color: ACCENT, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
              >
                {restaurant.name}
              </Link>
            )}
            <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: TEXT }}>
              {formatDate(reservation.reserved_at)}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 20, color: TEXT_SEC, fontWeight: 600 }}>
              {formatTime(reservation.reserved_at)}
            </p>
          </div>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'capitalize',
            }}
          >
            {reservation.status === 'no_show' ? 'No Show' : reservation.status}
          </span>
        </div>

        {/* Key details */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={detailChipStyle}>
            <span style={{ fontSize: 16 }}>{'\uD83D\uDC65'}</span>
            <span>Party of {reservation.party_size}</span>
          </div>
          {reservation.platform && (
            <div style={detailChipStyle}>
              <span style={{ fontSize: 16 }}>{'\uD83C\uDF7D\uFE0F'}</span>
              <span>{PLATFORM_LABELS[reservation.platform] ?? reservation.platform}</span>
            </div>
          )}
          {reservation.confirmation_code && (
            <div style={detailChipStyle}>
              <span style={{ fontSize: 16 }}>{'\uD83C\uDFAB'}</span>
              <span>{reservation.confirmation_code}</span>
            </div>
          )}
        </div>

        {/* Reminder */}
        {reservation.reminder_minutes != null && reservation.reminder_minutes > 0 && (
          <p style={{ margin: '0 0 16px', fontSize: 14, color: TEXT_SEC }}>
            Reminder: {formatReminder(reservation.reminder_minutes)}
          </p>
        )}

        {/* Notes */}
        {reservation.notes && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={sectionHeading}>Notes</h3>
            <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 15, lineHeight: 1.7 }}>
              {reservation.notes}
            </p>
          </div>
        )}

        {/* Cancel reason */}
        {reservation.status === 'cancelled' && reservation.cancel_reason && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={sectionHeading}>Cancellation Reason</h3>
            <p style={{ margin: '8px 0 0', color: '#FFB4AB', fontSize: 14 }}>
              {reservation.cancel_reason}
            </p>
          </div>
        )}

        {/* Visit link */}
        {reservation.status === 'completed' && reservation.visit_id && (
          <div style={{ marginBottom: 16 }}>
            <Link
              href={`/dining/visit/${reservation.visit_id}`}
              style={{ color: ACCENT, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
            >
              View linked visit
            </Link>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {reservation.status === 'upcoming' && bookingUrl && (
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
              Book Now
            </a>
          )}
          {reservation.status === 'upcoming' && (
            <Link
              href={`/rsvp/create?title=${encodeURIComponent(`Dinner at ${restaurant?.name ?? 'Restaurant'}`)}&date=${reservation.reserved_at}&capacity=${reservation.party_size}&source=dining`}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                color: '#8BCFF0',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Invite Friends
            </Link>
          )}
          {reservation.status === 'upcoming' && (
            <>
              <button
                type="button"
                onClick={handleComplete}
                style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: '#30D158',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Mark Complete
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: TEXT,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNoShow}
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
                No-Show
              </button>
            </>
          )}
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
            Delete
          </button>
        </div>
      </div>

      {/* Timestamps */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: TEXT_SEC, paddingBottom: 20 }}>
        <span>Created {formatDate(reservation.created_at)}</span>
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

const detailChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: 999,
  backgroundColor: 'var(--surface-elevated, #2A292F)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
};
