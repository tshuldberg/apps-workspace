'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchMeditationTemplates, addMeditationSession, endMeditationSession, fetchMeditationSessions } from '../actions';
import type { MeditationTemplate, MeditationSession, MeditationStep } from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';

const CATEGORIES = ['all', 'beginner', 'body_scan', 'visualization', 'mindfulness', 'sleep'] as const;
const CAT_LABELS: Record<string, string> = {
  all: 'All', beginner: 'Beginner', body_scan: 'Body Scan',
  visualization: 'Visualization', mindfulness: 'Mindfulness', sleep: 'Sleep',
};

export default function MeditationPage() {
  const [templates, setTemplates] = useState<MeditationTemplate[]>([]);
  const [sessions, setSessions] = useState<MeditationSession[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSession, setActiveSession] = useState<{ id: string; template: MeditationTemplate; stepIdx: number; elapsed: number; totalElapsed: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tmpl, sess] = await Promise.all([fetchMeditationTemplates(), fetchMeditationSessions(10)]);
        if (!cancelled) { setTemplates(tmpl); setSessions(sess); }
      } catch { if (!cancelled) setError('Failed to load'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

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
              return { ...prev, stepIdx: nextIdx, elapsed: 0, totalElapsed: nextTotal };
            }
            return { ...prev, stepIdx: nextIdx, elapsed: 0, totalElapsed: nextTotal };
          }
          return { ...prev, elapsed: nextElapsed, totalElapsed: nextTotal };
        });
      }, 1000);
    } catch { setError('Failed to start session'); }
  }, []);

  const endSession = useCallback(async () => {
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
  }, [activeSession]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const filtered = category === 'all' ? templates : templates.filter((t) => t.category === category);
  const isComplete = activeSession && activeSession.stepIdx >= activeSession.template.steps.length;

  if (loading) return <div style={{ display: 'grid', gap: 12 }}>{[1,2,3,4].map((i) => <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}</div>;

  if (activeSession) {
    const step = activeSession.template.steps[activeSession.stepIdx] as MeditationStep | undefined;
    const totalDur = activeSession.template.durationSeconds;
    const pct = Math.min(100, (activeSession.totalElapsed / totalDur) * 100);
    const remaining = Math.max(0, totalDur - activeSession.totalElapsed);

    return (
      <div style={{ display: 'grid', gap: 24, maxWidth: 600, margin: '0 auto', padding: '32px 0' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, textAlign: 'center' }}>{activeSession.template.name}</h2>
        <div style={{ padding: 32, borderRadius: 16, border: `1px solid ${BORDER}`, background: 'var(--glass)', textAlign: 'center' }}>
          {isComplete ? (
            <>
              <p style={{ fontSize: 48, margin: '0 0 12px' }}>🧘</p>
              <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Session Complete</p>
              <p style={{ color: TEXT_SEC, fontSize: 14, margin: 0 }}>Well done. Take a moment before returning.</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 16, margin: '0 0 16px', minHeight: 48 }}>{step?.instruction ?? ''}</p>
              <p style={{ fontSize: 13, color: TEXT_SEC, margin: '0 0 8px' }}>
                Step {activeSession.stepIdx + 1} of {activeSession.template.steps.length}
              </p>
            </>
          )}
          <div style={{ height: 6, borderRadius: 3, background: 'var(--glass-strong)', overflow: 'hidden', margin: '16px 0' }}>
            <div style={{ height: '100%', borderRadius: 3, background: ACCENT, width: `${pct}%`, transition: 'width 1s linear' }} />
          </div>
          <p style={{ fontSize: 13, color: TEXT_SEC, margin: '0 0 16px' }}>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} remaining
          </p>
          <button onClick={() => void endSession()} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: isComplete ? ACCENT : 'var(--danger)', color: isComplete ? 'var(--background)' : '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isComplete ? 'Done' : 'End Session'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Meditation</h1>

      {error && <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,69,58,0.15)', color: 'var(--danger)', fontSize: 14 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} style={{
            padding: '8px 14px', borderRadius: 999, border: `1px solid ${category === c ? ACCENT : BORDER}`,
            background: category === c ? ACCENT : 'transparent', color: category === c ? '#0A0A0F' : TEXT_SEC,
            fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>{CAT_LABELS[c]}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {filtered.map((t) => (
          <button key={t.id} onClick={() => void startSession(t)} style={{
            padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`, background: 'var(--glass)',
            cursor: 'pointer', textAlign: 'left', display: 'grid', gap: 8,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
            <span style={{ fontSize: 13, color: TEXT_SEC, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>{Math.floor(t.durationSeconds / 60)} min</span>
              <span style={{ fontSize: 12, color: TEXT_SEC, textTransform: 'capitalize' }}>{t.difficulty}</span>
            </div>
          </button>
        ))}
      </div>

      {sessions.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: TEXT_SEC }}>Recent Sessions</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`, background: 'var(--glass)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14 }}>{s.templateName}</span>
                <span style={{ fontSize: 13, color: TEXT_SEC }}>{Math.floor(s.durationSeconds / 60)}m {s.completed ? '✓' : `${s.stepsCompleted}/${s.totalSteps}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
