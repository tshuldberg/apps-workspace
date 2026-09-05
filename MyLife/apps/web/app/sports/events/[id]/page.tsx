import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { sportsGetAttendance, sportsGetVenue } from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';
import { AttendanceActionsClient } from './AttendanceActionsClient';

export const dynamic = 'force-dynamic';

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCost(cents: number): string {
  if (cents <= 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function starsText(rating: number | null): string {
  if (rating === null) return '—';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function SportsAttendanceDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const result = await sportsGetAttendance(id);
  if (!result.ok) notFound();
  const row = result.row;

  const venueResult = row.venue_id
    ? await sportsGetVenue(row.venue_id)
    : null;
  const venue = venueResult && venueResult.ok ? venueResult.venue : null;

  const seatParts: string[] = [];
  if (row.section) seatParts.push(`Section ${row.section}`);
  if (row.row_label) seatParts.push(`Row ${row.row_label}`);
  if (row.seat) seatParts.push(`Seat ${row.seat}`);

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Attendance</p>
      <h2 style={styles.title}>{row.venue_name}</h2>
      {venue?.city ? <p style={styles.subtitle}>{venue.city}</p> : null}

      <section style={styles.metaCard}>
        <MetaRow
          label="Attended at"
          value={formatDateTime(row.attended_at)}
        />
        <MetaRow label="Cost" value={formatCost(row.cost_cents)} />
        <MetaRow label="Rating" value={starsText(row.rating)} accent />
      </section>

      {seatParts.length > 0 ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Seat</p>
          <div style={styles.flatCard}>
            <p style={styles.bodyText}>{seatParts.join(' · ')}</p>
          </div>
        </section>
      ) : null}

      {row.companions.length > 0 ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Companions</p>
          <div style={styles.chipRow}>
            {row.companions.map((name) => (
              <span key={name} style={styles.companionChip}>
                {name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {row.tailgate_notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Tailgate</p>
          <div style={styles.flatCard}>
            <p style={styles.bodyText}>{row.tailgate_notes_md}</p>
          </div>
        </section>
      ) : null}

      {row.parking_notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Parking</p>
          <div style={styles.flatCard}>
            <p style={styles.bodyText}>{row.parking_notes_md}</p>
          </div>
        </section>
      ) : null}

      {row.notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Notes</p>
          <div style={styles.flatCard}>
            <p style={styles.bodyText}>{row.notes_md}</p>
          </div>
        </section>
      ) : null}

      {venue ? (
        <Link
          href={`/sports/events/venues/${encodeURIComponent(venue.id)}`}
          style={styles.linkCard}
        >
          View venue →
        </Link>
      ) : null}

      <AttendanceActionsClient id={row.id} />
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
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  companionChip: {
    padding: '6px 12px',
    borderRadius: 999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontSize: 13,
  },
  linkCard: {
    padding: 14,
    borderRadius: 12,
    border: `1px solid ${SPORTS_ACCENT}`,
    background: 'var(--surface)',
    color: SPORTS_ACCENT,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
};
