'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Venue } from '@mylife/sports';
import {
  sportsDeleteVenue,
  sportsMarkVenueVisited,
  sportsSetVenueBucketList,
} from '../../../actions';
import { SPORTS_ACCENT } from '../../../_ui';

type Props = {
  venue: Venue;
};

export function VenueActionsClient({ venue }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visitedOn = venue.visited === 1;
  const bucketOn = venue.bucket_list === 1;

  const handleMarkVisited = () => {
    setError(null);
    startTransition(async () => {
      const res = await sportsMarkVenueVisited(venue.id, Date.now());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleBucket = () => {
    setError(null);
    startTransition(async () => {
      const res = await sportsSetVenueBucketList(venue.id, !bucketOn);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        'Delete this venue? Attendance rows will keep the name but lose the link.',
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await sportsDeleteVenue(venue.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/sports/events/venues');
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      {!visitedOn ? (
        <button
          type="button"
          onClick={handleMarkVisited}
          style={styles.primaryBtn}
          disabled={isPending}
        >
          {isPending ? 'Working…' : 'Mark visited'}
        </button>
      ) : (
        <div style={styles.visitedBanner}>
          ✓ Visited
          {venue.last_visit_at
            ? ` · last ${new Date(venue.last_visit_at).toLocaleDateString()}`
            : ''}
        </div>
      )}

      <button
        type="button"
        onClick={handleBucket}
        style={{
          ...styles.toggleBtn,
          ...(bucketOn ? styles.toggleBtnActive : {}),
        }}
        disabled={isPending}
      >
        {bucketOn ? '★ On bucket list' : 'Add to bucket list'}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        style={styles.destructiveBtn}
        disabled={isPending}
      >
        {isPending ? 'Working…' : 'Delete venue'}
      </button>

      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 10 },
  primaryBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  toggleBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  toggleBtnActive: {
    border: '1px solid #FFB877',
    color: '#FFB877',
  },
  destructiveBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid #F87171',
    background: 'var(--surface)',
    color: '#F87171',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  visitedBanner: {
    padding: '12px 18px',
    borderRadius: 12,
    border: `1px solid ${SPORTS_ACCENT}`,
    background: 'var(--surface)',
    color: SPORTS_ACCENT,
    fontSize: 14,
    fontWeight: 800,
    textAlign: 'center',
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
