import type { CSSProperties } from 'react';
import Link from 'next/link';
import { listTrips, type TripRow } from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelPanel, styles as panelStyles } from './_ui';

type FilterKey = 'all' | 'upcoming' | 'past' | 'draft';

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'draft', label: 'Draft' },
];

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

function matchesFilter(trip: TripRow, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'upcoming':
      return trip.status === 'upcoming' || trip.status === 'active';
    case 'past':
      return trip.status === 'completed';
    case 'draft':
      return trip.status === 'planning';
    default:
      return true;
  }
}

function sortByStart(a: TripRow, b: TripRow): number {
  const ak = a.start_date ?? a.created_at;
  const bk = b.start_date ?? b.created_at;
  if (ak === bk) return 0;
  return ak < bk ? 1 : -1;
}

function normalizeFilter(raw: string | string[] | undefined): FilterKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'upcoming' || value === 'past' || value === 'draft') return value;
  return 'all';
}

function loadTrips(): { trips: TripRow[]; error: string | null } {
  try {
    ensureModuleMigrations('travel');
    return { trips: listTrips(getAdapter()), error: null };
  } catch {
    return { trips: [], error: 'Failed to load trips.' };
  }
}

export default async function TravelTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const sp = await searchParams;
  const filter = normalizeFilter(sp?.status);
  const { trips, error } = loadTrips();
  const visible = trips.filter((t) => matchesFilter(t, filter)).sort(sortByStart);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Trips"
        title={trips.length > 0 ? 'Your trips' : 'Plan your first trip'}
        body={
          trips.length > 0
            ? 'Past, present, and future trips live here.'
            : 'Start with a name and dates. You can fill in the rest later.'
        }
      >
        <div style={panelStyles.ctaRow}>
          <Link href="/travel/trip/create" style={panelStyles.primaryLink}>
            + New trip
          </Link>
        </div>
      </TravelPanel>

      {trips.length > 0 ? (
        <nav aria-label="Filter trips" style={localStyles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const href = f.id === 'all' ? '/travel' : `/travel?status=${f.id}`;
            return (
              <Link
                key={f.id}
                href={href}
                style={{
                  ...localStyles.filterChip,
                  ...(active ? localStyles.filterChipActive : null),
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {error ? (
        <section style={localStyles.errorPanel}>
          <p style={localStyles.errorText}>{error}</p>
        </section>
      ) : trips.length === 0 ? (
        <section style={localStyles.emptyPanel}>
          <h3 style={localStyles.emptyTitle}>No trips yet</h3>
          <p style={localStyles.emptyBody}>
            Click "+ New trip" to plan your first itinerary. Everything stays on
            this device.
          </p>
        </section>
      ) : visible.length === 0 ? (
        <section style={localStyles.emptyPanel}>
          <h3 style={localStyles.emptyTitle}>No trips match this filter</h3>
          <p style={localStyles.emptyBody}>
            Try a different filter or create a new trip.
          </p>
        </section>
      ) : (
        <section style={localStyles.list}>
          {visible.map((trip) => {
            const destinations = parseDestinations(trip.destination_ids);
            return (
              <Link
                key={trip.id}
                href={`/travel/trip/${trip.id}`}
                style={localStyles.card}
              >
                <span style={localStyles.cardStatus}>
                  {trip.status.toUpperCase()}
                </span>
                <span style={localStyles.cardTitle}>{trip.name}</span>
                <span style={localStyles.cardMeta}>
                  {destinations.length > 0
                    ? destinations.join(', ')
                    : 'Destination not set'}
                </span>
                <span style={localStyles.cardMeta}>
                  {formatDateRange(trip.start_date, trip.end_date)}
                </span>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}

const localStyles: Record<string, CSSProperties> = {
  list: {
    display: 'grid',
    gap: 12,
  },
  card: {
    display: 'grid',
    gap: 4,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    textDecoration: 'none',
    color: 'var(--text)',
  },
  cardStatus: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#0EA5E9',
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 1.3,
    fontWeight: 700,
    color: 'var(--text)',
  },
  cardMeta: {
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  },
  filterChipActive: {
    background: '#0EA5E9',
    borderColor: '#0EA5E9',
    color: '#0E0E13',
  },
  emptyPanel: {
    display: 'grid',
    gap: 8,
    padding: 20,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  emptyBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  errorPanel: {
    padding: 16,
    borderRadius: 14,
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'rgba(255,180,171,0.08)',
  },
  errorText: {
    margin: 0,
    color: '#FFB4AB',
    fontSize: 14,
  },
};
