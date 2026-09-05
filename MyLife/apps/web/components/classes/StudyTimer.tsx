'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createPomodoroInitialState,
  getPomodoroProgress,
  pausePomodoro,
  pomodoroSettingsFromUserSettings,
  resetPomodoro,
  skipPomodoro,
  startPomodoro,
  tickPomodoro,
  type ClassesSettings,
  type PomodoroPhase,
  type PomodoroState,
} from '@mylife/classes';
import { logStudySessionAction } from '../../app/classes/actions';

const ACCENT = 'var(--accent-classes)';
const ACCENT_DIM = 'var(--accent-classes-dim)';
const ACCENT_BORDER = 'var(--accent-classes-border)';
const TEXT = 'var(--text)';
const TEXT_SECONDARY = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const SURFACE_ELEVATED = 'var(--surface-elevated)';

export interface StudyTimerClassOption {
  id: string;
  name: string;
  color: string | null;
}

export interface StudyTimerProps {
  settings: Pick<ClassesSettings, 'defaultStudyMinutes' | 'focusBreakMinutes'>;
  classes: StudyTimerClassOption[];
}

function format(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function phaseLabel(phase: PomodoroPhase): string {
  switch (phase) {
    case 'work':
      return 'Focus';
    case 'short_break':
      return 'Short break';
    case 'long_break':
      return 'Long break';
    case 'idle':
      return 'Idle';
  }
}

export function StudyTimer({ settings, classes }: StudyTimerProps) {
  const pomSettings = useMemo(
    () => pomodoroSettingsFromUserSettings(settings),
    [settings.defaultStudyMinutes, settings.focusBreakMinutes],
  );
  const [state, setState] = useState<PomodoroState>(() =>
    createPomodoroInitialState(pomSettings),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [classId, setClassId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const lastPhaseRef = useRef<PomodoroPhase>('idle');
  const classIdRef = useRef<string | null>(null);

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  // Re-seed from settings when idle.
  useEffect(() => {
    setState((prev) =>
      prev.phase === 'idle'
        ? createPomodoroInitialState(pomSettings)
        : { ...prev, settings: pomSettings },
    );
  }, [pomSettings]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setState((prev) => {
        const next = tickPomodoro(prev, 1);
        if (
          lastPhaseRef.current === 'work' &&
          next.phase !== 'work' &&
          next.phase !== 'idle'
        ) {
          const startedAt = new Date(
            Date.now() - prev.settings.workMinutes * 60 * 1000,
          ).toISOString();
          const cid = classIdRef.current;
          const targetClassName = cid
            ? classes.find((c) => c.id === cid)?.name ?? 'Unattached'
            : 'Unattached';
          void logStudySessionAction({
            class_id: cid,
            started_at: startedAt,
            duration_minutes: prev.settings.workMinutes,
            timer_type: 'pomodoro',
            pomodoro_count: next.totalPomodoros,
          }).then((res) => {
            if (res.ok) {
              setBanner(
                `Logged ${prev.settings.workMinutes} min of ${targetClassName}`,
              );
            } else {
              setBanner(`Log failed: ${res.error}`);
            }
          });
        }
        lastPhaseRef.current = next.phase;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, classes]);

  const onStart = useCallback(() => {
    setState((prev) => {
      const next = prev.phase === 'idle' ? startPomodoro(prev) : prev;
      lastPhaseRef.current = next.phase;
      return next;
    });
    setIsRunning(true);
  }, []);
  const onPause = useCallback(() => {
    setState((prev) => pausePomodoro(prev));
    setIsRunning(false);
  }, []);
  const onSkip = useCallback(() => {
    setState((prev) => {
      const next = skipPomodoro(prev);
      lastPhaseRef.current = next.phase;
      return next;
    });
  }, []);
  const onReset = useCallback(() => {
    setState((prev) => resetPomodoro(prev));
    lastPhaseRef.current = 'idle';
    setIsRunning(false);
  }, []);

  const progress = getPomodoroProgress(state);
  const percent = Math.max(0, Math.min(100, progress.percent));

  return (
    <section
      style={{
        borderRadius: 24,
        border: `1px solid ${ACCENT_BORDER}`,
        background: `linear-gradient(135deg, ${ACCENT_DIM}, rgba(19,24,36,0.82))`,
        padding: 24,
        display: 'grid',
        gap: 16,
      }}
    >
      {banner ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(19,24,36,0.65)',
            border: `1px solid ${ACCENT_BORDER}`,
            color: TEXT,
            fontSize: 13,
          }}
        >
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: ACCENT,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 12,
              letterSpacing: 0.4,
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {classes.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <ChipButton
            active={classId === null}
            onClick={() => setClassId(null)}
            label="Unattached"
          />
          {classes.map((c) => (
            <ChipButton
              key={c.id}
              active={classId === c.id}
              onClick={() => setClassId(c.id)}
              label={c.name}
              dotColor={c.color ?? ACCENT}
            />
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(19,24,36,0.65)',
            color: ACCENT,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          {phaseLabel(state.phase)}
        </span>
        <span style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: 600 }}>
          {state.totalPomodoros} pom
        </span>
      </div>

      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: TEXT,
          textAlign: 'center',
          letterSpacing: -2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {format(progress.remainingSeconds)}
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'rgba(19,24,36,0.65)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: ACCENT,
            transition: 'width 0.5s linear',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {isRunning ? (
          <PrimaryButton onClick={onPause}>Pause</PrimaryButton>
        ) : (
          <PrimaryButton onClick={onStart}>
            {state.phase === 'idle' ? 'Start' : 'Resume'}
          </PrimaryButton>
        )}
        <SecondaryButton onClick={onSkip} disabled={state.phase === 'idle'}>
          Skip
        </SecondaryButton>
        <SecondaryButton onClick={onReset} disabled={state.phase === 'idle'}>
          Reset
        </SecondaryButton>
      </div>
    </section>
  );
}

function ChipButton({
  active,
  onClick,
  label,
  dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? ACCENT_BORDER : BORDER}`,
        background: active ? ACCENT_DIM : SURFACE_ELEVATED,
        color: active ? ACCENT : TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {dotColor ? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: dotColor,
          }}
        />
      ) : null}
      {label}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 999,
        border: 'none',
        background: ACCENT,
        color: 'var(--background)',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 999,
        border: `1px solid ${BORDER}`,
        background: 'rgba(19,24,36,0.74)',
        color: disabled ? 'var(--text-tertiary)' : TEXT,
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
