import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getTripById,
  listActivitiesByDay,
  listBookings,
  listDaysByTrip,
  listPackingItems,
  listPackingListsByTrip,
  listUpcomingBookings,
  type ActivityRow,
  type BookingRow,
  type ItineraryDayRow,
  type PackingListRow,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TripTabs } from './TripTabs';

function parseDestinations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates not set';
  if (start && end) return `${start} to ${end}`;
  return start ?? end ?? 'Dates not set';
}

export default async function TravelTripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  ensureModuleMigrations('travel');
  const adapter = getAdapter();
  const trip = getTripById(adapter, id);
  if (!trip) notFound();

  const destinations = parseDestinations(trip.destination_ids);

  let days: ItineraryDayRow[] = [];
  const activitiesByDay: Record<string, ActivityRow[]> = {};
  let itineraryError: string | null = null;
  try {
    days = listDaysByTrip(adapter, trip.id);
    for (const day of days) {
      activitiesByDay[day.id] = listActivitiesByDay(adapter, day.id);
    }
  } catch {
    itineraryError = 'Failed to load itinerary.';
  }

  let bookings: BookingRow[] = [];
  let upcomingBookings: BookingRow[] = [];
  let bookingsError: string | null = null;
  try {
    bookings = listBookings(adapter, { tripId: trip.id });
    upcomingBookings = listUpcomingBookings(adapter, {
      tripId: trip.id,
      withinDays: 30,
    });
  } catch {
    bookingsError = 'Failed to load bookings.';
  }

  let packingLists: Array<{
    list: PackingListRow;
    total: number;
    packed: number;
  }> = [];
  let packingError: string | null = null;
  try {
    const lists = listPackingListsByTrip(adapter, trip.id);
    packingLists = lists.map((list) => {
      const items = listPackingItems(adapter, { listId: list.id });
      const packed = items.filter((i) => i.packed === 1).length;
      return { list, total: items.length, packed };
    });
  } catch {
    packingError = 'Failed to load packing lists.';
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.backRow}>
        <Link href="/travel" style={styles.backLink}>
          Back to Trips
        </Link>
      </div>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>{trip.status.toUpperCase()}</p>
        <h2 style={styles.title}>{trip.name}</h2>
        <p style={styles.meta}>
          {destinations.length > 0 ? destinations.join(', ') : 'Destination not set'}
        </p>
        <p style={styles.meta}>{formatDateRange(trip.start_date, trip.end_date)}</p>
        {trip.trip_type ? (
          <span style={styles.typeChip}>{trip.trip_type.replace('_', ' ')}</span>
        ) : null}
      </section>

      <TripTabs
        tripId={trip.id}
        days={days}
        activitiesByDay={activitiesByDay}
        itineraryError={itineraryError}
        bookings={bookings}
        upcomingBookings={upcomingBookings}
        bookingsError={bookingsError}
        packingLists={packingLists}
        packingError={packingError}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backRow: { display: 'flex' },
  backLink: {
    color: '#7DD3FC',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  panel: {
    display: 'grid',
    gap: 8,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#7DD3FC',
  },
  title: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
  },
  meta: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  typeChip: {
    justifySelf: 'start',
    marginTop: 4,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(14,165,233,0.32)',
    background: 'rgba(14,165,233,0.12)',
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
};
