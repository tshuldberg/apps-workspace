'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { GardenZone, ZoneStats } from '@mylife/garden';
import {
  fetchZones, fetchZoneStats, fetchZoneAverageLux,
  doCreateZone, doDeleteZone,
} from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const DANGER = '#FF453A';

type LocationOption = 'indoor' | 'outdoor' | 'greenhouse' | 'balcony';

interface ZoneRow {
  zone: GardenZone;
  stats: ZoneStats | null;
  avgLux: number | null;
}

export default function ZonesPage() {
  const [rows, setRows] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // New zone form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState<LocationOption>('indoor');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchZones()
      .then(async (zones: GardenZone[]) => {
        if (cancelled) return;
        const enriched: ZoneRow[] = await Promise.all(
          zones.map(async (zone) => {
            let stats: ZoneStats | null = null;
            let avgLux: number | null = null;
            try { stats = await fetchZoneStats(zone.id); } catch { /* skip */ }
            try { avgLux = await fetchZoneAverageLux(zone.id); } catch { /* skip */ }
            return { zone, stats, avgLux };
          }),
        );
        if (!cancelled) setRows(enriched);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load zones');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await doCreateZone({ name: formName.trim(), location: formLocation });
      setFormName('');
      setFormLocation('indoor');
      setShowForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [formName, formLocation, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this zone? Plants will keep their zone name but this zone entry will be removed.')) return;
    try {
      await doDeleteZone(id);
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (rows.length === 0 && !showForm) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🗺️</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>No zones yet</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Organize your plants into zones like rooms, balconies, or outdoor areas to track conditions and care by location.
        </p>
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtn}>+ New Zone</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Zones</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ New Zone</button>
      </div>

      {showForm && (
        <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Living Room"
              style={inputStyle}
              autoFocus
            />
          </div>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Location</label>
            <select
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value as LocationOption)}
              style={inputStyle}
            >
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="balcony">Balcony</option>
            </select>
          </div>
          <button type="button" onClick={handleCreate} disabled={submitting} style={primaryBtn}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {rows.map(({ zone, stats, avgLux }) => {
          const overdueCount = stats?.overdueCount ?? 0;
          return (
            <Link key={zone.id} href={`/garden/zones/${zone.id}`} style={{ textDecoration: 'none', color: TEXT }}>
              <div style={{ ...card, display: 'grid', gap: 10, height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{zone.name}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>
                      {zone.location}
                    </p>
                  </div>
                  {overdueCount > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      backgroundColor: 'rgba(255,69,58,0.15)', color: DANGER,
                    }}>
                      {overdueCount} overdue
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: TEXT_TER }}>
                  <span>{stats?.plantCount ?? 0} plant{(stats?.plantCount ?? 0) !== 1 ? 's' : ''}</span>
                  {avgLux != null && avgLux > 0 && <span>{Math.round(avgLux)} lux avg</span>}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(zone.id); }}
                    style={{ ...ghostBtn, fontSize: 12, padding: '6px 12px', color: DANGER, borderColor: 'rgba(255,69,58,0.2)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...skel, width: 120, height: 32 }} />
        <div style={{ ...skel, width: 120, height: 38 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} style={{ ...skel, height: 140 }} />)}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 40 }}>
      <p style={{ fontSize: 18, color: TEXT, margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: 14, color: TEXT_SEC, margin: '8px 0 0' }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ ...ghostBtn, marginTop: 16 }}>Retry</button>
    </div>
  );
}

const card: CSSProperties = { padding: 20, borderRadius: 20, backgroundColor: GLASS, border: `1px solid ${BORDER}` };
const primaryBtn: CSSProperties = { borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };
