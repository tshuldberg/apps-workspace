'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { addBreathingSession, fetchBreathingSessions } from '../actions';
import { BREATHING_PATTERNS, getBreathingCycleSteps, getCyclesForDuration, type BreathingStep } from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';

const PATTERNS = Object.entries(BREATHING_PATTERNS);
const DURATIONS = [120, 240, 360, 600];

export default function BreathingPage() {
  const [patternKey, setPatternKey] = useState(PATTERNS[0]?.[0] ?? 'box');
  const [targetDuration, setTargetDuration] = useState(240);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [sessions, setSessions] = useState<{ id: string; pattern: string; durationSeconds: number; cyclesCompleted: number; completedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIdxRef = useRef(0);
  const stepElapsedRef = useRef(0);
  const cyclesRef = useRef(0);
  const elapsedRef = useRef(0);

  const pattern = BREATHING_PATTERNS[patternKey as keyof typeof BREATHING_PATTERNS];
  const steps: BreathingStep[] = pattern ? getBreathingCycleSteps(patternKey as Parameters<typeof getBreathingCycleSteps>[0]) : [];
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const totalCycles = pattern ? getCyclesForDuration(patternKey as Parameters<typeof getCyclesForDuration>[0], targetDuration) : 4;

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

  const clearTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    clearTimer();
    setRunning(false);
    const finalElapsed = elapsedRef.current;
    const finalCycles = cyclesRef.current;
    if (finalElapsed > 5) {
      try {
        await addBreathingSession({
          pattern: patternKey as Parameters<typeof addBreathingSession>[0]['pattern'],
          durationSeconds: finalElapsed,
          cyclesCompleted: finalCycles,
        });
        const s = await fetchBreathingSessions(10);
        setSessions(s);
      } catch { /* skip */ }
    }
    setElapsed(0);
    setCurrentStepIdx(0);
    setCompletedCycles(0);
    elapsedRef.current = 0;
    stepIdxRef.current = 0;
    stepElapsedRef.current = 0;
    cyclesRef.current = 0;
  }, [patternKey, clearTimer]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = () => {
    setRunning(true);
    setElapsed(0);
    setCurrentStepIdx(0);
    setCompletedCycles(0);
    elapsedRef.current = 0;
    stepIdxRef.current = 0;
    stepElapsedRef.current = 0;
    cyclesRef.current = 0;

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);

      if (elapsedRef.current >= targetDuration) {
        void stopRef.current();
        return;
      }

      const currentSteps = stepsRef.current;
      const step = currentSteps[stepIdxRef.current];
      if (!step) return;

      stepElapsedRef.current += 1;
      if (stepElapsedRef.current >= step.durationSeconds) {
        stepElapsedRef.current = 0;
        const nextIdx = stepIdxRef.current + 1;
        if (nextIdx >= currentSteps.length) {
          stepIdxRef.current = 0;
          cyclesRef.current += 1;
          setCompletedCycles(cyclesRef.current);
          setCurrentStepIdx(0);
        } else {
          stepIdxRef.current = nextIdx;
          setCurrentStepIdx(nextIdx);
        }
      }
    }, 1000);
  };

  useEffect(() => {
    return () => { clearTimer(); };
  }, [clearTimer]);

  const currentStep = steps[currentStepIdx];
  const scale = currentStep?.phase === 'inhale' ? 1.4 : currentStep?.phase === 'hold' ? 1.4 : 1;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Breathing</h1>

      {!running && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            {PATTERNS.map(([key, p]) => (
              <button key={key} onClick={() => setPatternKey(key)} style={{
                padding: '10px 16px', borderRadius: 999, border: `1px solid ${patternKey === key ? ACCENT : BORDER}`,
                background: patternKey === key ? ACCENT : 'transparent', color: patternKey === key ? 'var(--background)' : TEXT_SEC,
                fontWeight: 600, cursor: 'pointer', fontSize: 14,
              }}>{p.name}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DURATIONS.map((d) => (
              <button key={d} onClick={() => setTargetDuration(d)} style={{
                padding: '8px 14px', borderRadius: 8, border: `1px solid ${targetDuration === d ? ACCENT : BORDER}`,
                background: targetDuration === d ? ACCENT : 'transparent', color: targetDuration === d ? 'var(--background)' : TEXT_SEC,
                fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>{Math.floor(d / 60)} min</button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '32px 0' }}>
        <div style={{
          width: 160, height: 160, borderRadius: '50%',
          border: `3px solid ${ACCENT}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${running ? scale : 1})`,
          transition: `transform ${currentStep?.durationSeconds ?? 4}s ease-in-out`,
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT, textTransform: 'capitalize' }}>
            {running && currentStep ? currentStep.phase : 'Ready'}
          </span>
        </div>

        {running && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: TEXT_SEC }}>
              Cycle {completedCycles + 1} of {totalCycles}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / {Math.floor(targetDuration / 60)}:{String(targetDuration % 60).padStart(2, '0')}
            </p>
          </div>
        )}

        <button onClick={running ? () => void stop() : start} style={{
          padding: '14px 32px', borderRadius: 999, border: 'none',
          background: running ? 'var(--danger)' : ACCENT, color: running ? 'var(--text)' : 'var(--background)',
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          {running ? 'Stop' : 'Start Breathing'}
        </button>
      </div>

      {!loading && sessions.length > 0 && !running && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: TEXT_SEC }}>Recent Sessions</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`, background: 'var(--glass)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{s.pattern}</span>
                <span style={{ fontSize: 13, color: TEXT_SEC }}>{Math.floor(s.durationSeconds / 60)}m {s.cyclesCompleted} cycles</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
