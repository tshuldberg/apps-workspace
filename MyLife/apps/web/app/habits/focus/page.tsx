'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  advancePhase,
  createPomodoroState,
  formatTimerDisplay,
  getRemainingMs,
  isPhaseComplete,
  pauseTimer,
  resumeTimer,
  skipPhase,
  stopSession as stopPomodoroSession,
  type PomodoroConfig,
  type PomodoroState,
} from '@mylife/habits';
import { doCompleteFocusSession, doCreateFocusSession, fetchAllFocusSessions } from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SectionHeading,
  SymbolIcon,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type FocusSession = {
  id: string;
  roundsCompleted: number;
  totalFocusSeconds: number;
  totalBreakSeconds: number;
  startedAt: string;
  status: string;
};

type FocusControl = {
  label: string;
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
};

export default function HabitsFocusPage() {
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [rounds, setRounds] = useState(4);
  const [taskLabel, setTaskLabel] = useState('');
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [timerState, setTimerState] = useState<PomodoroState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configRef = useRef<PomodoroConfig | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const loadSessions = async () => {
    try {
      setError(null);
      setSessions(((await fetchAllFocusSessions()) as FocusSession[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load focus sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!timerState || !configRef.current || timerState.phase === 'completed') {
      return;
    }

    const interval = window.setInterval(() => {
      setTimerState((current) => {
        if (!current || !configRef.current || current.phase === 'completed') {
          return current;
        }

        const now = Date.now();
        if (isPhaseComplete(current, now)) {
          return advancePhase(current, configRef.current, now);
        }

        return current;
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, [timerState]);

  useEffect(() => {
    if (!timerState || timerState.phase !== 'completed' || !sessionIdRef.current) {
      return;
    }

    void doCompleteFocusSession(
      sessionIdRef.current,
      timerState.round,
      Math.round(timerState.totalFocusMs / 1000),
      Math.round(timerState.totalBreakMs / 1000),
      'completed',
    ).then(loadSessions);
  }, [timerState]);

  const display = timerState ? formatTimerDisplay(getRemainingMs(timerState, Date.now())) : formatTimerDisplay(workMinutes * 60 * 1000);
  const progress = timerState
    ? ((timerState.phaseDuration - getRemainingMs(timerState, Date.now())) / Math.max(timerState.phaseDuration, 1)) * 100
    : 0;
  const totalFocusHours = useMemo(() => sessions.reduce((sum, session) => sum + session.totalFocusSeconds / 3600, 0), [sessions]);
  const avgRounds = useMemo(() => sessions.length === 0 ? 0 : Math.round(sessions.reduce((sum, session) => sum + session.roundsCompleted, 0) / sessions.length), [sessions]);

  const startSession = async () => {
    const config: PomodoroConfig = {
      workDuration: workMinutes * 60 * 1000,
      breakDuration: breakMinutes * 60 * 1000,
      longBreakDuration: longBreakMinutes * 60 * 1000,
      rounds,
    };
    configRef.current = config;
    sessionIdRef.current = crypto.randomUUID();
    setTimerState(createPomodoroState(config, Date.now()));
    await doCreateFocusSession(sessionIdRef.current, {
      habitId: '',
      workDuration: workMinutes * 60,
      breakDuration: breakMinutes * 60,
      roundsTarget: rounds,
    });
  };

  const controls: FocusControl[] = [
    { label: 'Work', value: workMinutes, setValue: setWorkMinutes },
    { label: 'Break', value: breakMinutes, setValue: setBreakMinutes },
    { label: 'Long', value: longBreakMinutes, setValue: setLongBreakMinutes },
    { label: 'Rounds', value: rounds, setValue: setRounds },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Focus"
        title="Deep-work timer with recent output right beside it."
        description="Start a work block, keep the task label in view, and use the analytics rail to see how often you actually finish the number of rounds you planned."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 26, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Preset lengths and live timer." title="Timer" />
          <input
            value={taskLabel}
            onChange={(event) => setTaskLabel(event.target.value)}
            placeholder="What are you focusing on?"
            style={{ borderRadius: 18, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '15px 16px' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {controls.map(({ label, value, setValue }) => (
              <div key={label} style={{ padding: 14, borderRadius: 20, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 10 }}>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setValue(Math.max(1, value - 1))} style={{ flex: 1, border: 'none', borderRadius: 14, background: withAlpha('#ffffff', 0.05), color: 'white', padding: 8, cursor: 'pointer' }}>-</button>
                  <button onClick={() => setValue(value + 1)} style={{ flex: 1, border: 'none', borderRadius: 14, background: withAlpha('#ffffff', 0.05), color: 'white', padding: 8, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 28, borderRadius: 28, background: `linear-gradient(135deg, ${withAlpha(HB_ACCENT_LIGHT, 0.18)} 0%, ${withAlpha(HB_STREAK.fire, 0.12)} 100%)`, display: 'grid', gap: 16, textAlign: 'center' }}>
            <div style={{ color: HB_TEXT_SECONDARY, letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 11 }}>
              {timerState ? timerState.phase.replace('_', ' ') : 'ready'}
            </div>
            <div style={{ fontSize: 82, lineHeight: 1, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{display}</div>
            <ProgressBar tone={timerState?.phase === 'work' ? HB_ACCENT_LIGHT : HB_STREAK.fire} value={Math.max(0, Math.min(100, progress))} />
            <div style={{ color: HB_TEXT_SECONDARY }}>Round {timerState?.round ?? 0} / {timerState?.roundsTarget ?? rounds}</div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {!timerState ? (
              <PrimaryButton onClick={() => void startSession()}>
                <SymbolIcon color="#0E0E13" filled name="play_arrow" size={18} />
                Start timer
              </PrimaryButton>
            ) : (
              <>
                <SecondaryButton onClick={() => setTimerState((current) => current ? (current.isPaused ? resumeTimer(current, Date.now()) : pauseTimer(current, Date.now())) : current)}>
                  <SymbolIcon name={timerState.isPaused ? 'play_arrow' : 'pause'} size={18} />
                  {timerState.isPaused ? 'Resume' : 'Pause'}
                </SecondaryButton>
                <SecondaryButton onClick={() => setTimerState((current) => current && configRef.current ? skipPhase(current, configRef.current, Date.now()) : current)}>
                  <SymbolIcon name="skip_next" size={18} />
                  Skip
                </SecondaryButton>
                <SecondaryButton onClick={() => setTimerState((current) => current ? stopPomodoroSession(current, Date.now()) : current)}>
                  <SymbolIcon name="stop" size={18} />
                  Stop
                </SecondaryButton>
              </>
            )}
          </div>
        </GlassPanel>

        <div style={{ display: 'grid', gap: 20 }}>
          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 14 }}>
            <SectionHeading detail="Aggregate focus output." title="Analytics" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ padding: 16, borderRadius: 20, background: withAlpha(HB_ACCENT_LIGHT, 0.14) }}>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Sessions</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{sessions.length}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 20, background: withAlpha('#8BCFF0', 0.14) }}>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Avg rounds</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{avgRounds}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 20, background: withAlpha(HB_STREAK.fire, 0.14) }}>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Focused hours</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{totalFocusHours.toFixed(1)}</div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 14 }}>
            <SectionHeading detail="Recent completed or abandoned sessions." title="Session history" />
            {loading ? (
              <div style={{ height: 120, borderRadius: 20, background: withAlpha('#ffffff', 0.04) }} />
            ) : sessions.length === 0 ? (
              <EmptyState body="Run a timer to start building a focus history." title="No focus sessions yet" />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {sessions.slice(0, 6).map((session) => (
                  <div key={session.id} style={{ padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>{session.status === 'completed' ? 'Completed session' : 'Stopped early'}</div>
                      <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{session.startedAt.slice(0, 10)}</div>
                    </div>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>
                      {session.roundsCompleted} rounds · {Math.round(session.totalFocusSeconds / 60)} focus min · {Math.round(session.totalBreakSeconds / 60)} break min
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error ? <div style={{ color: '#FFB4AB', fontSize: 13 }}>{error}</div> : null}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
