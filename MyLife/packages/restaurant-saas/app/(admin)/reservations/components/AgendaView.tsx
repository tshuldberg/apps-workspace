'use client';

import type { Reservation } from '@/lib/reservations/types';
import { STATUS_COLORS } from '@/lib/reservations/types';

interface AgendaViewProps {
  date: string;
  reservations: Reservation[];
}

export function AgendaView({ date, reservations }: AgendaViewProps) {
  const sorted = [...reservations].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>
        {sorted.length} reservation{sorted.length !== 1 ? 's' : ''} on {date}
      </div>
      {sorted.map((res) => {
        const time = new Date(res.scheduledAt);
        const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return (
          <div
            key={res.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'var(--surface-low)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ width: '4px', height: '32px', borderRadius: '2px', background: STATUS_COLORS[res.status] }} />
            <div style={{ width: '60px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{timeStr}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                Party of {res.partySize}
                {res.occasion && <span style={{ color: 'var(--warm)', marginLeft: '8px' }}>({res.occasion})</span>}
              </div>
              {res.dietaryNotes && (
                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px' }}>
                  &#9888; {res.dietaryNotes}
                </div>
              )}
            </div>
            <div style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: STATUS_COLORS[res.status],
              background: `${STATUS_COLORS[res.status]}22`,
            }}>
              {res.status}
            </div>
          </div>
        );
      })}
    </div>
  );
}
