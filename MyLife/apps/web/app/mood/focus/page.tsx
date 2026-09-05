'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  fetchSoundPresets,
  addFocusSession,
  endFocusSession,
  fetchFocusSessions,
  addSoundPreset,
} from '../actions';
import {
  SOUND_LIBRARY,
  DEFAULT_PRESETS,
  getSoundsByCategory,
  getSoundById,
  validateLayers,
  type SoundPreset,
  type SoundLayer,
  type SoundDefinition,
  type FocusSession,
} from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

const SOUND_ICONS: Record<string, string> = {
  rain: '\uD83C\uDF27\uFE0F',
  thunder_distant: '\u26C8\uFE0F',
  ocean: '\uD83C\uDF0A',
  wind: '\uD83C\uDF2C\uFE0F',
  birds: '\uD83D\uDC26',
  creek: '\uD83D\uDCA7',
  fire: '\uD83D\uDD25',
  cafe: '\u2615',
  library: '\uD83D\uDCDA',
  train: '\uD83D\uDE82',
  white_noise: '\u26AA',
  pink_noise: '\uD83D\uDFE3',
  brown_noise: '\uD83D\uDFE4',
};

const SOUND_DESCRIPTIONS: Record<string, string> = {
  rain: 'Gentle summer shower',
  thunder_distant: 'Rumbling distant storm',
  ocean: 'Rolling waves on sand',
  wind: 'Soft mountain breeze',
  birds: 'Morning forest chorus',
  creek: 'Babbling stream',
  fire: 'Crackling fireplace',
  cafe: 'Warm coffee shop chatter',
  library: 'Quiet page-turning ambiance',
  train: 'Rhythmic rail journey',
  white_noise: 'Full-spectrum static for focus',
  pink_noise: 'Balanced static for focus',
  brown_noise: 'Deep, low frequency rumble',
};

const CATEGORY_LABELS: Record<string, string> = {
  nature: 'NATURE',
  ambient: 'AMBIENT',
  music: 'MUSIC',
  noise: 'WHITE NOISE',
};

const DURATIONS = [
  { value: 900, label: '15 min' },
  { value: 1800, label: '25 min' },
  { value: 2700, label: '45 min' },
  { value: 3600, label: '60 min' },
];

