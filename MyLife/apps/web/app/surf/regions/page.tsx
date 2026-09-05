'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { fetchSurfZones, fetchSurfHomeCardsByZone, fetchSurfRegionsByZone } from '../actions';
import type { SurfZoneCard, SurfSpotHomeCard } from '../actions';

const ACCENT = 'var(--accent-surf, #3B82F6)';
const ACCENT_DIM = 'color-mix(in srgb, var(--accent-surf, #3B82F6) 15%, transparent)';
const SURFACE_EL = 'var(--surface-elevated, rgba(255,255,255,0.06))';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.04))';
const GLASS_BORDER = 'var(--glass-border, rgba(255,255,255,0.06))';
const TEXT = 'var(--text, #F0F0F5)';
const TEXT_SEC = 'var(--text-secondary, rgba(240,240,245,0.65))';
const TEXT_TER = 'var(--text-tertiary, rgba(240,240,245,0.4))';

const CONDITION_COLORS: Record<string, string> = {
  green: 'var(--success)',
  yellow: 'var(--warning)',
  orange: 'color-mix(in srgb, var(--warning) 70%, var(--danger) 30%)',
  red: 'var(--danger)',
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  PT: '🇵🇹',
};

export default function RegionsPage() {
  const [zones, setZones] = useState<SurfZoneCard[]>([]);
  const [selectedZone, setSelectedZone] = useState<SurfZoneCard | null>(null);
  const [zoneSpots, setZoneSpots] = useState<SurfSpotHomeCard[]>([]);
  const [zoneRegions, setZoneRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotLoading, setSpotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const z = await fetchSurfZones();
        setZones(z);
        setError(null);
      } catch {
        setError('Failed to load surf zones');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectZone = useCallback(async (zone: SurfZoneCard) => {
    setSelectedZone(zone);
    setSpotLoading(true);
    try {
      const [cards, regions] = await Promise.all([
        fetchSurfHomeCardsByZone(zone.id),
        fetchSurfRegionsByZone(zone.id),
      ]);
      setZoneSpots(cards);
      setZoneRegions(regions);
    } catch {
      setZoneSpots([]);
      setZoneRegions([]);
    } finally {
      setSpotLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
        <div style={s.skeleton} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ ...s.skeleton, height: 100 }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
        <p style={{ color: TEXT_SEC }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
      <h1 style={{ color: TEXT, fontSize: 28, fontWeight: 700, margin: 0 }}>Surf Zones</h1>
      <p style={{ color: TEXT_SEC, fontSize: 15, marginTop: 4 }}>
        {zones.length} regions across {new Set(zones.map((z) => z.country)).size} countries
      </p>

      {/* Zone grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
        {zones.map((zone) => {
          const active = selectedZone?.id === zone.id;
          return (
            <button
              key={zone.id}
              onClick={() => void selectZone(zone)}
              style={{
                ...s.zoneCard,
                border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                background: active ? ACCENT_DIM : GLASS,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{COUNTRY_FLAGS[zone.country] ?? '🌊'}</span>
                  <span style={{ color: TEXT, fontSize: 18, fontWeight: 600 }}>{zone.name}</span>
                </div>
                <span style={s.spotBadge}>{zone.spotCount} spots</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ color: TEXT_SEC, fontSize: 13 }}>{zone.country}</span>
                <span style={{ color: TEXT_TER, fontSize: 12 }}>{zone.timezone.split('/').pop()?.replace('_', ' ')}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected zone detail */}
      {selectedZone && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>
              {COUNTRY_FLAGS[selectedZone.country] ?? '🌊'} {selectedZone.name}
            </h2>
            <button style={s.closeBtn} onClick={() => { setSelectedZone(null); setZoneSpots([]); }}>
              Close
            </button>
          </div>

          {/* Sub-region chips */}
          {zoneRegions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {zoneRegions.map((r) => (
                <span key={r} style={s.regionChip}>{r}</span>
              ))}
            </div>
          )}

          {spotLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ ...s.skeleton, height: 80 }} />)}
            </div>
          ) : zoneSpots.length === 0 ? (
            <p style={{ color: TEXT_SEC, fontSize: 14 }}>No spots seeded in this zone yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {zoneSpots.map((card) => {
                const today = card.days[0];
                const cc = today ? CONDITION_COLORS[today.conditionColor] ?? TEXT_SEC : TEXT_SEC;
                return (
                  <div key={card.spot.id} style={s.spotCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: TEXT }}>{card.spot.name}</div>
                        <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>
                          {card.spot.region} &middot; {card.spot.breakType}
                        </div>
                      </div>
                      {today && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: cc }}>{today.rating.toFixed(1)}</div>
                          <div style={{ fontSize: 11, color: TEXT_TER }}>
                            {today.waveHeightMin.toFixed(1)}-{today.waveHeightMax.toFixed(1)} ft
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 7-day mini bar */}
                    {card.days.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
                        {card.days.slice(0, 7).map((d, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: CONDITION_COLORS[d.conditionColor] ?? BORDER,
                              opacity: 0.7,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  zoneCard: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    borderRadius: 14,
    padding: 20,
    cursor: 'pointer',
  },
  spotBadge: {
    background: 'color-mix(in srgb, var(--accent-surf, #3B82F6) 15%, transparent)',
    color: 'var(--accent-surf, #3B82F6)',
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
  },
  spotCard: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 12,
    padding: '14px 16px',
  },
  regionChip: {
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: SURFACE_EL,
    color: TEXT_SEC,
    fontSize: 12,
    fontWeight: 500,
  },
  closeBtn: {
    background: SURFACE_EL,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    color: TEXT_SEC,
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
  skeleton: {
    background: `linear-gradient(90deg, ${SURFACE_EL} 0%, ${GLASS} 50%, ${SURFACE_EL} 100%)`,
    backgroundSize: '200% 100%',
    borderRadius: 12,
    height: 60,
  },
};
