'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { computeTimerState, formatDuration, type ActiveFast } from '@mylife/fast';
import {
  fetchActiveFast,
  doStartFast,
  doEndFast,
  fetchProtocols,
  fetchStreaks,
} from './actions';

type Protocol = {
  id: string;
  name: string;
  fasting_hours: number;
  eating_hours: number;
  description: string | null;
};

type Streaks = {
  currentStreak: number;
  longestStreak: number;
  totalFasts: number;
};

const ACCENT = 'var(--accent-fast)';

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: 20,
};

const STAT_CARD: CSSProperties = {
  ...GLASS_CARD,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const SKELETON_PULSE: CSSProperties = {
  background: 'var(--glass-strong)',
  borderRadius: 'var(--radius-xl)',
  animation: 'pulse 1.5s ease-in-out infinite',
};

function SkeletonLoader() {
  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900 }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      <div style={{ ...SKELETON_PULSE, height: 28, width: 120, marginBottom: 8 }} />
      <div style={{ ...SKELETON_PULSE, height: 14, width: 280, marginBottom: 24 }} />
      <div style={{ ...SKELETON_PULSE, height: 200, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)' }}>
        <div style={{ ...SKELETON_PULSE, height: 80 }} />
        <div style={{ ...SKELETON_PULSE, height: 80 }} />
        <div style={{ ...SKELETON_PULSE, height: 80 }} />
      </div>
    </div>
  );
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function FastPage() {
  const [loading, setLoading] = useState(true);
  const [activeFast, setActiveFast] = useState<ActiveFast | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [streaks, setStreaks] = useState<Streaks>({ currentStreak: 0, longestStreak: 0, totalFasts: 0 });
  const [selectedProtocol, setSelectedProtocol] = useState<string>('');
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerState = computeTimerState(activeFast, now);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fast, protos, streakData] = await Promise.all([
        fetchActiveFast(),
        fetchProtocols(),
        fetchStreaks(),
      ]);
      setActiveFast(fast as ActiveFast | null);
      const protoList = protos as Protocol[];
      setProtocols(protoList);
      setStreaks(streakData as Streaks);
      setSelectedProtocol((prev) => prev || protoList[0]?.id || '');
    } catch (err) {
      console.error('Failed to load fasting data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeFast) {
      intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeFast]);

  async function handleStart() {
    const proto = protocols.find((p) => p.id === selectedProtocol);
    if (!proto) return;
    try {
      const id = generateId();
      await doStartFast(id, proto.id, proto.fasting_hours);
      await load();
    } catch (err) {
      console.error('Failed to start fast:', err);
    }
  }

  async function handleEnd() {
    try {
      await doEndFast();
      await load();
    } catch (err) {
      console.error('Failed to end fast:', err);
    }
  }

  if (loading) {
    return <SkeletonLoader />;
  }

  const isActive = timerState.state === 'fasting';
  const progressPct = isActive ? Math.min(100, Math.round(timerState.progress * 100)) : 0;

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 900 }}>
      {/* Header */}
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: ACCENT }}>
        MyFast
      </h1>
      <p style={{ margin: '4px 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Intermittent fasting tracker with protocols and streaks
      </p>

      {/* Timer / Start section */}
      <div style={{ ...GLASS_CARD, marginBottom: 20, textAlign: 'center', padding: 'var(--space-xl)' }}>
        {isActive ? (
          <>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: ACCENT, textTransform: 'uppercase' }}>
              Fasting in progress
            </p>
            <p style={{ margin: '12px 0', fontSize: 48, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(timerState.elapsed)}
            </p>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 8,
              borderRadius: 4,
              background: 'var(--glass-strong)',
              overflow: 'hidden',
              margin: '0 0 16px',
            }}>
              <div style={{
                height: '100%',
                borderRadius: 4,
                width: `${progressPct}%`,
                background: timerState.targetReached ? 'var(--success)' : ACCENT,
                transition: 'width 1s linear',
              }} />
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {timerState.targetReached
                ? 'Target reached'
                : `${formatDuration(timerState.remaining)} remaining`}
            </p>

            <button
              type="button"
              onClick={handleEnd}
              style={{
                padding: '12px 32px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              End Fast
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              Ready to fast
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {protocols.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProtocol(p.id)}
                  aria-pressed={selectedProtocol === p.id}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${selectedProtocol === p.id ? 'var(--accent-fast)' : 'var(--border)'}`,
                    background: selectedProtocol === p.id ? 'var(--glass-strong)' : 'var(--glass)',
                    color: selectedProtocol === p.id ? 'var(--accent-fast)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: selectedProtocol === p.id ? 700 : 400,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleStart}
              style={{
                padding: '14px 40px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: ACCENT,
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Start Fast
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-lg)' }}>
        <div style={STAT_CARD}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Current Streak
          </span>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
            {streaks.currentStreak}
          </span>
        </div>
        <div style={STAT_CARD}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Longest Streak
          </span>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
            {streaks.longestStreak}
          </span>
        </div>
        <div style={STAT_CARD}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Total Fasts
          </span>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
            {streaks.totalFasts}
          </span>
        </div>
      </div>
    </div>
  );
}
