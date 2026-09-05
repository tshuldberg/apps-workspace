'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { addBreathingSession, fetchBreathingSessions } from '../actions';
import {
  BREATHING_PATTERNS,
  getBreathingCycleSteps,
  getCyclesForDuration,
  type BreathingPattern,
  type BreathingStep,
} from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

interface ExerciseMeta {
  pattern: BreathingPattern;
  name: string;
  description: string;
  badge?: string;
  durationSeconds: number;
}

const EXERCISES: ExerciseMeta[] = [
  { pattern: 'box', name: 'Box Breathing', description: '4-4-4-4 rhythm for focused calm', badge: 'BALANCE', durationSeconds: 300 },
  { pattern: '478', name: '4-7-8 Breathing', description: 'Natural tranquilizer for the system', badge: 'RELAXATION', durationSeconds: 420 },
  { pattern: 'relaxing', name: 'Relaxing Breath', description: 'Soothe the nervous system instantly', durationSeconds: 180 },
  { pattern: 'energizing', name: 'Energizing Breath', description: 'Bellows breath to boost morning energy', badge: 'WAKE UP', durationSeconds: 120 },
  { pattern: 'sleep', name: 'Sleep Prep', description: 'Gentle pacing for deep restoration', durationSeconds: 600 },
];

const PHASE_LABELS: Record<string, string> = {
  inhale: 'Inhale',
  hold: 'Hold',
  exhale: 'Exhale',
  hold2: 'Hold',
};

