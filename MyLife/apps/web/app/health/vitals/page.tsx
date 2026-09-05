'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchLatestVitals, fetchVitals, doLogVital } from '../actions';
import type { VitalType } from '@mylife/health';

type LatestMap = Awaited<ReturnType<typeof fetchLatestVitals>>;

/* Tokens */
const T = {
  bg: '#131318',
  depth: '#0E0E13',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textDim: 'rgba(228,225,233,0.5)',
  textFaint: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  accent: '#EF4444',
  accentDim: 'rgba(239,68,68,0.2)',
  emerald: '#34D399',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

const VITAL_TYPES: { key: VitalType; label: string; unit: string; icon: string }[] = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', icon: '♥' },
  { key: 'resting_heart_rate', label: 'Resting HR', unit: 'bpm', icon: '♡' },
  { key: 'hrv', label: 'HRV', unit: 'ms', icon: '≈' },
  { key: 'blood_oxygen', label: 'Blood Oxygen', unit: '%', icon: '◌' },
  { key: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', icon: '◉' },
  { key: 'body_temperature', label: 'Temperature', unit: '°F', icon: '◐' },
  { key: 'steps', label: 'Steps', unit: 'steps', icon: '⇢' },
  { key: 'active_energy', label: 'Active Energy', unit: 'kcal', icon: '⚡' },
];

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 1200, margin: '0 auto' },
  backLink: {
    color: T.textDim,
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    display: 'inline-block',
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    marginTop: 8,
    marginBottom: 40,
  },

  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
  },
  rangeFilter: { display: 'flex', gap: 8 },
  rangePill: {
    padding: '6px 14px',
    borderRadius: 9999,
    border: `1px solid ${T.border}`,
    background: 'transparent',
    color: T.textSecondary,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rangePillActive: {
    background: T.accent,
    borderColor: T.accent,
    color: '#fff',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
    marginBottom: 40,
  },
  vitalCard: {
    background: T.low,
    borderRadius: 16,
    padding: 20,
    border: `1px solid ${T.border}`,
    cursor: 'pointer',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  vitalCardActive: {
    background: T.mid,
    borderColor: T.accent,
  },
  vitalHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
  },
  vitalIcon: { fontSize: 18, color: T.accent },
  vitalValue: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
  },
  vitalUnit: {
    fontSize: 12,
    color: T.textDim,
    marginLeft: 6,
    fontWeight: 400,
  },
  sparkline: {
    marginTop: 16,
    height: 28,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
  },
  sparkBar: {
    flex: 1,
    background: T.accentDim,
    borderRadius: 9999,
  },

  /* Detail section */
  detailPanel: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
    marginBottom: 40,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: T.text,
  },
  detailMeta: { fontSize: 12, color: T.textDim, marginTop: 4 },

  chartArea: {
    height: 180,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    padding: '16px 0',
    borderBottom: `1px solid ${T.border}`,
    marginBottom: 16,
  },
  chartBar: {
    flex: 1,
    background: `linear-gradient(180deg, ${T.accent} 0%, ${T.accentDim} 100%)`,
    borderRadius: '4px 4px 0 0',
    minHeight: 2,
    transition: 'height 0.2s',
  },

  historyList: { marginTop: 16 },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: `1px solid ${T.border}`,
    fontSize: 13,
  },
  historyVal: { color: T.text, fontWeight: 600 },
  historyDate: { color: T.textDim },

  /* Log Form */
  form: {
    background: T.low,
    borderRadius: 16,
    padding: 24,
    border: `1px solid ${T.border}`,
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: T.text,
    marginBottom: 16,
  },
  formRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 6,
  },
  input: {
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: T.text,
    width: 140,
    fontFamily: font,
  },
  select: {
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
  },
  btn: {
    background: T.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    padding: '10px 24px',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  btnOutline: {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    borderRadius: 9999,
    padding: '10px 24px',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: T.text,
    cursor: 'pointer',
  },

  empty: {
    padding: 32,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

const RANGES = [
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1y', label: '1y', days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

export default function VitalsPage() {
  const [latest, setLatest] = useState<LatestMap | null>(null);
  const [history, setHistory] = useState<
    { value: number; value_secondary?: number | null; recorded_at: string }[]
  >([]);
  const [selectedType, setSelectedType] = useState<VitalType>('heart_rate');
  const [range, setRange] = useState<RangeKey>('30d');
  const [logType, setLogType] = useState<VitalType>('heart_rate');
  const [logValue, setLogValue] = useState('');
  const [logSecondary, setLogSecondary] = useState('');
  const [saving, setSaving] = useState(false);

  const loadLatest = useCallback(async () => {
    try {
      const data = await fetchLatestVitals();
      setLatest(data);
    } catch (err) {
      console.error('Failed to load vitals:', err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchVitals(selectedType, 50);
      setHistory(
        data as { value: number; value_secondary?: number | null; recorded_at: string }[],
      );
    } catch (err) {
      console.error('Failed to load vitals history:', err);
    }
  }, [selectedType]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleLog = async () => {
    const val = parseFloat(logValue);
    if (isNaN(val)) return;
    setSaving(true);
    try {
      const typeInfo = VITAL_TYPES.find((t) => t.key === logType);
      const secondary = logType === 'blood_pressure' ? parseFloat(logSecondary) : undefined;
      await doLogVital(
        logType,
        val,
        typeInfo?.unit ?? '',
        isNaN(secondary as number) ? undefined : secondary,
      );
      setLogValue('');
      setLogSecondary('');
      await Promise.all([loadLatest(), loadHistory()]);
    } catch (err) {
      console.error('Failed to log vital:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatVitalValue = (
    key: VitalType,
    vital: { value: number; value_secondary?: number | null } | null,
  ) => {
    if (!vital) return '--';
    if (key === 'blood_pressure' && vital.value_secondary != null) {
      return `${Math.round(vital.value)}/${Math.round(vital.value_secondary)}`;
    }
    if (key === 'steps' || key === 'active_energy') {
      return Math.round(vital.value).toLocaleString();
    }
    if (key === 'body_temperature') return vital.value.toFixed(1);
    return Math.round(vital.value).toString();
  };

  const selectedInfo = VITAL_TYPES.find((t) => t.key === selectedType);

  // Chart values - clamp to selected range, bucket by day
  const rangeDays = RANGES.find((r) => r.key === range)?.days ?? 30;
  const cutoff = Date.now() - rangeDays * 86_400_000;
  const chartValues = history
    .filter((h) => new Date(h.recorded_at).getTime() >= cutoff)
    .map((h) => h.value)
    .reverse();
  const chartMax = chartValues.length > 0 ? Math.max(...chartValues) : 1;
  const chartMin = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const chartRange = chartMax - chartMin || 1;

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Vitals
        </Link>
        <h1 style={s.title}>Vitals</h1>
        <p style={s.subtitle}>Monitor your biomarkers and trends over time</p>

        <div style={s.headerRow}>
          <div style={s.sectionLabel}>Latest Readings</div>
          <div style={s.rangeFilter}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                style={{
                  ...s.rangePill,
                  ...(range === r.key ? s.rangePillActive : {}),
                }}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vitals Grid */}
        <div style={s.grid}>
          {VITAL_TYPES.map((vt) => {
            const val = latest?.[vt.key] as
              | { value: number; value_secondary?: number | null }
              | null
              | undefined;
            const isActive = selectedType === vt.key;
            return (
              <div
                key={vt.key}
                style={{ ...s.vitalCard, ...(isActive ? s.vitalCardActive : {}) }}
                onClick={() => setSelectedType(vt.key)}
              >
                <div style={s.vitalHead}>
                  <div style={s.vitalLabel}>{vt.label}</div>
                  <div style={s.vitalIcon}>{vt.icon}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={s.vitalValue}>{formatVitalValue(vt.key, val ?? null)}</span>
                  <span style={s.vitalUnit}>{vt.unit}</span>
                </div>
                <div style={s.sparkline}>
                  {[4, 8, 5, 12, 16, 10, 6].map((h, i) => (
                    <div key={i} style={{ ...s.sparkBar, height: h * 1.6 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div style={s.detailPanel}>
          <div style={s.detailHeader}>
            <div>
              <div style={s.sectionLabel}>Detail</div>
              <div style={s.detailTitle}>
                {selectedInfo?.label ?? selectedType}
              </div>
              <div style={s.detailMeta}>
                {history.length} readings • Range: {chartValues.length > 0 ? `${Math.round(chartMin)} – ${Math.round(chartMax)} ${selectedInfo?.unit}` : 'no data'}
              </div>
            </div>
          </div>

          {chartValues.length > 0 ? (
            <div style={s.chartArea}>
              {chartValues.slice(-30).map((v, i) => {
                const pct = ((v - chartMin) / chartRange) * 100;
                return (
                  <div
                    key={i}
                    style={{ ...s.chartBar, height: `${Math.max(4, pct)}%` }}
                  />
                );
              })}
            </div>
          ) : (
            <div style={s.empty}>No readings in this range yet</div>
          )}

          <div style={s.historyList}>
            {history.slice(0, 8).map((entry, i) => (
              <div key={i} style={s.historyRow}>
                <span style={s.historyVal}>
                  {selectedType === 'blood_pressure' && entry.value_secondary != null
                    ? `${Math.round(entry.value)}/${Math.round(entry.value_secondary)}`
                    : Math.round(entry.value).toLocaleString()}{' '}
                  <span style={s.historyDate}>{selectedInfo?.unit}</span>
                </span>
                <span style={s.historyDate}>
                  {new Date(entry.recorded_at).toLocaleDateString()}{' '}
                  {new Date(entry.recorded_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Log Form */}
        <div style={s.form}>
          <div style={s.formTitle}>Log New Measurement</div>
          <div style={s.formRow}>
            <div>
              <div style={s.fieldLabel}>Type</div>
              <select
                style={s.select}
                value={logType}
                onChange={(e) => setLogType(e.target.value as VitalType)}
              >
                {VITAL_TYPES.map((vt) => (
                  <option key={vt.key} value={vt.key}>
                    {vt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={s.fieldLabel}>
                {logType === 'blood_pressure' ? 'Systolic' : 'Value'}
              </div>
              <input
                style={s.input}
                type="number"
                placeholder="0"
                value={logValue}
                onChange={(e) => setLogValue(e.target.value)}
              />
            </div>
            {logType === 'blood_pressure' && (
              <div>
                <div style={s.fieldLabel}>Diastolic</div>
                <input
                  style={s.input}
                  type="number"
                  placeholder="0"
                  value={logSecondary}
                  onChange={(e) => setLogSecondary(e.target.value)}
                />
              </div>
            )}
            <button
              type="button"
              style={{ ...s.btn, opacity: saving ? 0.5 : 1 }}
              onClick={handleLog}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Log'}
            </button>
            <button type="button" style={s.btnOutline}>
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
