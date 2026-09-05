'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback } from 'react';
import type { FrostConfig } from '@mylife/garden';
import {
  fetchFrostConfig, doSetFrostConfig, engineLookupZone,
  engineCalculateCountdown, engineGetCurrentFrostPhase, engineGetPlantingCalendar,
} from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';


const FROST_BLUE = '#38BDF8';
const WARM_ORANGE = '#FB923C';

interface ZoneLookup {
  avgLastFrost: string;
  avgFirstFrost: string;
  growingSeasonDays: number;
}

interface FrostPhase {
  phase: string;
  daysUntilEvent: number;
  eventDate: string;
  eventName: string;
}

interface CalendarEntry {
  crop: string;
  indoorStartWeeksBefore: number | null;
  transplantWeeksAfter: number | null;
  directSow: boolean;
  harvestWeeksBefore: number | null;
}

const USDA_ZONES = [
  '3a', '3b', '4a', '4b', '5a', '5b', '6a', '6b',
  '7a', '7b', '8a', '8b', '9a', '9b', '10a', '10b',
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMmDd(mmDd: string): string {
  try {
    const [mm, dd] = mmDd.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[mm - 1]} ${dd}`;
  } catch {
    return mmDd;
  }
}

function weeksToDate(baseMmDd: string, weekOffset: number, year: number): string {
  try {
    const [mm, dd] = baseMmDd.split('-').map(Number);
    const d = new Date(year, mm - 1, dd);
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
}

export default function FrostPage() {
  const [config, setConfig] = useState<FrostConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Zone config form
  const [formZone, setFormZone] = useState('');
  const [formZip, setFormZip] = useState('');
  const [saving, setSaving] = useState(false);

  // Lookup result
  const [zoneLookup, setZoneLookup] = useState<ZoneLookup | null>(null);

  // Countdowns
  const [lastFrostCountdown, setLastFrostCountdown] = useState<number | null>(null);
  const [firstFrostCountdown, setFirstFrostCountdown] = useState<number | null>(null);
  const [frostPhase, setFrostPhase] = useState<FrostPhase | null>(null);

  // Calendar
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Load config
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchFrostConfig(),
      engineGetPlantingCalendar(),
    ])
      .then(([cfg, cal]) => {
        if (cancelled) return;
        const frostCfg = cfg as FrostConfig | null;
        setConfig(frostCfg);
        setCalendar(cal as CalendarEntry[]);
        if (frostCfg) {
          setFormZone(frostCfg.usdaZone ?? '');
          setFormZip(frostCfg.zipCode ?? '');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load frost config');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  // Compute countdowns when config changes
  const lastFrost = config?.customLastFrost ?? config?.avgLastFrost ?? null;
  const firstFrost = config?.customFirstFrost ?? config?.avgFirstFrost ?? null;

  useEffect(() => {
    if (!lastFrost || !firstFrost) {
      setLastFrostCountdown(null);
      setFirstFrostCountdown(null);
      setFrostPhase(null);
      return;
    }

    let cancelled = false;
    const today = todayStr();

    Promise.all([
      engineCalculateCountdown(lastFrost, today),
      engineCalculateCountdown(firstFrost, today),
      engineGetCurrentFrostPhase(lastFrost, firstFrost),
    ])
      .then(([lfc, ffc, phase]) => {
        if (cancelled) return;
        setLastFrostCountdown(lfc as number);
        setFirstFrostCountdown(ffc as number);
        setFrostPhase(phase as FrostPhase);
      })
      .catch(() => {
        if (!cancelled) {
          setLastFrostCountdown(null);
          setFirstFrostCountdown(null);
          setFrostPhase(null);
        }
      });

    return () => { cancelled = true; };
  }, [lastFrost, firstFrost]);

  // Zone lookup on zone change
  const handleZoneLookup = useCallback(async (zone: string) => {
    if (!zone) {
      setZoneLookup(null);
      return;
    }
    try {
      const result = await engineLookupZone(zone);
      setZoneLookup(result as ZoneLookup | null);
    } catch {
      setZoneLookup(null);
    }
  }, []);

  const handleZoneChange = useCallback((zone: string) => {
    setFormZone(zone);
    handleZoneLookup(zone);
  }, [handleZoneLookup]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await doSetFrostConfig({
        usdaZone: formZone || null,
        zipCode: formZip.trim() || null,
        avgLastFrost: zoneLookup?.avgLastFrost ?? config?.avgLastFrost ?? null,
        avgFirstFrost: zoneLookup?.avgFirstFrost ?? config?.avgFirstFrost ?? null,
      });
      refresh();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  }, [formZone, formZip, zoneLookup, config, refresh]);

  const currentYear = new Date().getFullYear();

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (!config && !formZone) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>❄️</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Set up your frost dates</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Select your USDA hardiness zone to get average frost dates, countdowns, and a personalized planting calendar for your region.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>USDA Zone</label>
            <select value={formZone} onChange={(e) => handleZoneChange(e.target.value)} style={inputStyle}>
              <option value="">Select zone...</option>
              {USDA_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>ZIP Code</label>
            <input value={formZip} onChange={(e) => setFormZip(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <button type="button" onClick={handleSave} disabled={saving || !formZone} style={primaryBtn}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Frost Dates & Planting Calendar</h2>

      {/* Zone Config */}
      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontSize: 12, color: TEXT_SEC }}>USDA Zone</label>
          <select value={formZone} onChange={(e) => handleZoneChange(e.target.value)} style={inputStyle}>
            <option value="">Select zone...</option>
            {USDA_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontSize: 12, color: TEXT_SEC }}>ZIP Code</label>
          <input value={formZip} onChange={(e) => setFormZip(e.target.value)} placeholder="Optional" style={inputStyle} />
        </div>
        <button type="button" onClick={handleSave} disabled={saving} style={primaryBtn}>
          {saving ? 'Saving...' : 'Save'}
        </button>

        {zoneLookup && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
            <span>Last frost: <strong style={{ color: FROST_BLUE }}>{formatMmDd(zoneLookup.avgLastFrost)}</strong></span>
            <span>First frost: <strong style={{ color: WARM_ORANGE }}>{formatMmDd(zoneLookup.avgFirstFrost)}</strong></span>
            <span>Growing season: <strong style={{ color: ACCENT }}>{zoneLookup.growingSeasonDays} days</strong></span>
          </div>
        )}
      </div>

      {/* Countdown Cards */}
      {(lastFrost || firstFrost) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <CountdownCard
            label="Last Frost"
            days={lastFrostCountdown}
            dateMmDd={lastFrost}
            color={FROST_BLUE}
          />
          <CountdownCard
            label="First Frost"
            days={firstFrostCountdown}
            dateMmDd={firstFrost}
            color={WARM_ORANGE}
          />
          <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
            <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>Current Phase</p>
            {frostPhase ? (
              <>
                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: ACCENT }}>
                  {frostPhase.phase}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_TER }}>
                  {Math.abs(frostPhase.daysUntilEvent)} day{Math.abs(frostPhase.daysUntilEvent) !== 1 ? 's' : ''}{' '}
                  {frostPhase.daysUntilEvent >= 0 ? 'until' : 'since'} {frostPhase.eventName}
                </p>
              </>
            ) : (
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: TEXT_TER }}>--</p>
            )}
          </div>
        </div>
      )}

      {/* Planting Calendar */}
      {calendar.length > 0 && lastFrost && (
        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>Planting Calendar</h3>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_TER }}>
            Dates are relative to your last frost date ({formatMmDd(lastFrost)})
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Crop', 'Start Indoors', 'Transplant', 'Direct Sow'].map((label) => (
                    <th key={label} style={{
                      textAlign: 'left', padding: '10px 14px', color: TEXT_SEC, fontWeight: 600,
                      fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8,
                      borderBottom: `1px solid ${BORDER}`,
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendar.map((entry) => (
                  <tr key={entry.crop} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', color: TEXT, fontWeight: 500 }}>{entry.crop}</td>
                    <td style={{ padding: '10px 14px', color: TEXT_SEC }}>
                      {entry.indoorStartWeeksBefore != null
                        ? weeksToDate(lastFrost, -entry.indoorStartWeeksBefore, currentYear)
                        : '-'}
                    </td>
                    <td style={{ padding: '10px 14px', color: TEXT_SEC }}>
                      {entry.transplantWeeksAfter != null
                        ? weeksToDate(lastFrost, entry.transplantWeeksAfter, currentYear)
                        : '-'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {entry.directSow ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                          backgroundColor: `${ACCENT}18`, color: ACCENT,
                        }}>
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: TEXT_TER }}>No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CountdownCard({ label, days, dateMmDd, color }: { label: string; days: number | null; dateMmDd: string | null; color: string }) {
  const isPast = days != null && days < 0;
  const absValue = days != null ? Math.abs(days) : null;

  return (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>{label}</p>
      {absValue != null ? (
        <>
          <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color }}>
            {absValue} <span style={{ fontSize: 14, fontWeight: 400 }}>day{absValue !== 1 ? 's' : ''}</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_TER }}>
            {isPast ? 'ago' : 'away'}{dateMmDd ? ` (${formatMmDd(dateMmDd)})` : ''}
          </p>
        </>
      ) : (
        <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: TEXT_TER }}>--</p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skel, width: 300, height: 32 }} />
      <div style={{ ...skel, height: 70 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 100 }} />)}
      </div>
      <div style={{ ...skel, width: 200, height: 24 }} />
      {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ ...skel, height: 48 }} />)}
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
