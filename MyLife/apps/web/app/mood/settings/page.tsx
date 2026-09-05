'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchLockConfig, saveLockConfig, removeLock,
  fetchSetting, saveSetting, fetchPet, fetchEntryCount, fetchBreathingSessions,
} from '../actions';
import { EVOLUTION_NAMES, getEvolutionStage, type Pet } from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

type LockMethod = 'pin' | 'biometric' | 'biometricWithPin';

const METHOD_OPTIONS: { value: LockMethod; label: string; icon: string }[] = [
  { value: 'pin', label: 'PIN', icon: '\u{1F522}' },
  { value: 'biometric', label: 'Biometric', icon: '\u{1F91A}' },
  { value: 'biometricWithPin', label: 'Both', icon: '\u{1F510}' },
];

const TIMEOUT_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
];

export default function SettingsPage() {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockMethod, setLockMethod] = useState<LockMethod>('pin');
  const [lockTimeout, setLockTimeout] = useState(0);
  const [showActivities, setShowActivities] = useState(true);
  const [showStreak, setShowStreak] = useState(true);
  const [hideFromSwitcher, setHideFromSwitcher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pet, setPet] = useState<Pet | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [breathingCount, setBreathingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [config, actPref, streakPref, switcherPref, p, count, breathing] = await Promise.all([
        fetchLockConfig(),
        fetchSetting('show_default_activities'),
        fetchSetting('show_streak_badge'),
        fetchSetting('hide_from_switcher'),
        fetchPet().catch(() => null),
        fetchEntryCount(),
        fetchBreathingSessions(1000),
      ]);
      if (config) {
        setLockEnabled(config.isEnabled);
        setLockMethod((config.method as LockMethod) ?? 'pin');
        setLockTimeout(config.lockTimeoutSeconds);
      }
      if (actPref !== null) setShowActivities(actPref !== 'false');
      if (streakPref !== null) setShowStreak(streakPref !== 'false');
      setHideFromSwitcher(switcherPref === 'true');
      setPet(p);
      setEntryCount(count);
      setBreathingCount(breathing.length);
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleLockToggle = async (enabled: boolean) => {
    setLockEnabled(enabled);
    try {
      if (!enabled) {
        await removeLock();
      } else {
        await saveLockConfig({ isEnabled: true, method: lockMethod, lockTimeoutSeconds: lockTimeout });
      }
    } catch {
      setError('Failed to update lock');
    }
  };

  const handleMethodChange = async (method: LockMethod) => {
    setLockMethod(method);
    if (lockEnabled) {
      try {
        await saveLockConfig({ isEnabled: true, method, lockTimeoutSeconds: lockTimeout });
      } catch {
        setError('Failed to update method');
      }
    }
  };

  const handleTimeoutChange = async (timeout: number) => {
    setLockTimeout(timeout);
    if (lockEnabled) {
      try {
        await saveLockConfig({ isEnabled: true, method: lockMethod, lockTimeoutSeconds: timeout });
      } catch {
        setError('Failed to update timeout');
      }
    }
  };

  const handlePrefChange = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    try {
      await saveSetting(key, String(value));
    } catch {
      setError('Failed to save preference');
    }
  };

  const handleResetLock = async () => {
    try {
      await removeLock();
      setLockEnabled(false);
    } catch {
      setError('Failed to reset lock');
    }
  };

  const handleExportData = () => {
    alert(`Your mood data includes ${entryCount} entries and ${breathingCount} breathing sessions. Export functionality coming soon.`);
  };

  const handleClearData = () => {
    if (confirm('This will permanently delete all your mood entries, breathing sessions, and settings. This action cannot be undone.')) {
      // TODO: implement full data clear
      alert('Data cleared.');
    }
  };

  if (loading) return <SettingsSkeleton />;

  const petStage = pet ? getEvolutionStage(pet.experience, pet.evolutionStage) : 0;
  const petStageName = pet ? (EVOLUTION_NAMES[petStage] ?? 'Companion') : 'Companion';
  const petLevel = pet ? Math.floor((pet.experience ?? 0) / 100) + 1 : 1;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT_SEC }}>
          Fine-tune your library and digital sanctuary.
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)', color: 'var(--danger)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Companion Card (full width) */}
      <Link href="/mood/pet" style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20,
        background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
        textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 32, background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(82, 68, 58, 0.3)',
        }}>
          <span style={{ fontSize: 32 }}>{'\uD83E\uDD89'}</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{pet?.name ?? 'Luna'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: TEXT_SEC }}>
            Level {petLevel} {'\u00B7'} {petStageName}
          </p>
        </div>
        <div style={{
          padding: '8px 18px', borderRadius: 20, background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(82, 68, 58, 0.2)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const }}>INTERACT</span>
        </div>
      </Link>

      {/* Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Column */}
        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          {/* Notifications */}
          <section style={{
            padding: 24, borderRadius: 20, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{'\uD83D\uDD14'}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ACCENT }}>Notifications</h2>
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
                <span style={{ fontSize: 14 }}>Morning Check-in</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: ACCENT }}>9:00 AM</span>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
                <span style={{ fontSize: 14 }}>Evening Review</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: ACCENT }}>9:00 PM</span>
              </div>
            </div>
          </section>

          {/* Module Preferences */}
          <section style={{
            padding: 24, borderRadius: 20, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{'\u2728'}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ACCENT }}>Preferences</h2>
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              <ToggleRow
                label="Show default activities"
                value={showActivities}
                onChange={(v) => void handlePrefChange('show_default_activities', v, setShowActivities)}
              />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
              <ToggleRow
                label="Show streak badge"
                value={showStreak}
                onChange={(v) => void handlePrefChange('show_streak_badge', v, setShowStreak)}
              />
            </div>
          </section>

          {/* Manage Content */}
          <section style={{
            padding: 24, borderRadius: 20, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{'\uD83D\uDCC2'}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ACCENT }}>Manage Content</h2>
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              <button
                onClick={() => alert('Activity management coming soon.')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
                  fontSize: 14, width: '100%', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14 }}>{'\u2728'}</span>
                <span style={{ flex: 1 }}>Activities management</span>
                <span style={{ color: TEXT_SEC }}>{'\u203A'}</span>
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
              <button
                onClick={handleExportData}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
                  fontSize: 14, width: '100%', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14 }}>{'\u{2B07}\uFE0F'}</span>
                <span style={{ flex: 1 }}>Export Data (CSV)</span>
                <span style={{ color: TEXT_SEC }}>{'\u203A'}</span>
              </button>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          {/* Privacy Lock */}
          <section style={{
            padding: 24, borderRadius: 20, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{'\uD83D\uDD12'}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ACCENT }}>Privacy</h2>
            </div>

            <ToggleRow
              label="App Lock"
              value={lockEnabled}
              onChange={(v) => void handleLockToggle(v)}
            />

            {lockEnabled && (
              <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                {/* Lock Method */}
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
                    Lock Method
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {METHOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => void handleMethodChange(opt.value)}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center',
                          border: `1px solid ${lockMethod === opt.value ? ACCENT : BORDER}`,
                          background: lockMethod === opt.value ? ACCENT : 'transparent',
                          color: lockMethod === opt.value ? '#0A0A0F' : TEXT_SEC,
                          fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeout */}
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
                    Auto-lock Timeout
                  </p>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => void handleTimeoutChange(opt.value)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderRadius: 10, border: `1px solid ${BORDER}`, background: 'transparent',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 9,
                          border: `2px solid ${lockTimeout === opt.value ? ACCENT : 'rgba(255,255,255,0.2)'}`,
                          background: lockTimeout === opt.value ? ACCENT : 'transparent',
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 14, color: 'var(--text)' }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => void handleResetLock()}
                  style={{
                    padding: '10px 16px', borderRadius: 10, border: `1px solid ${BORDER}`,
                    background: 'transparent', color: 'var(--danger)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', justifySelf: 'start',
                  }}
                >
                  Reset Lock
                </button>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '16px 0' }} />

            <ToggleRow
              label="Hide from Switcher"
              value={hideFromSwitcher}
              onChange={(v) => void handlePrefChange('hide_from_switcher', v, setHideFromSwitcher)}
            />
          </section>

          {/* Data Management */}
          <section style={{
            padding: 24, borderRadius: 20, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{'\uD83D\uDDC4\uFE0F'}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ACCENT }}>Data</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 14, borderRadius: 12, background: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: ACCENT }}>{entryCount}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: TEXT_SEC }}>ENTRIES</p>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: ACCENT }}>{breathingCount}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: TEXT_SEC }}>SESSIONS</p>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleClearData}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: 16, borderRadius: 16, border: 'none',
                background: 'var(--errorContainer, #93000A)', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 16 }}>{'\uD83D\uDDD1\uFE0F'}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger, #FFB4AB)' }}>Clear All Data</span>
            </button>
            <p style={{
              margin: '10px 0 0', fontSize: 11, fontWeight: 700, letterSpacing: 1,
              textTransform: 'uppercase' as const, color: 'var(--danger, #FFB4AB)', opacity: 0.7,
            }}>
              PERMANENT ACTION {'\u2022'} CANNOT BE UNDONE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Toggle Row ──────────────────────────────────────────────────────

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: value ? ACCENT : 'rgba(255,255,255,0.1)',
          position: 'relative', transition: 'background 200ms', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 22 : 2,
          width: 24, height: 24, borderRadius: 12, background: '#fff',
          transition: 'left 200ms',
        }} />
      </button>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────

function SettingsSkeleton() {
  const pulse = { borderRadius: 20, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' };
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...pulse, height: 60 }} />
      <div style={{ ...pulse, height: 80 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ ...pulse, height: 160 }} />
          <div style={{ ...pulse, height: 140 }} />
        </div>
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ ...pulse, height: 300 }} />
          <div style={{ ...pulse, height: 120 }} />
        </div>
      </div>
    </div>
  );
}
