'use client';

import Link from 'next/link';

export default function BPTrendsPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/meds" style={{ color: 'var(--accent-meds)', textDecoration: 'none' }}>MyMeds</Link>
        <span style={{ color: 'rgba(240,240,245,0.35)' }}>/</span>
        <Link href="/meds/bp" style={{ color: 'var(--accent-meds)', textDecoration: 'none' }}>Blood Pressure</Link>
        <span style={{ color: 'rgba(240,240,245,0.35)' }}>/</span>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Trends</h1>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 32, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{'📈'}</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>BP Trend Visualization</h2>
        <p style={{ color: 'rgba(240,240,245,0.65)', margin: 0 }}>
          Time-series line charts with AHA zone bands, medication start/stop markers,
          period statistics, and comparison analysis.
        </p>
      </div>
    </div>
  );
}
