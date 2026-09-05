'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  fetchMeditationTemplates,
  fetchMeditationTemplatesByCategory,
  addMeditationSession,
  endMeditationSession,
  fetchMeditationSessions,
} from '../actions';
import type { MeditationTemplate, MeditationSession, MeditationStep } from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

interface CategoryDef { key: string; label: string }

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: 'All' },
  { key: 'beginner', label: 'Breathe' },
  { key: 'body_scan', label: 'Calm' },
  { key: 'mindfulness', label: 'Focus' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'visualization', label: 'Visualize' },
];

const CAT_EMOJIS: Record<string, string> = {
  beginner: '\uD83C\uDF3F',
  body_scan: '\uD83E\uDDD8',
  mindfulness: '\uD83D\uDCA0',
  sleep: '\uD83C\uDF19',
  visualization: '\uD83C\uDF0C',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} MIN`;
}

export default function MeditatePage() {
  const [templates, setTemplates] = useState<MeditationTemplate[]>([]);
  const [sessions, setSessions] = useState<MeditationSession[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MeditationTemplate | null>(null);

  // Active session state
  const [activeSession, setActiveSession] = useState<{
    id: string;
    template: MeditationTemplate;
    stepIdx: number;
    elapsed: number;
    totalElapsed: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tmpl, sess] = await Promise.all([
          fetchMeditationTemplates(),
          fetchMeditationSessions(10),
        ]);
        if (!cancelled) {
          setTemplates(tmpl);
          setSessions(sess);
        }
      } catch {
        if (!cancelled) setError('Failed to load meditation data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = category === 'all' ? templates : templates.filter((t) => t.category === category);
  const featured = templates.length > 0 ? templates[0] : null;

  const startSession = useCallback(async (template: MeditationTemplate) => {
    try {
      const result = await addMeditationSession({
        templateId: template.id,
        templateName: template.name,
        durationSeconds: template.durationSeconds,
        totalSteps: template.steps.length,
      });
      setActiveSession({ id: result.id, template, stepIdx: 0, elapsed: 0, totalElapsed: 0 });
      intervalRef.current = setInterval(() => {
        setActiveSession((prev) => {
          if (!prev) return null;
          const step = prev.template.steps[prev.stepIdx] as MeditationStep | undefined;
          if (!step) return prev;
          const nextElapsed = prev.elapsed + 1;
          const nextTotal = prev.totalElapsed + 1;
          if (nextElapsed >= step.durationSeconds) {
            const nextIdx = prev.stepIdx + 1;
            if (nextIdx >= prev.template.steps.length) {
              if (intervalRef.current) clearInterval(intervalRef.current);
            }
            return { ...prev, stepIdx: nextIdx, elapsed: 0, totalElapsed: nextTotal };
          }
          return { ...prev, elapsed: nextElapsed, totalElapsed: nextTotal };
        });
      }, 1000);
    } catch {
      setError('Failed to start session');
    }
  }, []);

  const endSessionHandler = useCallback(async () => {
    if (!activeSession) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      await endMeditationSession(activeSession.id, {
        stepsCompleted: Math.min(activeSession.stepIdx, activeSession.template.steps.length),
      });
      const sess = await fetchMeditationSessions(10);
      setSessions(sess);
    } catch { /* skip */ }
    setActiveSession(null);
    setSelectedTemplate(null);
  }, [activeSession]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // --- Loading ---
  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  // --- Active session: full-screen focus mode ---
  if (activeSession) {
    const step = activeSession.template.steps[activeSession.stepIdx] as MeditationStep | undefined;
    const totalDur = activeSession.template.durationSeconds;
    const pct = Math.min(100, (activeSession.totalElapsed / totalDur) * 100);
    const remaining = Math.max(0, totalDur - activeSession.totalElapsed);
    const isComplete = activeSession.stepIdx >= activeSession.template.steps.length;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', gap: 24, maxWidth: 600, margin: '0 auto',
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{activeSession.template.name}</h2>

        <div style={{
          width: '100%', padding: 40, borderRadius: 24,
          background: SURFACE, border: `1px solid ${BORDER}`,
          textAlign: 'center', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          {isComplete ? (
            <>
              <p style={{ fontSize: 48, margin: '0 0 16px' }}>{'\uD83E\uDDD8'}</p>
              <p style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>Session Complete</p>
              <p style={{ color: TEXT_SEC, fontSize: 15, margin: 0 }}>Well done. Take a moment before returning.</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 18, margin: '0 0 20px', color: 'var(--text)', lineHeight: 1.5, minHeight: 48 }}>
                {step?.instruction ?? ''}
              </p>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC, margin: '0 0 8px' }}>
                Step {activeSession.stepIdx + 1} of {activeSession.template.steps.length}
              </p>
            </>
          )}

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', margin: '20px 0' }}>
            <div style={{ height: '100%', borderRadius: 3, background: ACCENT, width: `${pct}%`, transition: 'width 1s linear' }} />
          </div>

          <p style={{ fontSize: 13, color: TEXT_SEC, margin: '0 0 20px' }}>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} remaining
          </p>

          <button type="button" onClick={() => void endSessionHandler()} style={{
            padding: '14px 32px', borderRadius: 999, border: 'none',
            background: isComplete ? ACCENT : 'var(--danger)',
            color: isComplete ? '#0A0A0F' : '#fff',
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}>
            {isComplete ? 'Done' : 'End Session'}
          </button>
        </div>
      </div>
    );
  }

  // --- Default: two-panel layout ---
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>Meditate</h1>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            FIND YOUR STILLNESS
          </p>
        </div>
        <div style={{
          padding: '8px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text)' }}>
            {sessions.length} SESSION{sessions.length !== 1 ? 'S' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,69,58,0.12)', color: 'var(--danger)', fontSize: 14 }}>{error}</div>
      )}

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setCategory(c.key)} style={{
              padding: '8px 18px', borderRadius: 20, border: 'none',
              background: active ? ACCENT : 'rgba(255,255,255,0.04)',
              color: active ? '#1a1008' : TEXT_SEC,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer',
            }}>{c.label}</button>
          );
        })}
      </div>

      {/* Two-panel: templates list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: template list */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          {/* Featured card */}
          {featured && category === 'all' && (
            <button
              type="button"
              onClick={() => setSelectedTemplate(featured)}
              style={{
                padding: 0, borderRadius: 20, border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)', overflow: 'hidden',
                cursor: 'pointer', textAlign: 'left', minHeight: 180,
              }}
            >
              <div style={{
                padding: 20, background: 'rgba(255,255,255,0.03)', minHeight: 180,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: ACCENT }}>DAILY FEATURED</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{featured.name}</span>
                  <span style={{ fontSize: 14, color: TEXT_SEC, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {featured.description}
                  </span>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: 24, background: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12,
                }}>
                  <span style={{ fontSize: 18, color: '#1a1008' }}>{'\u25B6'}</span>
                </div>
              </div>
            </button>
          )}

          {/* Template list */}
          {filtered.map((t) => {
            const isSelected = selectedTemplate?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t)}
                style={{
                  padding: '14px 16px', borderRadius: 16,
                  border: `1px solid ${isSelected ? ACCENT_BORDER : BORDER}`,
                  background: isSelected ? ACCENT_DIM : GLASS,
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 24,
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 22 }}>{CAT_EMOJIS[t.category] ?? '\uD83C\uDF3F'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t.name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: TEXT_SEC }}>
                    {formatDuration(t.durationSeconds)} &middot; {t.category.replace(/_/g, ' ').toUpperCase()}
                  </p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: ACCENT }}>START &rsaquo;</span>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: 24, borderRadius: 16, background: GLASS, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>No templates in this category.</p>
            </div>
          )}
        </div>

        {/* Right: selected template detail */}
        <div style={{
          padding: 28, borderRadius: 20,
          background: SURFACE, border: `1px solid ${BORDER}`,
          alignSelf: 'start', position: 'sticky', top: 24,
        }}>
          {selectedTemplate ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 32,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 32 }}>{CAT_EMOJIS[selectedTemplate.category] ?? '\uD83C\uDF3F'}</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{selectedTemplate.name}</h2>
              <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, lineHeight: 1.5 }}>{selectedTemplate.description}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{formatDuration(selectedTemplate.durationSeconds)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'capitalize' }}>{selectedTemplate.difficulty}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC }}>{selectedTemplate.steps.length} steps</span>
              </div>

              {/* Steps preview */}
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>SESSION FLOW</p>
                {selectedTemplate.steps.slice(0, 5).map((step, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 12,
                    background: GLASS, border: `1px solid ${BORDER}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 12, background: ACCENT_DIM,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: ACCENT,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>{step.instruction}</span>
                    </div>
                    <span style={{ fontSize: 12, color: TEXT_SEC }}>{Math.floor(step.durationSeconds / 60)}m</span>
                  </div>
                ))}
                {selectedTemplate.steps.length > 5 && (
                  <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC, textAlign: 'center' }}>
                    +{selectedTemplate.steps.length - 5} more steps
                  </p>
                )}
              </div>

              <button type="button" onClick={() => void startSession(selectedTemplate)} style={{
                marginTop: 8, padding: '14px 0', borderRadius: 999, border: 'none',
                background: `linear-gradient(135deg, ${ACCENT}, #C9894D)`, color: '#0A0A0F',
                fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5,
              }}>Begin Meditation</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: 32, margin: '0 0 12px' }}>{'\uD83E\uDDD8'}</p>
              <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Select a Session</p>
              <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>
                Choose a meditation from the list to see details and begin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Session history table */}
      {sessions.length > 0 && (
        <section>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Session History
          </p>
          <div style={{
            borderRadius: 16, overflow: 'hidden',
            border: `1px solid ${BORDER}`, background: GLASS,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>Name</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>Duration</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>Progress</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 600 }}>{s.templateName}</td>
                    <td style={{ padding: '10px 16px', color: TEXT_SEC }}>{Math.floor(s.durationSeconds / 60)}m</td>
                    <td style={{ padding: '10px 16px', color: TEXT_SEC }}>{s.stepsCompleted}/{s.totalSteps} steps</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: s.completed ? 'rgba(48,209,88,0.12)' : ACCENT_DIM,
                        color: s.completed ? 'var(--success)' : ACCENT,
                      }}>
                        {s.completed ? 'Complete' : 'Partial'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
