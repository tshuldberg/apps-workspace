'use client';

import { useParams } from 'next/navigation';

// Mock upcoming reservations with dietary alerts
const MOCK_ALERTS = [
  { time: '6:00 PM', guest: 'Table 4', partySize: 4, allergens: ['Gluten', 'Dairy'], notes: 'Birthday dinner' },
  { time: '6:30 PM', guest: 'Table 7', partySize: 2, allergens: ['Shellfish'], notes: '' },
  { time: '7:00 PM', guest: 'Table 12', partySize: 6, allergens: ['Nuts', 'Eggs'], notes: 'Anniversary' },
];

export default function KitchenDisplayPage() {
  const params = useParams();
  void params;

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E13', color: '#E4E1E9', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Kitchen Alerts</h1>
        <span style={{ fontSize: '0.875rem', color: '#9F8E81' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MOCK_ALERTS.map((alert, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px 20px',
              background: '#1B1B20',
              borderRadius: '12px',
              border: '2px solid #DC262640',
            }}
          >
            <div style={{ width: '60px', fontSize: '0.875rem', fontWeight: 600, color: '#D6C3B5' }}>
              {alert.time}
            </div>
            <div style={{ width: '80px', fontSize: '0.875rem', color: '#E4E1E9' }}>
              {alert.guest} ({alert.partySize}p)
            </div>
            <div style={{ flex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {alert.allergens.map((a) => (
                <span
                  key={a}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    background: '#DC262625',
                    color: '#FFB4AB',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    border: '1px solid #DC262650',
                  }}
                >
                  {'\u26A0'} {a}
                </span>
              ))}
            </div>
            {alert.notes && (
              <div style={{ fontSize: '0.75rem', color: '#9F8E81' }}>{alert.notes}</div>
            )}
          </div>
        ))}
      </div>

      {MOCK_ALERTS.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9F8E81' }}>
          No dietary alerts for upcoming reservations
        </div>
      )}
    </div>
  );
}
