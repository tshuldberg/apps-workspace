'use client';

import type { Reservation } from '@/lib/reservations/types';
import { ReservationCard } from './ReservationCard';

interface DayViewProps {
  date: string;
  reservations: Reservation[];
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 10); // 10am to 11pm

export function DayView({ date, reservations }: DayViewProps) {
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      {/* Time header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <div style={{ width: '80px', flexShrink: 0 }} />
        {HOURS.map((hour) => (
          <div key={hour} style={{ width: '120px', flexShrink: 0, padding: '8px', fontSize: '0.75rem', color: 'var(--text-tertiary)', borderLeft: '1px solid var(--border)' }}>
            {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
          </div>
        ))}
      </div>

      {/* Reservation rows */}
      {reservations.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No reservations for {date}
        </div>
      ) : (
        reservations.map((res) => (
          <div key={res.id} style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: '48px', alignItems: 'center' }}>
            <div style={{ width: '80px', flexShrink: 0, padding: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              T{res.tableId?.slice(-2) ?? '--'}
            </div>
            <div style={{ flex: 1, padding: '4px 8px' }}>
              <ReservationCard reservation={res} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