type ScreenState = 'browsing' | 'pre-mood' | 'running' | 'post-mood' | 'complete';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function BreathePage() {
  const [screenState, setScreenState] = useState<ScreenState>('browsing');
  const [activeExercise, setActiveExercise] = useState<ExerciseMeta | null>(null);
  const [currentPhase, setCurrentPhase] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [preMood, setPreMood] = useState(5);
  const [postMood, setPostMood] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; pattern: string; durationSeconds: number; cyclesCompleted: number; completedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await fetchBreathingSessions(10);
        if (!cancelled) setSessions(s);
      } catch { /* skip */ }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  const runCycle = useCallback((cycleSteps: BreathingStep[], onComplete: () => void) => {
    let stepIndex = 0;
    const nextStep = () => {
      if (pausedRef.current) {
        timerRef.current = setTimeout(nextStep, 200);
        return;
      }
      if (stepIndex >= cycleSteps.length) {
        onComplete();
        return;
      }
      const step = cycleSteps[stepIndex];
      setCurrentPhase(PHASE_LABELS[step.phase] ?? step.phase);
      setCountdown(step.durationSeconds);

      let remaining = step.durationSeconds;
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        if (pausedRef.current) return;
        remaining--;
        setCountdown(Math.max(0, remaining));
      }, 1000);

      stepIndex++;
      timerRef.current = setTimeout(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        nextStep();
      }, step.durationSeconds * 1000);
    };
    nextStep();
  }, []);

  const finishSession = useCallback(async (pattern: BreathingPattern, cycles: number) => {
    clearTimers();
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (duration > 5) {
      try {
        await addBreathingSession({ pattern, durationSeconds: duration, cyclesCompleted: cycles });
        const s = await fetchBreathingSessions(10);
        setSessions(s);
      } catch { /* skip */ }
    }
    setScreenState('post-mood');
  }, [clearTimers]);

  const startSession = useCallback(() => {
    if (!activeExercise) return;
    const { pattern, durationSeconds } = activeExercise;
    setScreenState('running');
    setCyclesCompleted(0);
    setElapsedSeconds(0);
    setIsPaused(false);
    pausedRef.current = false;
    startTimeRef.current = Date.now();

    elapsedRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);

    const steps = getBreathingCycleSteps(pattern);
    const totalCycles = getCyclesForDuration(pattern, durationSeconds);
    let currentCycle = 0;

    const runNextCycle = () => {
      if (currentCycle >= totalCycles) {
        void finishSession(pattern, currentCycle);
        return;
      }
      runCycle(steps, () => {
        currentCycle++;
        setCyclesCompleted(currentCycle);
        runNextCycle();
      });
    };
    runNextCycle();
  }, [activeExercise, runCycle, finishSession]);

  const stopSession = useCallback(async () => {
    if (!activeExercise) return;
    clearTimers();
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (duration > 5) {
      try {
        await addBreathingSession({
          pattern: activeExercise.pattern,
          durationSeconds: duration,
          cyclesCompleted,
        });
        const s = await fetchBreathingSessions(10);
        setSessions(s);
      } catch { /* skip */ }
    }
    setScreenState('browsing');
    setActiveExercise(null);
  }, [activeExercise, cyclesCompleted, clearTimers]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Compute animation scale based on phase
  const circleScale = currentPhase === 'Inhale' ? 1.4 : currentPhase === 'Exhale' ? 0.7 : 1.1;

  // --- Pre-mood screen ---
  if (screenState === 'pre-mood' && activeExercise) {
    return (
      <div style={{ display: 'grid', gap: 24, maxWidth: 480, margin: '0 auto', padding: '48px 0' }}>
        <div style={{ padding: 32, borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>How do you feel right now?</p>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: TEXT_SEC }}>Rate your current state before breathing</p>
          <MoodSlider value={preMood} onChange={setPreMood} />
          <button type="button" onClick={startSession} style={{
            marginTop: 24, padding: '14px 40px', borderRadius: 999, border: 'none',
            background: `linear-gradient(135deg, ${ACCENT}, #C9894D)`, color: '#0A0A0F',
            fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5,
          }}>Begin Session</button>
        </div>
      </div>
    );
  }

  // --- Active session ---
  if (screenState === 'running' && activeExercise) {
    const totalCycles = getCyclesForDuration(activeExercise.pattern, activeExercise.durationSeconds);

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', gap: 32, position: 'relative',
      }}>
        {/* Close button */}
        <button type="button" onClick={() => void stopSession()} style={{
          position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderRadius: 20,
          background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)',
          fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>&#x2715;</button>

        {isPaused && (
          <p style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
            color: ACCENT,
          }}>PAUSED</p>
        )}

        {/* Breathing circle */}
        <div style={{ position: 'relative', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Glow ring */}
          <div style={{
            position: 'absolute', width: 280, height: 280, borderRadius: '50%',
            border: '1px solid rgba(251,146,60,0.08)',
            transform: `scale(${circleScale})`,
            transition: `transform ${countdown > 0 ? countdown : 4}s ease-in-out`,
            opacity: 0.5,
          }} />
          {/* Outer ring */}
          <div style={{
            position: 'absolute', width: 250, height: 250, borderRadius: '50%',
            border: '2px solid rgba(251,146,60,0.19)',
            transform: `scale(${circleScale})`,
            transition: `transform ${countdown > 0 ? countdown : 4}s ease-in-out`,
          }} />
          {/* Middle ring */}
          <div style={{
            position: 'absolute', width: 220, height: 220, borderRadius: '50%',
            background: 'rgba(251,146,60,0.06)', border: '1.5px solid rgba(251,146,60,0.21)',
            transform: `scale(${circleScale})`,
            transition: `transform ${countdown > 0 ? countdown : 4}s ease-in-out`,
          }} />
          {/* Inner circle */}
          <div style={{
            width: 170, height: 170, borderRadius: '50%',
            background: 'rgba(251,146,60,0.12)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: ACCENT }}>{currentPhase}</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(251,146,60,0.6)' }}>
              {countdown > 0 ? `${countdown} SECOND${countdown !== 1 ? 'S' : ''}` : ''}
            </span>
          </div>
        </div>

        {/* Session info */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>
            {activeExercise.name.toUpperCase()} SESSION
          </p>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>ELAPSED</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{formatElapsed(elapsedSeconds)}</p>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>CYCLES</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{cyclesCompleted}/{totalCycles}</p>
            </div>
          </div>
        </div>

        {/* Playback controls */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <button type="button" onClick={togglePause} style={{
            width: 64, height: 64, borderRadius: 32, border: 'none',
            background: ACCENT, color: '#1a1008', fontSize: 24, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {isPaused ? '\u25B6' : '\u23F8'}
          </button>
        </div>
      </div>
    );
  }

  // --- Post-mood screen ---
  if (screenState === 'post-mood') {
    return (
      <div style={{ display: 'grid', gap: 24, maxWidth: 480, margin: '0 auto', padding: '48px 0' }}>
        <div style={{ padding: 32, borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>How do you feel now?</p>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: TEXT_SEC }}>Rate your state after the session</p>
          <MoodSlider value={postMood} onChange={setPostMood} />
          <button type="button" onClick={() => setScreenState('complete')} style={{
            marginTop: 24, padding: '14px 40px', borderRadius: 999, border: 'none',
            background: `linear-gradient(135deg, ${ACCENT}, #C9894D)`, color: '#0A0A0F',
            fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5,
          }}>See Results</button>
        </div>
      </div>
    );
  }

  // --- Completion summary ---
  if (screenState === 'complete') {
    const diff = postMood - preMood;
    const improved = diff > 0;
    const same = diff === 0;
    return (
      <div style={{ display: 'grid', gap: 24, maxWidth: 480, margin: '0 auto', padding: '48px 0' }}>
        <div style={{ padding: 36, borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Session Complete</p>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: ACCENT }}>
            {improved ? 'Well done! Your mood improved.' : same ? 'Steady state maintained.' : 'Take it easy, you\'ve got this.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, margin: '0 0 20px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>BEFORE</p>
              <p style={{ margin: '8px 0 0', fontSize: 48, fontWeight: 800, color: preMood >= 7 ? 'var(--success)' : preMood >= 4 ? ACCENT : 'var(--danger)' }}>{preMood}</p>
            </div>
            <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)', paddingTop: 16 }}>{'\u2192'}</span>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_SEC }}>AFTER</p>
              <p style={{ margin: '8px 0 0', fontSize: 48, fontWeight: 800, color: postMood >= 7 ? 'var(--success)' : postMood >= 4 ? ACCENT : 'var(--danger)' }}>{postMood}</p>
            </div>
          </div>
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 999,
            background: improved ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: improved ? 'var(--success)' : TEXT_SEC }}>
              {improved ? `+${diff} points` : same ? 'No change' : `${diff} points`}
            </span>
          </div>
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={() => {
              setScreenState('browsing');
              setActiveExercise(null);
              setPreMood(5);
              setPostMood(5);
              setElapsedSeconds(0);
            }} style={{
              padding: '14px 40px', borderRadius: 999, border: 'none',
              background: `linear-gradient(135deg, ${ACCENT}, #C9894D)`, color: '#0A0A0F',
              fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5,
            }}>Save & Close</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Default: exercise browser ---
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>Breathing Sanctuary</h1>
        <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, maxWidth: 520 }}>
          Regulate your nervous system through intentional rhythm. Choose a pattern that fits your current state.
        </p>
      </div>

      {/* Exercise cards in horizontal row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {EXERCISES.map((ex) => (
          <div key={ex.pattern} style={{
            padding: 20, borderRadius: 20,
            background: SURFACE, border: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{ex.name}</span>
              {ex.badge && (
                <span style={{
                  padding: '3px 10px', borderRadius: 999,
                  background: ACCENT_DIM, fontSize: 9, fontWeight: 700,
                  letterSpacing: 0.5, color: ACCENT,
                }}>{ex.badge}</span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.4 }}>{ex.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: ACCENT }}>{'\u23F0'}</span>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, color: ACCENT }}>{formatDuration(ex.durationSeconds)}</span>
            </div>
            <button type="button" onClick={() => {
              setActiveExercise(ex);
              setScreenState('pre-mood');
            }} style={{
              marginTop: 'auto', padding: '10px 22px', borderRadius: 999, border: 'none',
              background: ACCENT, color: '#1a1008', fontWeight: 600, fontSize: 15,
              cursor: 'pointer', alignSelf: 'flex-start',
            }}>Start</button>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      {!loading && sessions.length > 0 && (
        <section>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Recent Sessions
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {sessions.map((s) => (
              <div key={s.id} style={{
                padding: '12px 16px', borderRadius: 14, border: `1px solid ${BORDER}`,
                background: GLASS, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{s.pattern.replace(/_/g, ' ')}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: TEXT_SEC }}>{Math.floor(s.durationSeconds / 60)}m</span>
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>{s.cyclesCompleted} cycles</span>
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
