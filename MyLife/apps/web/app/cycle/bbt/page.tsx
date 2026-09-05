'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TemperatureUnit } from '@mylife/cycle';
import {
  doUpsertTemperature,
  fetchCycleSettings,
  fetchCycleTemperatureBundle,
  saveCycleSettings,
} from '../actions';
import {
  PHASE_COLORS,
  TOKENS,
  chipStyle,
  eyebrowStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  inputStyle,
  panelStyle,
  subtitleStyle,
  titleStyle,
} from '../ui';
import { formatMonthDay } from '../utils';

type TemperatureData = Awaited<ReturnType<typeof fetchCycleTemperatureBundle>>;
type SettingsData = Awaited<ReturnType<typeof fetchCycleSettings>>;

function toDisplayValue(valueCelsius: number, unit: TemperatureUnit): number {
  if (unit === 'celsius') {
    return Math.round(valueCelsius * 10) / 10;
  }
  return Math.round((valueCelsius * 9) / 5 * 10 + 320) / 10;
}

function toCelsius(displayValue: number, unit: TemperatureUnit): number {
  if (unit === 'celsius') {
    return Math.round(displayValue * 100) / 100;
  }
  return Math.round((((displayValue - 32) * 5) / 9) * 100) / 100;
}

function formatPhaseLabel(value: TemperatureData['currentPhase']) {
  if (!value) return 'Cycle';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function TemperatureChart({
  data,
  unit,
}: {
  data: TemperatureData;
  unit: TemperatureUnit;
}) {
  const width = 820;
  const height = 280;
  const paddingX = 24;
  const paddingY = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const points = data.recentRows.map((row, index) => ({
    index,
    value: row.entry ? toDisplayValue(row.entry.valueCelsius, unit) : null,
    date: row.date,
    cycleDay: row.cycleDay,
  }));
  const values = points.map((point) => point.value).filter((value): value is number => value != null);
  const min = values.length > 0 ? Math.min(...values) - 0.25 : unit === 'celsius' ? 36 : 97;
  const max = values.length > 0 ? Math.max(...values) + 0.25 : unit === 'celsius' ? 37 : 99;
  const range = max - min || 1;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const chartPoints = points.map((point) => ({
    ...point,
    x: paddingX + point.index * stepX,
    y:
      point.value == null
        ? null
        : paddingY + ((max - point.value) / range) * plotHeight,
  }));
  const path = chartPoints
    .filter((point) => point.y != null)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const coverlineValue =
    data.analysis != null ? toDisplayValue(data.analysis.coverline, unit) : null;
  const coverlineY =
    coverlineValue == null
      ? null
      : paddingY + ((max - coverlineValue) / range) * plotHeight;
  const shiftDate =
    data.analysis?.shiftDetected && data.analysis.shiftStartIndex != null
      ? data.temperatures[data.analysis.shiftStartIndex]?.date ?? null
      : null;
  const shiftPoint = shiftDate
    ? chartPoints.find((point) => point.date === shiftDate) ?? null
    : null;

  return (
    <div style={{ ...panelStyle('base'), padding: 18 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="temperature-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(244,114,182,0.45)" />
            <stop offset="100%" stopColor={PHASE_COLORS.ovulation} />
          </linearGradient>
        </defs>

        {coverlineY != null ? (
          <>
            <line
              x1={paddingX}
              y1={coverlineY}
              x2={width - paddingX}
              y2={coverlineY}
              stroke="rgba(255,255,255,0.24)"
              strokeDasharray="6 6"
            />
            <text
              x={width - paddingX}
              y={coverlineY - 10}
              textAnchor="end"
              fill="rgba(255,255,255,0.4)"
              fontSize="10"
              fontWeight="700"
            >
              Coverline {coverlineValue?.toFixed(1)}°{unit === 'celsius' ? 'C' : 'F'}
            </text>
          </>
        ) : null}

        {shiftPoint ? (
          <>
            <line
              x1={shiftPoint.x}
              y1={paddingY}
              x2={shiftPoint.x}
              y2={height - paddingY}
              stroke={PHASE_COLORS.ovulation}
              strokeWidth="2"
              opacity="0.8"
            />
            <text
              x={shiftPoint.x + 8}
              y={paddingY + 14}
              fill={PHASE_COLORS.ovulation}
              fontSize="10"
              fontWeight="700"
            >
              Thermal shift
            </text>
          </>
        ) : null}

        {path ? (
          <path
            d={path}
            fill="none"
            stroke="url(#temperature-line)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {chartPoints.map((point) =>
          point.y != null ? (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r={point.date === data.today ? 5 : 4}
              fill={point.date === data.today ? PHASE_COLORS.ovulation : TOKENS.base}
              stroke={PHASE_COLORS.ovulation}
              strokeWidth="2"
            />
          ) : null,
        )}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, color: TOKENS.textSecondary, fontSize: 11, fontWeight: 700 }}>
        {chartPoints.map((point) => (
          <span key={point.date}>{point.cycleDay}</span>
        ))}
      </div>
    </div>
  );
}

export default function CycleBBTPage() {
  const [data, setData] = useState<TemperatureData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temperatureDate, setTemperatureDate] = useState('');
  const [temperatureInput, setTemperatureInput] = useState('');
  const [temperatureMethod, setTemperatureMethod] = useState<'oral' | 'vaginal' | 'skin_wearable'>('oral');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextData, nextSettings] = await Promise.all([
        fetchCycleTemperatureBundle(),
        fetchCycleSettings(),
      ]);
      setData(nextData);
      setSettings(nextSettings);
      setTemperatureDate(nextData.today);
      const todaysEntry = nextData.recentRows.find((row) => row.date === nextData.today)?.entry ?? null;
      setTemperatureInput(
        todaysEntry != null
          ? String(toDisplayValue(todaysEntry.valueCelsius, nextSettings.temperatureUnit))
          : '',
      );
      setTemperatureMethod(
        (todaysEntry?.method as 'oral' | 'vaginal' | 'skin_wearable') ?? 'oral',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BBT tracking');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentUnit = settings?.temperatureUnit ?? 'fahrenheit';

  const statCards = useMemo(() => {
    if (!data) return [];
    const coverline =
      data.analysis != null
        ? `${toDisplayValue(data.analysis.coverline, currentUnit).toFixed(1)}°${currentUnit === 'celsius' ? 'C' : 'F'}`
        : 'Pending';
    const shift = data.analysis?.shiftDetected && data.analysis.shiftStartIndex != null
      ? `CD ${data.analysis.shiftStartIndex + 1}`
      : 'Not yet';
    return [
      { label: 'Coverline', value: coverline },
      { label: 'Shift marker', value: shift },
      { label: 'Logged mornings', value: String(data.temperatures.length) },
    ];
  }, [currentUnit, data]);

  const handleUnitChange = useCallback(
    async (nextUnit: TemperatureUnit) => {
      if (!settings) return;
      setSaving(true);
      setError(null);
      try {
        const saved = await saveCycleSettings({
          defaultCycleLength: settings.defaultCycleLength,
          defaultPeriodLength: settings.defaultPeriodLength,
          trackingMode: settings.trackingMode,
          temperatureUnit: nextUnit,
          predictionsEnabled: settings.predictionsEnabled,
          periodReminder: settings.periodReminder,
          fertileAlerts: settings.fertileAlerts,
        });
        setSettings(saved);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update temperature unit');
      } finally {
        setSaving(false);
      }
    },
    [load, settings],
  );

  const handleSaveTemperature = useCallback(async () => {
    if (!temperatureInput || !settings) return;
    const numeric = Number(temperatureInput);
    if (!Number.isFinite(numeric)) {
      setError('Enter a valid temperature.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await doUpsertTemperature({
        date: temperatureDate,
        valueCelsius: toCelsius(numeric, settings.temperatureUnit),
        method: temperatureMethod,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save temperature');
    } finally {
      setSaving(false);
    }
  }, [load, settings, temperatureDate, temperatureInput, temperatureMethod]);

  if (loading) {
    return (
      <div className="cy-section-stack">
        <div style={{ ...panelStyle('mid'), minHeight: 240, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        <div style={{ ...panelStyle('low'), minHeight: 320, opacity: 0.45, animation: 'pulse 2s infinite' }} />
      </div>
    );
  }

  if (!data || !settings) {
    return (
      <section style={{ ...panelStyle('low'), padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error ?? 'Unable to load temperature tracking'}</p>
        <button type="button" onClick={() => void load()} style={{ ...ghostButtonStyle, marginTop: 14 }}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <div className="cy-section-stack" style={{ maxWidth: 980, margin: '0 auto' }}>
      <section
        style={{
          ...panelStyle('mid'),
          padding: 28,
          background:
            'radial-gradient(circle at top left, rgba(244,114,182,0.18), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        }}
      >
        <p style={{ ...eyebrowStyle, color: PHASE_COLORS.ovulation }}>
          Cycle Day {data.currentCycleDay} • {formatPhaseLabel(data.currentPhase)} Phase
        </p>
        <h1 style={{ ...titleStyle, marginTop: 12 }}>BBT Tracking</h1>
        <p style={{ ...subtitleStyle, marginTop: 12, maxWidth: 560 }}>{data.summaryText}</p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          <button
            type="button"
            onClick={() => void handleUnitChange('fahrenheit')}
            disabled={saving}
            style={chipStyle(currentUnit === 'fahrenheit', TOKENS.accent)}
          >
            Fahrenheit
          </button>
          <button
            type="button"
            onClick={() => void handleUnitChange('celsius')}
            disabled={saving}
            style={chipStyle(currentUnit === 'celsius', TOKENS.accent)}
          >
            Celsius
          </button>
        </div>
      </section>

      {error ? (
        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
        </section>
      ) : null}

      <div className="cy-grid-3-2">
        <div className="cy-card-stack">
          <section style={{ ...panelStyle('low'), padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p style={eyebrowStyle}>Cycle Overview</p>
                <p style={{ ...subtitleStyle, marginTop: 10 }}>
                  Recent mornings shown across the current cycle.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: TOKENS.textSecondary, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(244,114,182,0.35)' }} />
                  Follicular
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: TOKENS.textSecondary, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_COLORS.ovulation }} />
                  Luteal
                </span>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <TemperatureChart data={data} unit={currentUnit} />
            </div>
          </section>

          <section style={{ ...panelStyle('low'), padding: 24 }}>
            <p style={eyebrowStyle}>Daily Log Grid</p>
            <div className="cy-grid-4" style={{ marginTop: 18 }}>
              {data.recentRows.map((row) => (
                <div
                  key={row.date}
                  style={{
                    ...panelStyle('base'),
                    padding: 16,
                    background: row.date === data.today ? 'rgba(244,114,182,0.14)' : undefined,
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 800, color: TOKENS.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {formatMonthDay(row.date)}
                  </p>
                  <p style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>
                    {row.displayValue != null ? `${row.displayValue.toFixed(1)}°` : '—'}
                  </p>
                  <p style={{ ...subtitleStyle, marginTop: 8 }}>CD {row.cycleDay}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="cy-card-stack">
          <section style={{ ...panelStyle('low'), padding: 24 }}>
            <p style={eyebrowStyle}>Quick Log</p>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <input
                type="date"
                value={temperatureDate}
                onChange={(event) => setTemperatureDate(event.target.value)}
                style={inputStyle}
              />
              <input
                value={temperatureInput}
                onChange={(event) => setTemperatureInput(event.target.value)}
                placeholder={currentUnit === 'celsius' ? '36.6' : '97.9'}
                inputMode="decimal"
                style={inputStyle}
              />
              <select
                value={temperatureMethod}
                onChange={(event) =>
                  setTemperatureMethod(event.target.value as 'oral' | 'vaginal' | 'skin_wearable')
                }
                style={inputStyle}
              >
                <option value="oral">Oral</option>
                <option value="vaginal">Vaginal</option>
                <option value="skin_wearable">Wearable</option>
              </select>
              <button type="button" onClick={() => void handleSaveTemperature()} disabled={saving || !temperatureInput} style={gradientButtonStyle}>
                {saving ? 'Saving…' : 'Log Temperature'}
              </button>
            </div>
          </section>

          <section style={{ ...panelStyle('low'), padding: 24 }}>
            <p style={eyebrowStyle}>Signals</p>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {statCards.map((card) => (
                <div key={card.label} style={{ ...panelStyle('base'), padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: TOKENS.textSecondary }}>
                    {card.label}
                  </p>
                  <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
