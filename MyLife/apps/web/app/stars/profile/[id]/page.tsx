'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchProfile, fetchSolarReturn, fetchProgressedChartAction } from '../../actions';
import type { BirthProfile, SolarReturnResult, ProgressedChartResult } from '@mylife/stars';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const glassCard: CSSProperties = {
  padding: 20, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', backgroundColor: 'var(--glass)',
};

export default function ProfileDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [profile, setProfile] = useState<BirthProfile | null>(null);
  const [solarReturn, setSolarReturn] = useState<SolarReturnResult | null>(null);
  const [progressed, setProgressed] = useState<ProgressedChartResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const p = await fetchProfile(id);
        if (!cancelled) setProfile(p);
        if (p) {
          const year = new Date().getFullYear();
          const [sr, pc] = await Promise.all([
            fetchSolarReturn(id, year),
            fetchProgressedChartAction(id),
          ]);
          if (!cancelled) {
            setSolarReturn(sr);
            setProgressed(pc);
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>Something went wrong</h2>
        <button type="button" onClick={() => location.reload()}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--accent-stars)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ height: 24, width: 180, borderRadius: 8, backgroundColor: 'var(--glass)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ height: 200, borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--glass)' }} />
          <div style={{ height: 200, borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--glass)' }} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>Profile not found</h2>
        <Link href="/stars/profile" style={{ marginTop: 16, display: 'inline-block', color: 'var(--accent-stars)', fontWeight: 600, textDecoration: 'none' }}>
          &larr; Back to Profiles
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/stars/profile" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}>
        &larr; Back to Profiles
      </Link>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{profile.name}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Birth Data */}
        <div style={{ ...glassCard, backgroundColor: 'var(--surface)', display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Birth Data</h3>
          <InfoRow label="Date" value={profile.birthDate} />
          <InfoRow label="Time" value={profile.birthTime ?? 'Unknown'} />
          <InfoRow label="Place" value={profile.birthPlace ?? 'Not specified'} />
        </div>

        {/* Placements */}
        <div style={{ ...glassCard, backgroundColor: 'var(--surface)', display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Placements</h3>
          <InfoRow label="Sun" value={profile.sunSign ? capitalize(profile.sunSign) : '--'} accent />
          <InfoRow label="Moon" value={profile.moonSign ? capitalize(profile.moonSign) : '--'} accent />
          <InfoRow label="Rising" value={profile.risingSign ? capitalize(profile.risingSign) : '--'} accent />
        </div>

        {/* Solar Return */}
        <div style={{ ...glassCard, backgroundColor: 'var(--surface)', display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Solar Return ({new Date().getFullYear()})
          </h3>
          {solarReturn ? (
            <>
              <InfoRow label="Return Date" value={solarReturn.returnDate} />
              <InfoRow label="Sun" value={capitalize(solarReturn.sunSign)} accent />
              <InfoRow label="Moon" value={capitalize(solarReturn.moonSign)} accent />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{solarReturn.yearTheme}</p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Not available</p>
          )}
        </div>

        {/* Progressions */}
        <div style={{ ...glassCard, backgroundColor: 'var(--surface)', display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Progressions</h3>
          {progressed ? (
            <>
              <InfoRow label="Current Age" value={`${progressed.currentAgeYears.toFixed(1)} years`} />
              <InfoRow label="Progressed Moon" value={capitalize(progressed.moonSign)} accent />
              <InfoRow label="Moon Degree" value={`~${progressed.moonDegreeApprox}\u00B0`} />
              <InfoRow label="Next Sign Change" value={`~${progressed.moonNextSignChangeYears.toFixed(1)} years`} />
              <InfoRow label="Next Sign" value={capitalize(progressed.moonNextSign)} />
              <InfoRow label="Progressed Sun" value={capitalize(progressed.sunSign)} accent />
              {progressed.moonInterpretation && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{progressed.moonInterpretation}</p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Not available</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: accent ? 'var(--accent-stars)' : 'var(--text)' }}>{value}</span>
    </div>
  );
}
