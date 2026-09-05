'use client';

import type { Reservation } from '@/lib/reservations/types';
import { STATUS_COLORS } from '@/lib/reservations/types';

interface ReservationCardProps {
  reservation: Reservation;
}

export function ReservationCard({ reservation: res }: ReservationCardProps) {
  const time = new Date(res.scheduledAt);
  const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        background: `${STATUS_COLORS[res.status]}15`,
        border: `1px solid ${STATUS_COLORS[res.status]}40`,
        fontSize: '0.8125rem',
      }}
    >
      <span style={{ color: STATUS_COLORS[res.status], fontWeight: 600 }}>{timeStr}</span>
      <span style={{ color: 'var(--text)' }}>{res.partySize}p</span>
      {res.source !== 'web_widget' && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
          {res.source.replace('_', ' ')}
        </span>
      )}
      {res.dietaryNotes && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>&#9888;</span>}
    </div>
  );
}
