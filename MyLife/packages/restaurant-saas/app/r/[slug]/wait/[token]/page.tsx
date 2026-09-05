'use client';

import { useParams } from 'next/navigation';

type WaitStatus = 'waiting' | 'ready' | 'seated' | 'walked_away';

type WaitData = {
  dinerName: string;
  position: number;
  estimatedWaitMin: number;
  estimatedWaitMax: number;
  partySize: number;
  status: WaitStatus;
  restaurantName: string;
  joinedAt: string;
};

// In production, this would fetch real data via the token
const MOCK_DATA: WaitData = {
  dinerName: 'Sarah',
  position: 4,
  estimatedWaitMin: 25,
  estimatedWaitMax: 35,
  partySize: 4,
  status: 'waiting',
  restaurantName: 'The Local Kitchen',
  joinedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
};

const STATUS_CONFIG: Record<WaitStatus, { label: string; color: string; icon: string }> = {
  waiting: { label: 'Waiting', color: '#FFB877', icon: '⏳' },
  ready: { label: 'Your Table is Ready!', color: '#8BCFF0', icon: '🎉' },
  seated: { label: 'Seated', color: '#30D158', icon: '✓' },
  walked_away: { label: 'Removed from Waitlist', color: '#9F8E81', icon: '—' },
};

export default function WaitStatusPage() {
  const params = useParams();
  void params.slug;
  void params.token;

  const data = MOCK_DATA;
  const config = STATUS_CONFIG[data.status];
  const elapsedMin = Math.round((Date.now() - new Date(data.joinedAt).getTime()) / 60000);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1.5rem',
    }}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        {/* Restaurant name */}
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {data.restaurantName}
        </p>

        {/* Status icon */}
        <div style={{
          fontSize: '2.5rem',
          marginBottom: '1rem',
        }}>
          {config.icon}
        </div>

        {/* Position display */}
        {data.status === 'waiting' && (
          <>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              color: config.color,
              lineHeight: 1,
            }}>
              #{data.position}
            </div>
            <p style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              marginTop: '8px',
            }}>
              in line
            </p>
          </>
        )}

        {/* Ready state */}
        {data.status === 'ready' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: config.color }}>
              Your Table is Ready!
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Please check in with the host
            </p>
          </div>
        )}

        {/* Seated state */}
        {data.status === 'seated' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: config.color }}>
              Enjoy Your Meal!
            </h1>
          </div>
        )}

        {/* Walked away state */}
        {data.status === 'walked_away' && (
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              You&apos;ve been removed from the waitlist
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              Feel free to rejoin anytime
            </p>
          </div>
        )}

        {/* Wait estimate */}
        {data.status === 'waiting' && (
          <div style={{
            marginTop: '2rem',
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--surface-low)',
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Estimated Wait
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {data.estimatedWaitMin}–{data.estimatedWaitMax} min
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              based on today&apos;s pace
            </p>
          </div>
        )}

        {/* Details card */}
        <div style={{
          marginTop: '1.5rem',
          padding: '16px',
          borderRadius: '12px',
          background: 'var(--surface-low)',
          border: '1px solid var(--border)',
          textAlign: 'left',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Name</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{data.dinerName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Party Size</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{data.partySize} guests</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Waited</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{elapsedMin} min</span>
          </div>
        </div>

        {/* Footer note */}
        <p style={{
          marginTop: '2rem',
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
          lineHeight: 1.5,
        }}>
          This page updates automatically. You&apos;ll also receive an SMS when your table is ready
          (if you opted in).
        </p>
      </div>
    </div>
  );
}
