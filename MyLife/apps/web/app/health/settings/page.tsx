'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  doSetHealthSetting,
  doSetManualSleepBridgeEnabled,
  fetchHealthSetting,
} from '../actions';

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
  accentDim: 'rgba(239,68,68,0.15)',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

type UnitSystem = 'imperial' | 'metric';

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 1080, margin: '0 auto' },
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

  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    marginBottom: 24,
  },

  section: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 20,
  },

  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: `1px solid ${T.border}`,
  },
  rowLast: {
    borderBottom: 'none',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: T.text,
  },
  rowDesc: { fontSize: 11, color: T.textDim, marginTop: 2 },

  toggle: {
    width: 48,
    height: 28,
    borderRadius: 9999,
    background: T.highest,
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.2s',
    border: 'none',
    padding: 0,
  },
  toggleOn: {
    background: T.accent,
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.2s',
  },

  select: {
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
  },

  dangerRow: {
    marginTop: 20,
    padding: 20,
    background: T.accentDim,
    borderRadius: 12,
    border: `1px solid ${T.accent}`,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: T.accent,
    marginBottom: 4,
  },
  dangerDesc: {
    fontSize: 11,
    color: T.textSecondary,
    marginBottom: 12,
    lineHeight: 1.6,
  },
  btnDanger: {
    background: 'transparent',
    border: `1px solid ${T.accent}`,
    color: T.accent,
    borderRadius: 9999,
    padding: '8px 18px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },

  actionBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  saveBtn: {
    padding: '12px 32px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  savedMsg: {
    color: T.accent,
    fontSize: 12,
    fontWeight: 600,
  },

  aboutRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    fontSize: 12,
    color: T.textDim,
  },
};

interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      style={{ ...s.toggle, ...(on ? s.toggleOn : {}) }}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <div style={{ ...s.toggleKnob, left: on ? 22 : 2 }} />
    </button>
  );
}

