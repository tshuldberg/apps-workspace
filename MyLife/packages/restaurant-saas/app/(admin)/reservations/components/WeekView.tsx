'use client';

import type { Reservation } from '@/lib/reservations/types';
import { STATUS_COLORS } from '@/lib/reservations/types';

interface WeekViewProps {
  startDate: string;
  reservations: Reservation[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekView({ startDate, reservations }: WeekViewProps) {
  const start = new Date(startDate);
  const dayOfWeek = start.getDay();
  const monday = new Date(start);
  monday.setDate(start.getDate() - ((dayOfWeek + 6) % 7));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
      {weekDays.map((day, i) => {
        const dayRes = reservations.filter((r) => r.scheduledAt.startsWith(day));
        const isToday = day === new Date().toISOString().split('T')[0];
        return (
          <div
            key={day}
            style={{
              background: 'var(--surface-low)',
              borderRadius: '8px',
              border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
              padding: '12px',
              minHeight: '120px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{DAYS[i]}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text)', marginBottom: '8px' }}>
              {new Date(day + 'T12:00:00').getDate()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {dayRes.length} booking{dayRes.length !== 1 ? 's' : ''}
            </div>
            {dayRes.slice(0, 3).map((r) => (
              <div key={r.id} style={{ marginTop: '4px', padding: '2px 6px', borderRadius: '4px', background: `${STATUS_COLORS[r.status]}22`, fontSize: '0.6875rem', color: STATUS_COLORS[r.status] }}>
                {new Date(r.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {r.partySize}p
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
