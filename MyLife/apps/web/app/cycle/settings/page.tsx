'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchCycleSettings,
  fetchCycleStats,
  fetchCycles,
  saveCycleSettings,
} from '../actions';
import {
  TOKENS,
  chipStyle,
  eyebrowStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  panelStyle,
  subtitleStyle,
  titleStyle,
} from '../ui';

type SettingsData = Awaited<ReturnType<typeof fetchCycleSettings>>;

function NumberStepper({
  label,
  caption,
  value,
  onChange,
}: {
  label: string;
  caption: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div style={{ ...panelStyle('base'), padding: 18 }}>
      <p style={eyebrowStyle}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <button type="button" onClick={() => onChange(value - 1)} style={ghostButtonStyle}>
          -
        </button>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} style={ghostButtonStyle}>
          +
        </button>
      </div>
      <p style={{ ...subtitleStyle, marginTop: 12 }}>{caption}</p>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ ...panelStyle('base'), padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <p style={{ ...subtitleStyle, marginTop: 6 }}>{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: 54,
          height: 30,
          border: 'none',
          borderRadius: 999,
          background: checked ? TOKENS.accent : 'rgba(255,255,255,0.08)',
          cursor: 'pointer',
          padding: 3,
        }}
      >
        <span
          style={{
            display: 'block',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: checked ? '#111' : 'rgba(255,255,255,0.5)',
            transform: checked ? 'translateX(24px)' : 'translateX(0)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
    </div>
  );
}

