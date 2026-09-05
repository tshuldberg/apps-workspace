'use client';

import { useState } from 'react';
import { DayView } from './components/DayView';
import { AgendaView } from './components/AgendaView';
import { WeekView } from './components/WeekView';
import { PacingBar } from './components/PacingBar';
import type { Reservation } from '@/lib/reservations/types';

type CalendarView = 'day' | 'agenda' | 'week';

// Mock data for UI development
const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: '1',
    restaurantId: 'r1',
    dinerId: null,
    partySize: 4,
    scheduledAt: new Date().toISOString(),
    durationMinutes: 90,
    tableId: 't1',
    source: 'web_widget',
    status: 'confirmed',
    occasion: 'Birthday',
    specialRequests: null,
    dietaryNotes: 'Gluten-free',
    policyVersionId: null,
    consentAt: null,
    consentIp: null,
    paymentIntentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function ReservationsPage() {
  const [view, setView] = useState<CalendarView>('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const viewBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text)' : 'var(--text-secondary)',
    background: active ? 'var(--glass-strong)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Reservations</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.8125rem',
            }}
          />
          <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', padding: '3px' }}>
            <button onClick={() => setView('day')} style={viewBtnStyle(view === 'day')}>Day</button>
            <button onClick={() => setView('agenda')} style={viewBtnStyle(view === 'agenda')}>Agenda</button>
            <button onClick={() => setView('week')} style={viewBtnStyle(view === 'week')}>Week</button>
          </div>
        </div>
      </div>

      {/* Pacing visualization */}
      <PacingBar reservations={MOCK_RESERVATIONS} kitchenCapacity={8} />

      {/* Calendar view */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {view === 'day' && <DayView date={selectedDate} reservations={MOCK_RESERVATIONS} />}
        {view === 'agenda' && <AgendaView date={selectedDate} reservations={MOCK_RESERVATIONS} />}
        {view === 'week' && <WeekView startDate={selectedDate} reservations={MOCK_RESERVATIONS} />}
      </div>
    </div>
  );
}