export default function FocusPage() {
  const [presets, setPresets] = useState<SoundPreset[]>([]);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [activeLayers, setActiveLayers] = useState<SoundLayer[]>([]);
  const [targetDuration, setTargetDuration] = useState(1800);
  const [loading, setLoading] = useState(true);
  const [preMood, setPreMood] = useState(5);
  const [postMood, setPostMood] = useState(5);
  const [tick, setTick] = useState(0);

  // Active session
  const [activeSession, setActiveSession] = useState<{
    id: string;
    presetName: string;
    elapsed: number;
    phase: 'running' | 'post-mood' | 'complete';
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [p, s] = await Promise.all([fetchSoundPresets(), fetchFocusSessions(10)]);
        if (cancelled) return;
        const all = p.length > 0
          ? p
          : DEFAULT_PRESETS.map((dp, i) => ({
              ...dp,
              id: `default-${i}`,
              isDefault: true,
              sortOrder: i,
              createdAt: '',
              updatedAt: '',
            }));
        setPresets(all as SoundPreset[]);
        setRecentSessions(s);
      } catch { /* skip */ }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [tick]);

  const toggleSound = useCallback((soundId: string) => {
    setActiveLayers((prev) => {
      const exists = prev.find((l) => l.sound === soundId);
      if (exists) return prev.filter((l) => l.sound !== soundId);
      return [...prev, { sound: soundId, volume: 0.5 }];
    });
  }, []);

  const setVolume = useCallback((soundId: string, volume: number) => {
    setActiveLayers((prev) =>
      prev.map((l) => (l.sound === soundId ? { ...l, volume } : l)),
    );
  }, []);

  const removeLayer = useCallback((soundId: string) => {
    setActiveLayers((prev) => prev.filter((l) => l.sound !== soundId));
  }, []);

  const loadPreset = useCallback((preset: SoundPreset) => {
    setActiveLayers(preset.layers.map((l) => ({ ...l })));
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (activeLayers.length === 0) return;
    try {
      await addSoundPreset({ name: 'Custom Mix', layers: activeLayers });
      setTick((t) => t + 1);
    } catch { /* skip */ }
  }, [activeLayers]);

  const startSession = useCallback(async () => {
    if (activeLayers.length === 0) return;
    const validation = validateLayers(activeLayers);
    if (!validation.valid) return;
    const presetName = activeLayers.length === 1
      ? (getSoundById(activeLayers[0].sound)?.name ?? 'Custom')
      : 'Custom Mix';
    try {
      const result = await addFocusSession({
        presetName,
        layers: activeLayers,
        targetDurationSeconds: targetDuration,
      });
      setActiveSession({ id: result.id, presetName, elapsed: 0, phase: 'running' });
      intervalRef.current = setInterval(() => {
        setActiveSession((prev) => {
          if (!prev || prev.phase !== 'running') return prev;
          const next = prev.elapsed + 1;
          if (next >= targetDuration) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return { ...prev, elapsed: next, phase: 'post-mood' };
          }
          return { ...prev, elapsed: next };
        });
      }, 1000);
    } catch { /* skip */ }
  }, [activeLayers, targetDuration]);

  const stopSession = useCallback(async () => {
    if (!activeSession) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      await endFocusSession(activeSession.id, { actualDurationSeconds: activeSession.elapsed });
      setTick((t) => t + 1);
    } catch { /* skip */ }
    setActiveSession(null);
  }, [activeSession]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const categories: SoundDefinition['category'][] = ['nature', 'ambient', 'music', 'noise'];

  // --- Loading ---
  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  // --- Active session ---
  if (activeSession) {
    const remaining = Math.max(0, targetDuration - activeSession.elapsed);
    const pct = Math.min(100, (activeSession.elapsed / targetDuration) * 100);
    const done = activeSession.elapsed >= targetDuration;

    // Post-mood
    if (activeSession.phase === 'post-mood') {
      return (
        <div style={{ display: 'grid', gap: 24, maxWidth: 480, margin: '0 auto', padding: '48px 0' }}>
          <div style={{ padding: 32, borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Session Complete</p>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: TEXT_SEC }}>How do you feel after your focus session?</p>
            <MoodSlider value={postMood} onChange={setPostMood} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button type="button" onClick={() => void stopSession()} style={{
                padding: '14px 32px', borderRadius: 999, border: 'none',
                background: `linear-gradient(135deg, ${ACCENT}, #C9894D)`, color: '#0A0A0F',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}>Save & Close</button>
            </div>
          </div>
        </div>
      );
    }

    // Running
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', gap: 24,
      }}>
        <p style={{ fontSize: 48, margin: 0 }}>{'\uD83C\uDFB5'}</p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{activeSession.presetName}</h2>

        {/* Active layers display */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {activeLayers.map((layer) => (
            <span key={layer.sound} style={{
              padding: '6px 14px', borderRadius: 999,
              background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
              fontSize: 13, color: 'var(--text)', fontWeight: 600,
            }}>
              {SOUND_ICONS[layer.sound] ?? '\uD83C\uDFB5'} {getSoundById(layer.sound)?.name ?? layer.sound} {Math.round(layer.volume * 100)}%
            </span>
          ))}
        </div>

        {/* Progress */}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: ACCENT, width: `${pct}%`, transition: 'width 1s linear' }} />
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: ACCENT }}>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </p>

        <button type="button" onClick={() => void stopSession()} style={{
          padding: '14px 32px', borderRadius: 999, border: 'none',
          background: done ? ACCENT : 'var(--danger)',
          color: done ? '#0A0A0F' : '#fff',
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          {done ? 'Done' : 'End Session'}
        </button>
      </div>
    );
  }

  // --- Default: full-width sound mixer ---
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20 }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT }}>
            CURATE YOUR AUDITORY SANCTUARY
          </p>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>
            Curate Your <em style={{ fontStyle: 'italic', fontWeight: 800 }}>Silence.</em>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(228,225,233,0.6)', maxWidth: 480 }}>
            Mix ambient frequencies and nature textures to build the perfect focus environment. Save your custom presets for future sessions.
          </p>
        </div>

        {/* Active Spectrum sidebar (right column) */}
        {activeLayers.length > 0 && (
          <div style={{
            width: 280, padding: 20, borderRadius: 20,
            background: SURFACE, border: `1px solid ${BORDER}`,
            alignSelf: 'start',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text)' }}>
                Active Spectrum
              </p>
              <button type="button" onClick={() => void handleSavePreset()} style={{
                padding: '4px 10px', borderRadius: 8, border: `1px solid ${ACCENT_BORDER}`,
                background: ACCENT_DIM, color: ACCENT, fontSize: 10, fontWeight: 700,
                letterSpacing: 0.5, cursor: 'pointer',
              }}>SAVE</button>
            </div>
            {activeLayers.map((layer) => {
              const sound = getSoundById(layer.sound);
              return (
                <div key={layer.sound} style={{
                  padding: '10px 0', borderBottom: `1px solid ${BORDER}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{SOUND_ICONS[layer.sound] ?? '\uD83C\uDFB5'}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sound?.name ?? layer.sound}</span>
                    </div>
                    <button type="button" onClick={() => removeLayer(layer.sound)} style={{
                      background: 'none', border: 'none', color: 'rgba(228,225,233,0.4)',
                      fontSize: 16, cursor: 'pointer', padding: 0,
                    }}>{'\u00D7'}</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layer.volume * 100)}
                      onChange={(e) => setVolume(layer.sound, Number(e.target.value) / 100)}
                      style={{ flex: 1, accentColor: 'var(--accent-mood)' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: 'rgba(228,225,233,0.5)', width: 32, textAlign: 'right' }}>
                      {Math.round(layer.volume * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Current State indicator */}
            <div style={{ marginTop: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
                Current State
              </p>
              <div style={{ display: 'flex', gap: 4 }}>
                {activeLayers.map((layer) => (
                  <div key={layer.sound} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: ACCENT, opacity: layer.volume,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Atmospheric Library: Sound Grid */}
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Atmospheric Library
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {SOUND_LIBRARY.map((sound) => {
            const isActive = activeLayers.some((l) => l.sound === sound.id);
            return (
              <button
                key={sound.id}
                type="button"
                onClick={() => toggleSound(sound.id)}
                style={{
                  padding: 16, borderRadius: 16,
                  border: `1px solid ${isActive ? ACCENT : BORDER}`,
                  background: isActive ? ACCENT_DIM : GLASS,
                  cursor: 'pointer', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'border-color 150ms ease',
                }}
              >
                <span style={{ fontSize: 28 }}>{SOUND_ICONS[sound.id] ?? '\uD83C\uDFB5'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sound.name}</span>
                {isActive && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{'\u25CF'} ACTIVE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus Session Settings */}
      <div style={{
        padding: 24, borderRadius: 20,
        background: SURFACE, border: `1px solid ${BORDER}`,
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Focus Session Settings
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: TEXT_SEC }}>Duration:</span>
          {DURATIONS.map((d) => {
            const active = targetDuration === d.value;
            return (
              <button key={d.value} type="button" onClick={() => setTargetDuration(d.value)} style={{
                padding: '8px 16px', borderRadius: 12,
                border: `1px solid ${active ? ACCENT : BORDER}`,
                background: active ? ACCENT_DIM : 'transparent',
                color: active ? ACCENT : TEXT_SEC,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{d.label}</button>
            );
          })}
        </div>

        {/* Pre-mood check */}
        <div style={{ marginTop: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            How are you feeling?
          </p>
          <MoodSlider value={preMood} onChange={setPreMood} />
        </div>

        {/* Start button */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => void startSession()}
            disabled={activeLayers.length === 0}
            style={{
              padding: '14px 40px', borderRadius: 999, border: 'none',
              background: activeLayers.length === 0 ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${ACCENT}, #C9894D)`,
              color: activeLayers.length === 0 ? TEXT_SEC : '#0A0A0F',
              fontWeight: 700, fontSize: 15, cursor: activeLayers.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            START SESSION <span style={{ fontSize: 18 }}>{'\u203A'}</span>
          </button>
        </div>
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Quick Start Presets
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPreset(preset)}
                style={{
                  padding: 16, borderRadius: 16,
                  border: `1px solid ${BORDER}`, background: GLASS,
                  cursor: 'pointer', textAlign: 'left',
                  display: 'grid', gap: 6,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{preset.name}</span>
                <span style={{ fontSize: 12, color: 'rgba(228,225,233,0.5)' }}>
                  {preset.layers.map((l) => getSoundById(l.sound)?.name ?? l.sound).join(' + ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <section>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Recent Sessions
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {recentSessions.map((s) => (
              <div key={s.id} style={{
                padding: '12px 16px', borderRadius: 14,
                border: `1px solid ${BORDER}`, background: GLASS,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.presetName}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: TEXT_SEC }}>
                    {new Date(s.startedAt).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>
                    {Math.round(s.actualDurationSeconds / 60)}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Mood Slider ---

function MoodSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = n === value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: active ? 'var(--accent-mood)' : 'rgba(255,255,255,0.06)',
              border: 'none', color: active ? '#1a1008' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >{n}</button>
        );
      })}
    </div>
  );
}
