import Link from 'next/link';
import { fetchTripDays, fetchTrips } from '../actions';
import { formatRangeLabel, TEXT, TEXT_SEC, TEXT_TER } from '../ui';
import { TrailsActionLink, TrailsChip, TrailsHero, TrailsPanel, TrailsSymbol } from '../shell';

type Trip = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

export default async function TrailsTripsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab = params.tab ?? 'upcoming';

  const trips = (await fetchTrips()) as Trip[];
  const tripCards = await Promise.all(
    trips.map(async (trip) => ({
      trip,
      dayCount: (await fetchTripDays(trip.id)).length,
    })),
  );

  const now = Date.now();
  const categorized = {
    upcoming: tripCards.filter(({ trip }) => trip.startDate && new Date(trip.startDate).getTime() >= now),
    past: tripCards.filter(({ trip }) => trip.endDate && new Date(trip.endDate).getTime() < now),
    drafts: tripCards.filter(({ trip }) => !trip.startDate && !trip.endDate),
  };

  const visibleTrips = categorized[activeTab as keyof typeof categorized] ?? categorized.upcoming;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Trips"
        title="Upcoming, past, and draft expeditions in one planning board."
        description="Desktop trip planning mirrors the mobile planner with tabbed boards, strong itinerary cards, and direct links into detailed trip layouts."
        actions={
          <>
            <TrailsActionLink href="/trails/packing" symbol="checklist">
              Packing Library
            </TrailsActionLink>
            <TrailsActionLink href="/trails/weather" symbol="partly_cloudy_day" secondary>
              Weather Overlay
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          ['upcoming', `Upcoming (${categorized.upcoming.length})`],
          ['past', `Past (${categorized.past.length})`],
          ['drafts', `Drafts (${categorized.drafts.length})`],
        ].map(([key, label]) => (
          <Link key={key} href={`/trails/trips?tab=${key}`}>
            <TrailsChip label={label} active={activeTab === key} subtle={activeTab !== key} />
          </Link>
        ))}
      </div>

      <TrailsPanel eyebrow="Trip Board" title="Adventure Trip Planner">
        {visibleTrips.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            {visibleTrips.map(({ trip, dayCount }) => (
              <Link key={trip.id} href={`/trails/trips/${trip.id}`} style={tripCardStyle}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <strong style={{ fontSize: 17, color: TEXT }}>{trip.name}</strong>
                    <TrailsSymbol name="arrow_outward" size={18} color={TEXT_TER} />
                  </div>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatRangeLabel(trip.startDate, trip.endDate)}</span>
                  <p style={{ margin: 0, color: TEXT_SEC, fontSize: 13, lineHeight: 1.6 }}>
                    {trip.notes ?? 'Multi-day desktop plan ready for itinerary, gear, and route attachments.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <MetaPill label={`${dayCount} day${dayCount === 1 ? '' : 's'}`} />
                  <MetaPill label={activeTab === 'drafts' ? 'Draft' : 'Planned'} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: TEXT_SEC }}>No trips in this tab yet. Create them on mobile or seed a draft here later.</p>
        )}
      </TrailsPanel>
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
        color: TEXT_SEC,
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

const tripCardStyle = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 24,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};
