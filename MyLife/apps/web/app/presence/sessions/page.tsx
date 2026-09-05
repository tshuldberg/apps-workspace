'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  MaterialSymbol,
  SESSION_TYPE_COLORS,
  TOKENS,
  chipStyle,
  computeSessionStreak,
  formatDateTime,
  formatMinutes,
  gradientButtonStyle,
} from '../ui';
import {
  doAbandonSession,
  doCompleteSession,
  doCreateSession,
  doDeleteSession,
  fetchPresenceSessionsSnapshot,
} from '../actions';

type SessionType = 'solo' | 'group' | 'beast';
type QuickFilter = 'all' | 'solo' | 'group' | 'beast' | 'completed' | 'active';
type SortMode = 'date' | 'duration';

interface SessionSnapshot {
  sessions: Array<{
    id: string;
    start_time: string;
    end_time: string | null;
    planned_minutes: number;
    actual_minutes: number | null;
    completed: number;
    type: string;
    rating: number | null;
  }>;
  weeklySessionsCount: number;
  weeklyMinutes: number;
  weeklyCompletionRate: number;
  trendData: Array<{ date: string; label: string; value: number }>;
}

const DURATION_OPTIONS = [15, 25, 45, 60, 90];

export default function SessionsPage() {
  const [data, setData] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState<SessionType>('solo');
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date');

  async function loadData() {
    try {
      setError(null);
      setData((await fetchPresenceSessionsSnapshot()) as SessionSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    return [...data.sessions]
      .filter((session) => {
        if (quickFilter === 'completed') return session.completed === 1;
        if (quickFilter === 'active') return session.end_time == null;
        if (quickFilter === 'all') return true;
        return session.type === quickFilter;
      })
      .sort((left, right) => {
        if (sortMode === 'duration') {
          return (right.actual_minutes ?? right.planned_minutes) - (left.actual_minutes ?? left.planned_minutes);
        }
        return right.start_time.localeCompare(left.start_time);
      });
  }, [data, quickFilter, sortMode]);

  async function handleCreate() {
    try {
      setCreating(true);
      await doCreateSession({ planned_minutes: selectedDuration, type: selectedType });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the session.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="pr-card-stack">
        <PresenceCard style={{ minHeight: 180 }} />
        <PresenceCard style={{ minHeight: 220 }} />
      </div>
    );
  }

  if (error || data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Sessions unavailable"
        body={error ?? 'We could not load your focus history.'}
      />
    );
  }

  const currentStreak = computeSessionStreak(data.sessions);
  const activeSessions = data.sessions.filter((session) => session.end_time == null);
  const completedSessions = data.sessions.filter((session) => session.completed === 1);

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Focus Sessions"
          subtitle="Weekly momentum, quick-start controls, and the full record of completed and interrupted sessions."
        />
        <div className="pr-grid-4" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="This Week" value={`${data.weeklySessionsCount}`} tone={TOKENS.accentLight} detail="sessions started" />
          <PresenceMetricCard label="Focus Time" value={formatMinutes(data.weeklyMinutes)} tone={TOKENS.info} detail="completed minutes" />
          <PresenceMetricCard label="Completion" value={`${data.weeklyCompletionRate}%`} tone={TOKENS.success} detail="of weekly attempts" />
          <PresenceMetricCard label="Streak" value={`${currentStreak}`} tone={TOKENS.warning} detail="days with completed sessions" />
        </div>
      </PresenceCard>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading title="Weekly Summary" subtitle="A seven-day overview of how much focused time you actually protected." />
          <div style={{ display: 'flex', alignItems: 'end', gap: 10, minHeight: 180, marginTop: 18 }}>
            {data.trendData.map((item) => (
              <div key={item.date} style={{ flex: 1, display: 'grid', gap: 10 }}>
                <div
                  style={{
                    height: `${Math.max(14, (item.value / Math.max(...data.trendData.map((entry) => entry.value), 1)) * 150)}px`,
                    borderRadius: 18,
                    background: 'linear-gradient(180deg, rgba(34,211,238,0.96), rgba(8,145,178,0.75))',
                    boxShadow: '0 12px 28px rgba(8,145,178,0.14)',
                  }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: TOKENS.textTertiary, fontSize: 11 }}>{formatMinutes(item.value)}</div>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading title="Start Session" subtitle="Pick a mode, choose a duration, and launch a new focus block." />

          <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
            <div>
              <div style={sectionLabelStyle}>Mode</div>
              <div className="pr-chip-row" style={{ marginTop: 10 }}>
                {(['solo', 'group', 'beast'] as SessionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    style={chipStyle(selectedType === type, SESSION_TYPE_COLORS[type])}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={sectionLabelStyle}>Duration</div>
              <div className="pr-chip-row" style={{ marginTop: 10 }}>
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setSelectedDuration(minutes)}
                    style={chipStyle(selectedDuration === minutes)}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => void handleCreate()} style={gradientButtonStyle} disabled={creating}>
              {creating ? 'Starting…' : `Start ${selectedType} session`}
            </button>
          </div>
        </PresenceCard>
      </div>

      <PresenceCard>
        <PresenceSectionHeading
          title="Session History"
          subtitle="Filter by mode or state and review the sessions that shaped this week."
          action={(
            <div className="pr-chip-row">
              {(['all', 'solo', 'group', 'beast', 'completed', 'active'] as QuickFilter[]).map((filter) => (
                <button key={filter} type="button" onClick={() => setQuickFilter(filter)} style={chipStyle(quickFilter === filter)}>
                  {filter}
                </button>
              ))}
              <button type="button" onClick={() => setSortMode(sortMode === 'date' ? 'duration' : 'date')} style={chipStyle(false)}>
                Sort: {sortMode}
              </button>
            </div>
          )}
        />

        {filteredSessions.length === 0 ? (
          <div style={{ marginTop: 18 }}>
            <PresenceEmptyState
              icon="timer_off"
              title="No sessions match this filter"
              body="Try a different filter or start a new focus block."
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                style={{
                  padding: 18,
                  borderRadius: 24,
                  border: `1.5px solid ${TOKENS.border}`,
                  background: 'rgba(255,255,255,0.04)',
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MaterialSymbol
                        name={session.type === 'beast' ? 'local_fire_department' : session.type === 'group' ? 'groups' : 'person'}
                        size={18}
                        color={SESSION_TYPE_COLORS[session.type] ?? TOKENS.accentLight}
                      />
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{session.type}</span>
                      <span style={{ color: session.completed === 1 ? TOKENS.success : session.end_time == null ? TOKENS.warning : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        {session.completed === 1 ? 'Completed' : session.end_time == null ? 'Active' : 'Abandoned'}
                      </span>
                    </div>
                    <div style={{ color: TOKENS.textSecondary, fontSize: 13, marginTop: 8 }}>
                      {formatDateTime(session.start_time)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMinutes(session.actual_minutes ?? session.planned_minutes)}</div>
                    <div style={{ color: TOKENS.textTertiary, fontSize: 12 }}>planned {formatMinutes(session.planned_minutes)}</div>
                  </div>
                </div>

                <div className="pr-chip-row">
                  {session.end_time == null ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void doCompleteSession(session.id, session.planned_minutes).then(loadData)}
                        style={gradientButtonStyle}
                      >
                        Mark complete
                      </button>
                      <button
                        type="button"
                        onClick={() => void doAbandonSession(session.id, Math.max(5, Math.floor(session.planned_minutes / 2))).then(loadData)}
                        style={{ ...gradientButtonStyle, background: 'linear-gradient(135deg, #FFB877, #EF4444)', color: '#1a0905' }}
                      >
                        Abandon
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void doDeleteSession(session.id).then(loadData)}
                    style={{ ...chipStyle(false), color: TOKENS.danger }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PresenceCard>

      {activeSessions.length > 0 || completedSessions.length > 0 ? null : (
        <PresenceEmptyState
          icon="timer"
          title="No focus history yet"
          body="Start a session to unlock streaks, XP, and session analytics."
        />
      )}
    </div>
  );
}

const sectionLabelStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};
