import type { CSSProperties } from 'react';
import type { Venue } from '@mylife/sports';
import { sportsListVenues } from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';
import { VenuesListClient } from './VenuesListClient';

export const dynamic = 'force-dynamic';

export default async function SportsVenuesPage() {
  const result = await sportsListVenues();
  const venues: Venue[] = result.ok ? result.venues : [];
  const error = !result.ok ? result.error : null;

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Venues</p>
      <h2 style={styles.title}>Stadiums + bucket list</h2>
      <p style={styles.subtitle}>
        Track stadiums you've been to and the ones you want to visit.
      </p>
      {error ? <p style={styles.error}>Error: {error}</p> : null}
      <VenuesListClient venues={venues} />
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
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
