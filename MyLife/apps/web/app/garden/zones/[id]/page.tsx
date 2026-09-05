'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { GardenZone, Plant, LightReading, ZoneStats } from '@mylife/garden';
import {
  fetchZones, fetchPlants, fetchZoneStats,
  fetchLightReadingsForZone, fetchZoneAverageLux,
  doCreateLightReading, doDeleteZone,
} from '../../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const DANGER = '#FF453A';

export default function ZoneDetailPage() {
  const params = useParams();
  const zoneId = params.id as string;

  const [zone, setZone] = useState<GardenZone | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [stats, setStats] = useState<ZoneStats | null>(null);
  const [readings, setReadings] = useState<LightReading[]>([]);
  const [avgLux, setAvgLux] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Light reading form
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [readingLux, setReadingLux] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchZones(),
      fetchPlants(),
      fetchZoneStats(zoneId),
      fetchLightReadingsForZone(zoneId),
      fetchZoneAverageLux(zoneId),
    ])
      .then(([zones, allPlants, zoneStats, lightReadings, lux]) => {
        if (cancelled) return;
        const matched = (zones as GardenZone[]).find((z) => z.id === zoneId) ?? null;
        setZone(matched);
        // Plants reference zone by name, not ID
        const zoneName = matched?.name ?? '';
        setPlants((allPlants as Plant[]).filter((p) => p.zone === zoneName));
        setStats(zoneStats as ZoneStats);
        setReadings(lightReadings as LightReading[]);
        setAvgLux(lux as number | null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load zone');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [zoneId, tick]);

  const handleAddReading = useCallback(async () => {
    const lux = parseInt(readingLux, 10);
    if (isNaN(lux) || lux < 0) return;
    setSubmitting(true);
    try {
      await doCreateLightReading({ zoneId, readingLux: lux });
      setReadingLux('');
      setShowReadingForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [zoneId, readingLux, refresh]);

  const handleDeleteZone = useCallback(async () => {
    if (!confirm('Delete this zone? Plants will keep their zone name but the zone entry will be removed.')) return;
    try {
      await doDeleteZone(zoneId);
      window.location.href = '/garden/zones';
    } catch {
      /* silent */
    }
  }, [zoneId]);

  const statusColor = useCallback((status: string) => {
    if (status === 'healthy') return ACCENT;
    if (status === 'needs_attention') return '#F59E0B';
    if (status === 'dormant') return '#14B8A6';
    return DANGER;
  }, []);

  const lightLabel = useMemo(() => {
    if (avgLux == null || avgLux === 0) return null;
    if (avgLux < 500) return 'Low light';
    if (avgLux < 5000) return 'Medium light';
    if (avgLux < 25000) return 'Bright indirect';
    return 'Direct sun';
  }, [avgLux]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...skel, width: 160, height: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...skel, height: 200 }} />
            <div style={{ ...skel, height: 300 }} />
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...skel, height: 160 }} />
            <div style={{ ...skel, height: 260 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 18, color: TEXT, margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 14, color: TEXT_SEC, margin: '8px 0 0' }}>{error}</p>
        <button type="button" onClick={refresh} style={{ ...ghostBtn, marginTop: 16 }}>Retry</button>
      </div>
    );
  }

  if (!zone) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 40 }}>
        <p style={{ color: TEXT }}>Zone not found</p>
        <Link href="/garden/zones" style={{ color: ACCENT, textDecoration: 'none' }}>Back to Zones</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/garden/zones" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
        &larr; Back to Zones
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Left column: zone info + plant list */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Zone profile */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{zone.name}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT_SEC }}>{zone.location}</p>
              </div>
              <button
                type="button"
                onClick={handleDeleteZone}
                style={{ ...ghostBtn, fontSize: 12, padding: '6px 12px', color: DANGER, borderColor: 'rgba(255,69,58,0.2)' }}
              >
                Delete
              </button>
            </div>
            {zone.description && (
              <p style={{ margin: '12px 0 0', color: TEXT_TER, fontSize: 13 }}>{zone.description}</p>
            )}
          </div>

          {/* Plants in zone */}
          <div style={card}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Plants ({plants.length})
            </h3>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {plants.length === 0 && (
                <p style={{ margin: 0, color: TEXT_SEC, fontSize: 14 }}>
                  No plants assigned to this zone yet.
                </p>
              )}
              {plants.map((p) => (
                <Link key={p.id} href={`/garden/${p.id}`} style={{ textDecoration: 'none', color: TEXT }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE,
                  }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>
                      {p.species && (
                        <span style={{ marginLeft: 8, fontSize: 13, color: TEXT_TER }}>{p.species}</span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      backgroundColor: `${statusColor(p.status)}20`, color: statusColor(p.status),
                    }}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: stats + light readings */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Zone stats */}
          <div style={card}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Stats</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <StatCell label="Plants" value={stats?.plantCount ?? 0} />
              <StatCell label="Healthy" value={stats?.healthyCount ?? 0} accent={ACCENT} />
              <StatCell label="Needs Attention" value={stats?.needsAttentionCount ?? 0} accent={stats?.needsAttentionCount ? '#F59E0B' : undefined} />
              <StatCell label="Overdue" value={stats?.overdueCount ?? 0} accent={stats?.overdueCount ? DANGER : undefined} />
            </div>
            {avgLux != null && avgLux > 0 && (
              <div style={{ marginTop: 12, fontSize: 14, color: TEXT_SEC }}>
                Avg Light: <span style={{ fontWeight: 600, color: TEXT }}>{Math.round(avgLux)} lux</span>
                {lightLabel && <span style={{ marginLeft: 8, color: TEXT_TER }}>({lightLabel})</span>}
              </div>
            )}
          </div>

          {/* Light readings */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Light Readings</h3>
              <button
                type="button"
                onClick={() => setShowReadingForm(!showReadingForm)}
                style={{ ...smallBtn, backgroundColor: ACCENT, color: '#0A0A0F' }}
              >
                + Log Reading
              </button>
            </div>

            {showReadingForm && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 12, color: TEXT_SEC }}>Lux</label>
                  <input
                    type="number"
                    value={readingLux}
                    onChange={(e) => setReadingLux(e.target.value)}
                    placeholder="e.g. 5000"
                    style={inputStyle}
                    min={0}
                    max={100000}
                    autoFocus
                  />
                </div>
                <button type="button" onClick={handleAddReading} disabled={submitting} style={primaryBtn}>
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowReadingForm(false)} style={ghostBtn}>Cancel</button>
              </div>
            )}

            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              {readings.length === 0 && (
                <p style={{ margin: 0, color: TEXT_SEC, fontSize: 14 }}>No light readings yet.</p>
              )}
              {readings.map((r) => (
                <div key={r.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 12, color: TEXT_TER, minWidth: 80 }}>{r.readingDate}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{r.readingLux} lux</span>
                  <span style={{ fontSize: 12, color: TEXT_TER }}>{r.lightLevel.replace('_', ' ')}</span>
                  {r.notes && <span style={{ fontSize: 13, color: TEXT_SEC }}>{r.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: accent || TEXT }}>{value}</p>
    </div>
  );
}

const card: CSSProperties = { padding: 20, borderRadius: 20, backgroundColor: GLASS, border: `1px solid ${BORDER}` };
const primaryBtn: CSSProperties = { borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14 };
const smallBtn: CSSProperties = { borderRadius: 8, backgroundColor: SURFACE, color: TEXT_SEC, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 12 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };
