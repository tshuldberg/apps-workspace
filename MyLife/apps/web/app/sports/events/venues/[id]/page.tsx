import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { sportsGetVenue, sportsListAttendance } from '../../../actions';
import { SPORTS_ACCENT } from '../../../_ui';
import { VenueActionsClient } from './VenueActionsClient';

export const dynamic = 'force-dynamic';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function starsText(rating: number | null): string {
  if (rating === null) return '—';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function SportsVenueDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const result = await sportsGetVenue(id);
  if (!result.ok) notFound();
  const venue = result.venue;

  const attendanceResult = await sportsListAttendance({ venueId: id });
  const visitsCount = attendanceResult.ok ? attendanceResult.rows.length : 0;

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Venue</p>
      <h2 style={styles.title}>{venue.name}</h2>
      {venue.city || venue.country ? (
        <p style={styles.subtitle}>
          {[venue.city, venue.country].filter(Boolean).join(', ')}
        </p>
      ) : null}

      <section style={styles.metaCard}>
        <MetaRow label="Sport" value={venue.sport ?? '—'} />
        <MetaRow label="Team" value={venue.team ?? '—'} />
        <MetaRow
          label="Capacity"
          value={venue.capacity ? venue.capacity.toLocaleString() : '—'}
        />
        <MetaRow label="Visits" value={String(visitsCount)} accent />
        <MetaRow
          label="First visit"
          value={venue.first_visit_at ? formatDate(venue.first_visit_at) : '—'}
        />
        <MetaRow
          label="Last visit"
          value={venue.last_visit_at ? formatDate(venue.last_visit_at) : '—'}
        />
        <MetaRow label="Rating" value={starsText(venue.rating)} accent />
      </section>

      {venue.notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Notes</p>
          <div style={styles.flatCard}>
            <p style={styles.bodyText}>{venue.notes_md}</p>
          </div>
        </section>
      ) : null}

      <VenueActionsClient venue={venue} />
    </div>
  );
}

function MetaRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={styles.metaRow}>
      <span style={styles.metaLabel}>{label}</span>
      <span
        style={{
          ...styles.metaValue,
          ...(accent ? styles.accent : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    color: 'var(--text)',
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  metaCard: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: 'var(--text)',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  accent: {
    color: SPORTS_ACCENT,
    fontWeight: 700,
  },
  block: { display: 'grid', gap: 10 },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  flatCard: {
    padding: 14,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  bodyText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
  },
};
