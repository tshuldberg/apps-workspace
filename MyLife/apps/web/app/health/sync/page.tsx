'use client';

import Link from 'next/link';

export default function HealthSyncPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Link href="/health" style={{ color: '#10B981', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block', marginBottom: '0.75rem' }}>
        Back to Health
      </Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Health Sync</h1>
      <p style={{ color: 'rgba(240,240,245,0.65)', marginBottom: '2rem' }}>
        Configure wearable data import
      </p>

      <div style={{
        background: '#12121A',
        borderRadius: 8,
        padding: '2rem',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{'\uD83D\uDCF1'}</div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#F0F0F5', margin: '0 0 0.5rem' }}>
          Mobile Only
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'rgba(240,240,245,0.65)', margin: '0 0 1rem', lineHeight: '1.6' }}>
          Health data sync is available on mobile (iOS and Android) only.
          Open MyLife on your phone to connect to Apple Health or Health Connect.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'rgba(240,240,245,0.35)', margin: 0 }}>
          Synced data from your phone will appear here automatically in Vitals and Sleep.
        </p>
      </div>
    </div>
  );
}
