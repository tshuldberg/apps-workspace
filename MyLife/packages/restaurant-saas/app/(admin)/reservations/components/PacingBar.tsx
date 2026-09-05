'use client';

import type { Reservation } from '@/lib/reservations/types';
import { calculatePacing } from '@/lib/reservations/availability';

interface PacingBarProps {
  reservations: Reservation[];
  kitchenCapacity: number;
}

export function PacingBar({ reservations, kitchenCapacity }: PacingBarProps) {
  const pacing = calculatePacing(
    reservations.map((r) => ({
      tableId: r.tableId,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      status: r.status,
    })),
  );

  const slots = Array.from(pacing.entries()).sort(([a], [b]) => a.localeCompare(b));
  const maxCovers = Math.max(kitchenCapacity, ...slots.map(([, count]) => count));

  return (
    <div style={{ padding: '12px 16px', background: 'var(--surface-low)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pacing (covers/15min)</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Kitchen capacity: {kitchenCapacity}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
        {slots.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>No bookings yet</span>
        ) : (
          slots.map(([time, count]) => {
            const height = (count / maxCovers) * 100;
            const overCapacity = count > kitchenCapacity;
            return (
              <div
                key={time}
                title={`${time}: ${count} covers`}
                style={{
                  flex: 1,
                  height: `${height}%`,
                  minHeight: '4px',
                  borderRadius: '2px 2px 0 0',
                  background: overCapacity ? 'var(--danger)' : 'var(--accent)',
                  opacity: overCapacity ? 1 : 0.7,
                }}
              />
            );
          })
        )}
      </div>
      {/* Capacity line */}
      {slots.length > 0 && (
        <div style={{ position: 'relative', marginTop: '-20px', height: '1px', background: 'var(--danger)', opacity: 0.5 }} />
      )}
    </div>
  );
}