export default function HealthSettingsPage() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [bgSync, setBgSync] = useState(false);
  const [notifyVitals, setNotifyVitals] = useState(true);
  const [notifyMeds, setNotifyMeds] = useState(true);
  const [notifyMood, setNotifyMood] = useState(false);
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [manualSleepBridge, setManualSleepBridge] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sync, bg, vit, meds, mood, unit, priv, sleepBridge] = await Promise.all([
        fetchHealthSetting('sync_enabled'),
        fetchHealthSetting('background_sync'),
        fetchHealthSetting('notify_vitals'),
        fetchHealthSetting('notify_meds'),
        fetchHealthSetting('notify_mood'),
        fetchHealthSetting('units'),
        fetchHealthSetting('privacy_mode'),
        fetchHealthSetting('bridge.sleepJournal.enabled'),
      ]);
      if (sync != null) setSyncEnabled(sync === 'true');
      if (bg != null) setBgSync(bg === 'true');
      if (vit != null) setNotifyVitals(vit === 'true');
      if (meds != null) setNotifyMeds(meds === 'true');
      if (mood != null) setNotifyMood(mood === 'true');
      if (unit === 'metric' || unit === 'imperial') setUnits(unit);
      if (priv != null) setPrivacyMode(priv === 'true');
      if (sleepBridge != null) setManualSleepBridge(sleepBridge === 'true');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      await Promise.all([
        doSetHealthSetting('sync_enabled', String(syncEnabled)),
        doSetHealthSetting('background_sync', String(bgSync)),
        doSetHealthSetting('notify_vitals', String(notifyVitals)),
        doSetHealthSetting('notify_meds', String(notifyMeds)),
        doSetHealthSetting('notify_mood', String(notifyMood)),
        doSetHealthSetting('units', units),
        doSetHealthSetting('privacy_mode', String(privacyMode)),
        doSetManualSleepBridgeEnabled(manualSleepBridge),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Settings
        </Link>
        <h1 style={s.title}>Settings</h1>
        <p style={s.subtitle}>Configure sync, notifications, units, and privacy</p>

        <div style={s.twoCol}>
          {/* Left Column */}
          <div>
            {/* Sync */}
            <div style={s.section}>
              <div style={s.sectionLabel}>Apple Health Sync</div>
              <div style={s.row}>
                <div>
                  <div style={s.rowLabel}>Enable Sync</div>
                  <div style={s.rowDesc}>Mirror data from Apple Health or Health Connect</div>
                </div>
                <Toggle on={syncEnabled} onChange={setSyncEnabled} />
              </div>
              <div style={{ ...s.row, ...s.rowLast }}>
                <div>
                  <div style={s.rowLabel}>Background Sync</div>
                  <div style={s.rowDesc}>Sync automatically when the app launches</div>
                </div>
                <Toggle on={bgSync} onChange={setBgSync} />
              </div>
            </div>

            {/* Notifications */}
            <div style={{ ...s.section, marginTop: 24 }}>
              <div style={s.sectionLabel}>Notifications</div>
              <div style={s.row}>
                <div>
                  <div style={s.rowLabel}>Vital Alerts</div>
                  <div style={s.rowDesc}>Abnormal readings and trends</div>
                </div>
                <Toggle on={notifyVitals} onChange={setNotifyVitals} />
              </div>
              <div style={s.row}>
                <div>
                  <div style={s.rowLabel}>Medication Reminders</div>
                  <div style={s.rowDesc}>Scheduled dose alerts</div>
                </div>
                <Toggle on={notifyMeds} onChange={setNotifyMeds} />
              </div>
              <div style={{ ...s.row, ...s.rowLast }}>
                <div>
                  <div style={s.rowLabel}>Mood Check-ins</div>
                  <div style={s.rowDesc}>Daily wellness prompts</div>
                </div>
                <Toggle on={notifyMood} onChange={setNotifyMood} />
              </div>
            </div>

            {/* Units */}
            <div style={{ ...s.section, marginTop: 24 }}>
              <div style={s.sectionLabel}>Units</div>
              <div style={{ ...s.row, ...s.rowLast }}>
                <div>
                  <div style={s.rowLabel}>Measurement System</div>
                  <div style={s.rowDesc}>Weight, distance, and temperature</div>
                </div>
                <select
                  style={s.select}
                  value={units}
                  onChange={(e) => setUnits(e.target.value as UnitSystem)}
                >
                  <option value="imperial">Imperial (lbs, °F)</option>
                  <option value="metric">Metric (kg, °C)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Privacy */}
            <div style={s.section}>
              <div style={s.sectionLabel}>Privacy</div>
              <div style={s.row}>
                <div>
                  <div style={s.rowLabel}>Privacy Mode</div>
                  <div style={s.rowDesc}>Hide sensitive values in overview screens</div>
                </div>
                <Toggle on={privacyMode} onChange={setPrivacyMode} />
              </div>

              <div style={{ ...s.row, ...s.rowLast }}>
                <div>
                  <div style={s.rowLabel}>MySleep Journal Bridge</div>
                  <div style={s.rowDesc}>
                    Allow MyHealth to read aggregate MySleep manual journal trends
                  </div>
                </div>
                <Toggle on={manualSleepBridge} onChange={setManualSleepBridge} />
              </div>

              <div style={s.dangerRow}>
                <div style={s.dangerTitle}>Delete All Data</div>
                <div style={s.dangerDesc}>
                  Permanently remove all health records, documents, vitals, and emergency info
                  from this device. This action cannot be undone.
                </div>
                <button type="button" style={s.btnDanger}>
                  Delete Everything
                </button>
              </div>
            </div>

            {/* Data Management */}
            <div style={{ ...s.section, marginTop: 24 }}>
              <div style={s.sectionLabel}>Data Management</div>
              <div style={s.row}>
                <div>
                  <div style={s.rowLabel}>Export Data</div>
                  <div style={s.rowDesc}>Download reports and raw data</div>
                </div>
                <Link
                  href="/health/export"
                  style={{
                    ...s.btnDanger,
                    color: T.text,
                    borderColor: T.border,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Open
                </Link>
              </div>
              <div style={{ ...s.row, ...s.rowLast }}>
                <div>
                  <div style={s.rowLabel}>Vault</div>
                  <div style={s.rowDesc}>Manage documents and records</div>
                </div>
                <Link
                  href="/health/vault"
                  style={{
                    ...s.btnDanger,
                    color: T.text,
                    borderColor: T.border,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Open
                </Link>
              </div>
            </div>

            {/* About */}
            <div style={{ ...s.section, marginTop: 24 }}>
              <div style={s.sectionLabel}>About</div>
              <div style={s.aboutRow}>
                <span>Version</span>
                <span>1.0.0</span>
              </div>
              <div style={s.aboutRow}>
                <span>Storage</span>
                <span>Local SQLite</span>
              </div>
              <div style={s.aboutRow}>
                <span>Cloud Sync</span>
                <span>Disabled</span>
              </div>
              <div style={s.aboutRow}>
                <span>Analytics</span>
                <span>None</span>
              </div>
            </div>
          </div>
        </div>

        <div style={s.actionBar}>
          {saved && <span style={s.savedMsg}>✓ Settings saved</span>}
          <button type="button" style={s.saveBtn} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