export default function CycleSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await fetchCycleSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSettings = useCallback((updater: (current: SettingsData) => SettingsData) => {
    setSettings((current) => (current ? updater(current) : current));
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveCycleSettings({
        defaultCycleLength: settings.defaultCycleLength,
        defaultPeriodLength: settings.defaultPeriodLength,
        trackingMode: settings.trackingMode,
        temperatureUnit: settings.temperatureUnit,
        predictionsEnabled: settings.predictionsEnabled,
        periodReminder: settings.periodReminder,
        fertileAlerts: settings.fertileAlerts,
      });
      setSettings(saved);
      setNotice('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const download = useCallback((filename: string, content: BlobPart, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const cycles = await fetchCycles(500);
      const header = 'Start Date,End Date,Cycle Length,Period Length\n';
      const rows = cycles
        .map(
          (cycle) =>
            `${cycle.startDate},${cycle.endDate ?? ''},${cycle.lengthDays ?? ''},${cycle.periodLength ?? ''}`,
        )
        .join('\n');
      download(`mycycle-export-${new Date().toISOString().slice(0, 10)}.csv`, `${header}${rows}`, 'text/csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }, [download]);

  const handleExportJson = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const [cycles, stats] = await Promise.all([fetchCycles(500), fetchCycleStats()]);
      download(
        `mycycle-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify({ exportedAt: new Date().toISOString(), cycles, stats }, null, 2),
        'application/json',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export JSON');
    } finally {
      setExporting(false);
    }
  }, [download]);

  if (loading) {
    return (
      <div className="cy-grid-2">
        <div style={{ ...panelStyle('mid'), minHeight: 320, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        <div style={{ ...panelStyle('low'), minHeight: 320, opacity: 0.45, animation: 'pulse 2s infinite' }} />
      </div>
    );
  }

  if (!settings) {
    return (
      <section style={{ ...panelStyle('low'), padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error ?? 'Settings unavailable'}</p>
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
            'radial-gradient(circle at top left, rgba(255,184,119,0.16), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        }}
      >
        <p style={eyebrowStyle}>Preferences</p>
        <h1 style={{ ...titleStyle, marginTop: 12 }}>Settings</h1>
        <p style={{ ...subtitleStyle, marginTop: 12, maxWidth: 560 }}>
          Adjust cycle assumptions, tune prediction behavior, manage partner sharing, and export your data without leaving MyCycle.
        </p>
      </section>

      {error ? (
        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
        </section>
      ) : null}

      {notice ? (
        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={{ color: TOKENS.success, fontWeight: 700 }}>{notice}</p>
        </section>
      ) : null}

      <div className="cy-grid-2">
        <div className="cy-card-stack">
          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Tracking</p>
            <div className="cy-grid-2" style={{ marginTop: 18 }}>
              <NumberStepper
                label="Default Cycle Length"
                caption="Average days between periods."
                value={settings.defaultCycleLength}
                onChange={(next) =>
                  updateSettings((current) => ({
                    ...current,
                    defaultCycleLength: Math.max(18, Math.min(60, next)),
                  }))
                }
              />
              <NumberStepper
                label="Default Period Length"
                caption="Average days of bleeding."
                value={settings.defaultPeriodLength}
                onChange={(next) =>
                  updateSettings((current) => ({
                    ...current,
                    defaultPeriodLength: Math.max(2, Math.min(12, next)),
                  }))
                }
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <p style={eyebrowStyle}>Tracking Mode</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((current) => ({ ...current, trackingMode: 'adaptive' }))
                  }
                  style={chipStyle(settings.trackingMode === 'adaptive', TOKENS.accent)}
                >
                  Adaptive
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((current) => ({ ...current, trackingMode: 'manual' }))
                  }
                  style={chipStyle(settings.trackingMode === 'manual', TOKENS.accent)}
                >
                  Manual
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <p style={eyebrowStyle}>Temperature Unit</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((current) => ({ ...current, temperatureUnit: 'fahrenheit' }))
                  }
                  style={chipStyle(settings.temperatureUnit === 'fahrenheit', TOKENS.accent)}
                >
                  Fahrenheit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((current) => ({ ...current, temperatureUnit: 'celsius' }))
                  }
                  style={chipStyle(settings.temperatureUnit === 'celsius', TOKENS.accent)}
                >
                  Celsius
                </button>
              </div>
            </div>
          </section>

          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Predictions</p>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <ToggleRow
                title="Enable predictions"
                description="Forecast next period, fertile window, and confidence."
                checked={settings.predictionsEnabled}
                onToggle={() =>
                  updateSettings((current) => ({
                    ...current,
                    predictionsEnabled: !current.predictionsEnabled,
                  }))
                }
              />
              <ToggleRow
                title="Period reminder"
                description="Get a heads-up before the predicted period window."
                checked={settings.periodReminder}
                onToggle={() =>
                  updateSettings((current) => ({
                    ...current,
                    periodReminder: !current.periodReminder,
                  }))
                }
              />
              <ToggleRow
                title="Fertile alerts"
                description="Surface fertile-window reminders inside the hub."
                checked={settings.fertileAlerts}
                onToggle={() =>
                  updateSettings((current) => ({
                    ...current,
                    fertileAlerts: !current.fertileAlerts,
                  }))
                }
              />
            </div>
          </section>

          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>About</p>
            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
              <p style={{ fontSize: 18, fontWeight: 800 }}>Private by default</p>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                MyCycle data stays local in MyLife until you explicitly export or share it through partner sync.
              </p>
            </div>
          </section>
        </div>

        <div className="cy-card-stack">
          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Pregnancy</p>
            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
              <p style={{ fontSize: 18, fontWeight: 800 }}>
                {settings.activePregnancy ? 'Pregnancy mode is active' : 'Pregnancy mode is off'}
              </p>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                {settings.activePregnancy
                  ? 'Continue tracking milestones, development, and appointments.'
                  : 'Switch from cycle forecasting to pregnancy tracking whenever needed.'}
              </p>
              <Link href="/cycle/pregnancy" style={{ ...gradientButtonStyle, display: 'inline-flex', marginTop: 16, textDecoration: 'none' }}>
                {settings.activePregnancy ? 'Open pregnancy mode' : 'Enter pregnancy mode'}
              </Link>
            </div>
          </section>

          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Partner Sharing</p>
            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
              <p style={{ fontSize: 18, fontWeight: 800 }}>
                {settings.activePartnerLink ? 'Partner link is active' : 'No partner link yet'}
              </p>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                {settings.activePartnerLink
                  ? 'Manage permissions, preview the partner view, or revoke access.'
                  : 'Create a privacy-controlled share code for your partner.'}
              </p>
              <Link href="/cycle/sharing" style={{ ...ghostButtonStyle, display: 'inline-flex', marginTop: 16, textDecoration: 'none' }}>
                Manage sharing
              </Link>
            </div>
          </section>

          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={eyebrowStyle}>Data</p>
            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
              <p style={{ fontSize: 18, fontWeight: 800 }}>Export and archive</p>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                Download the complete cycle history. Current record count: {settings.cycleCount} cycles.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <button type="button" onClick={() => void handleExportCsv()} disabled={exporting} style={ghostButtonStyle}>
                  {exporting ? 'Working…' : 'Export CSV'}
                </button>
                <button type="button" onClick={() => void handleExportJson()} disabled={exporting} style={ghostButtonStyle}>
                  {exporting ? 'Working…' : 'Export JSON'}
                </button>
              </div>
            </div>

            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 14 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: TOKENS.danger }}>Danger Zone</p>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                Full data deletion is still handled in the mobile flow to avoid accidental loss here.
              </p>
              <button type="button" style={{ ...ghostButtonStyle, color: TOKENS.danger, marginTop: 14 }}>
                Delete all cycle data
              </button>
            </div>
          </section>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => void handleSave()} disabled={saving} style={gradientButtonStyle}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
