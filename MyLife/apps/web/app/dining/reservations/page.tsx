'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchUpcomingReservations,
  fetchReservations,
  fetchRestaurant,
} from '../actions';

interface ReservationRow {
  id: string;
  restaurant_id: string;
  reserved_at: string;
  party_size: number;
  platform: string | null;
  status: 'upcoming' | 'completed' | 'cancelled' | 'no_show';
  confirmation_code: string | null;
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

function formatDate(dateStr: string): string {
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

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ReservationsListPage() {
  const [upcoming, setUpcoming] = useState<ReservationRow[]>([]);
  const [past, setPast] = useState<ReservationRow[]>([]);
  const [restaurantNames, setRestaurantNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [upcomingData, completedData, cancelledData, noShowData] = await Promise.all([
          fetchUpcomingReservations(),
          fetchReservations({ status: 'completed', sort_by: 'reserved_at', sort_dir: 'DESC', limit: 50 }),
          fetchReservations({ status: 'cancelled', sort_by: 'reserved_at', sort_dir: 'DESC', limit: 50 }),
          fetchReservations({ status: 'no_show', sort_by: 'reserved_at', sort_dir: 'DESC', limit: 50 }),
        ]);

        if (cancelled) return;

        const upRows = upcomingData as ReservationRow[];
        const pastRows = [
          ...(completedData as ReservationRow[]),
          ...(cancelledData as ReservationRow[]),
          ...(noShowData as ReservationRow[]),
        ].sort((a, b) => b.reserved_at.localeCompare(a.reserved_at));

        setUpcoming(upRows);
        setPast(pastRows);

        // Resolve restaurant names
        const allIds = new Set([...upRows, ...pastRows].map((r) => r.restaurant_id));
        const names: Record<string, string> = {};
        await Promise.all(
          [...allIds].map(async (id) => {
            try {
              const rest = await fetchRestaurant(id);
              if (rest) names[id] = rest.name;
            } catch {
              // skip
            }
          }),
        );
        if (!cancelled) setRestaurantNames(names);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading reservations...</p>;
  }

  const totalUpcoming = upcoming.length;
  const totalPast = past.length;

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
            Reservations
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: TEXT_SEC }}>
            {totalUpcoming} upcoming, {totalPast} past
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/dining/reservation/import"
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              color: TEXT,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Import from Email
          </Link>
          <Link
            href="/dining/reservation/add"
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              backgroundColor: ACCENT,
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Add Reservation
          </Link>
        </div>
      </div>

      {/* Upcoming Section */}
      <section style={cardStyle}>
        <h2 style={sectionHeading}>Upcoming</h2>
        {upcoming.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No upcoming reservations.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {upcoming.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                restaurantName={restaurantNames[r.restaurant_id]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past Section */}
      <section style={cardStyle}>
        <h2 style={sectionHeading}>Past</h2>
        {past.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No past reservations.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {past.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                restaurantName={restaurantNames[r.restaurant_id]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReservationCard({
  reservation,
  restaurantName,
}: {
  reservation: ReservationRow;
  restaurantName?: string;
}) {
  const statusColors = STATUS_COLORS[reservation.status] ?? STATUS_COLORS.upcoming;

  return (
    <Link
      href={`/dining/reservation/${reservation.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        backgroundColor: 'var(--surface-elevated, #2A292F)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'var(--text)',
        flexWrap: 'wrap',
      }}
    >
      {/* Date/Time */}
      <div style={{ minWidth: 90 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>
          {formatDate(reservation.reserved_at)}
        </div>
        <div style={{ fontSize: 12, color: TEXT_SEC, opacity: 0.7 }}>
          {formatTime(reservation.reserved_at)}
        </div>
      </div>

      {/* Restaurant name */}
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
        {restaurantName ?? 'Unknown Restaurant'}
      </span>

      {/* Party size */}
      <span style={{ fontSize: 12, color: TEXT_SEC }}>
        {reservation.party_size}p
      </span>

      {/* Platform badge */}
      {reservation.platform && (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            backgroundColor: 'rgba(220,38,38,0.12)',
            color: 'var(--text)',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {PLATFORM_LABELS[reservation.platform] ?? reservation.platform}
        </span>
      )}

      {/* Status badge */}
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 999,
          backgroundColor: statusColors.bg,
          color: statusColors.text,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'capitalize',
        }}
      >
        {reservation.status === 'no_show' ? 'No Show' : reservation.status}
      </span>

      <span style={{ fontSize: 16, color: TEXT_SEC, opacity: 0.5 }}>{'\u203A'}</span>
    </Link>
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
