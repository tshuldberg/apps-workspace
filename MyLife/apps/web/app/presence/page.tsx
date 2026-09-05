'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doCreateSession, fetchPresenceDashboard } from './actions';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  MaterialSymbol,
  TOKENS,
  clampPercent,
  formatDateTime,
  formatMinutes,
  ghostButtonStyle,
  gradientButtonStyle,
} from './ui';

interface DashboardData {
  date: string;
  daily: {
    total_minutes: number;
    goal_met: number;
    pickups: number;
  } | null;
  goalMinutes: number;
  sessions: Array<{
    id: string;
    start_time: string;
    planned_minutes: number;
    actual_minutes: number | null;
    completed: number;
    type: string;
  }>;
  totalXP: number;
  xpProgress: {
    level: number;
    progress: number;
    xpToNext: number;
  };
  topApps: Array<{
    app_name: string;
    category: string;
    total_minutes: number;
    total_opens: number;
  }>;
  trendData: Array<{ date: string; minutes: number }>;
  streaks: {
    current: number;
    longest: number;
  };
  deltaMinutes: number;
  badgePreview: Array<{
    id: string;
    name: string;
    icon: string;
    earned: boolean;
    progress: number;
    currentValue: number;
    target: number;
  }>;
  commitment: {
    text: string;
  } | null;
}

export default function PresenceHomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function loadData() {
    try {
      setError(null);
      setData((await fetchPresenceDashboard()) as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MyPresence.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleQuickStart(minutes: number, type: 'solo' | 'group' | 'beast' = 'solo') {
    try {
      setStarting(true);
      await doCreateSession({ planned_minutes: minutes, type });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a focus session.');
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="pr-card-stack">
        <PresenceCard style={{ minHeight: 220 }} />
        <div className="pr-grid-3">
          <PresenceCard style={{ minHeight: 140 }} />
          <PresenceCard style={{ minHeight: 140 }} />
          <PresenceCard style={{ minHeight: 140 }} />
        </div>
      </div>
    );
  }

  if (error || data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Presence dashboard unavailable"
        body={error ?? 'We could not load your dashboard right now.'}
        action={(
          <button type="button" onClick={() => void loadData()} style={gradientButtonStyle}>
            Reload
          </button>
        )}
      />
    );
  }

  const todayMinutes = data.daily?.total_minutes ?? 0;
  const goalPercent = clampPercent((todayMinutes / Math.max(data.goalMinutes, 1)) * 100);
  const underGoal = todayMinutes <= data.goalMinutes;
  const maxTrend = Math.max(...data.trendData.map((item) => item.minutes), data.goalMinutes, 1);

  if (todayMinutes === 0 && data.topApps.length === 0 && data.sessions.length === 0) {
    return (
      <PresenceEmptyState
        icon="self_improvement"
        title="Start your Presence loop"
        body="Track screen time, set intentions, and use short focus blocks to build a healthier relationship with your phone."
        action={(
          <div className="pr-chip-row">
            <button type="button" onClick={() => void handleQuickStart(25)} style={gradientButtonStyle} disabled={starting}>
              {starting ? 'Starting…' : 'Start 25-Minute Session'}
            </button>
            <Link href="/presence/hub" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
              Open Hub
            </Link>
          </div>
        )}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <div className="pr-home-grid">
        <div className="pr-card-stack">
          <PresenceCard
            padding={28}
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(19,19,24,0.94) 60%)',
              boxShadow: '0 24px 60px rgba(8,145,178,0.16)',
            }}
          >
            <PresenceSectionHeading
              title="Today"
              subtitle="A live view of your attention budget, recent momentum, and where your phone pulled you back in."
              action={(
                <div className="pr-chip-row">
                  <button type="button" onClick={() => void handleQuickStart(25)} style={gradientButtonStyle} disabled={starting}>
                    {starting ? 'Starting…' : 'Start Focus'}
                  </button>
                  <Link href="/presence/intentions" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
                    Intentions
                  </Link>
                </div>
              )}
            />

            <div className="pr-grid-3" style={{ marginTop: 22 }}>
              <PresenceMetricCard
                label="Screen Time"
                value={formatMinutes(todayMinutes)}
                tone={underGoal ? TOKENS.accentLight : TOKENS.danger}
                detail={underGoal ? `${data.goalMinutes - todayMinutes}m under goal` : `${todayMinutes - data.goalMinutes}m over goal`}
              />
              <PresenceMetricCard
                label="Pickups"
                value={`${data.daily?.pickups ?? 0}`}
                tone={TOKENS.info}
                detail="Times you reached for your phone today"
              />
              <PresenceMetricCard
                label="XP"
                value={`${data.totalXP}`}
                tone={TOKENS.warning}
                detail={`Level ${data.xpProgress.level} · ${data.xpProgress.xpToNext} XP to next`}
              />
            </div>

            <div className="pr-grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
              <div style={{ ...PresencePanelInner, minHeight: 238 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <p style={eyebrowStyle}>Daily Time Card</p>
                    <h2 style={heroValueStyle}>{formatMinutes(todayMinutes)}</h2>
                  </div>
                  <div
                    style={{
                      minWidth: 92,
                      textAlign: 'right',
                      color: underGoal ? TOKENS.success : TOKENS.danger,
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {underGoal ? 'On track' : 'Over target'}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={progressTrackStyle}>
                    <div
                      style={{
                        ...progressFillStyle,
                        width: `${Math.max(8, goalPercent)}%`,
                        background: underGoal
                          ? 'linear-gradient(90deg, #22D3EE, #0891B2)'
                          : 'linear-gradient(90deg, #FFB877, #EF4444)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                    <span style={microCopyStyle}>Goal {formatMinutes(data.goalMinutes)}</span>
                    <span style={microCopyStyle}>
                      {data.deltaMinutes > 0 ? '+' : ''}
                      {formatMinutes(Math.abs(data.deltaMinutes))} vs last week
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'end', gap: 8, height: 96, marginTop: 18 }}>
                  {data.trendData.slice(-10).map((item) => (
                    <div key={item.date} style={{ flex: 1, display: 'grid', gap: 8 }}>
                      <div
                        style={{
                          height: `${Math.max(10, (item.minutes / maxTrend) * 92)}px`,
                          borderRadius: 999,
                          background:
                            item.date === data.date
                              ? 'linear-gradient(180deg, rgba(34,211,238,0.96), rgba(8,145,178,0.84))'
                              : 'rgba(255,255,255,0.14)',
                          boxShadow:
                            item.date === data.date ? '0 0 14px rgba(8,145,178,0.28)' : 'none',
                        }}
                      />
                      <span style={{ ...microCopyStyle, textAlign: 'center' }}>
                        {item.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...PresencePanelInner, minHeight: 238 }}>
                <p style={eyebrowStyle}>Top Apps</p>
                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  {data.topApps.length === 0 ? (
                    <p style={emptyCopyStyle}>No app usage logged yet today.</p>
                  ) : (
                    data.topApps.map((app) => (
                      <div key={app.app_name} style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{app.app_name}</div>
                            <div style={microCopyStyle}>{app.category}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.accentLight }}>
                            {formatMinutes(app.total_minutes)}
                          </div>
                        </div>
                        <div style={progressTrackStyle}>
                          <div
                            style={{
                              ...progressFillStyle,
                              width: `${Math.max(10, (app.total_minutes / Math.max(todayMinutes, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading
              title="Focus Quick Starts"
              subtitle="Use short structured blocks when your day feels noisy."
            />
            <div className="pr-grid-3" style={{ marginTop: 16 }}>
              {[
                { label: '5-Minute Reset', detail: 'Short solo reset', minutes: 5, type: 'solo' as const },
                { label: 'Deep Work', detail: '90 minute block', minutes: 90, type: 'solo' as const },
                { label: 'Beast Mode', detail: 'High intensity sprint', minutes: 45, type: 'beast' as const },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => void handleQuickStart(preset.minutes, preset.type)}
                  style={{
                    ...PresencePanelInner,
                    border: `1.5px solid ${TOKENS.borderStrong}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  disabled={starting}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <MaterialSymbol name={preset.type === 'beast' ? 'local_fire_department' : 'timer'} size={22} color={preset.type === 'beast' ? TOKENS.beast : TOKENS.accentLight} />
                    <span style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {preset.minutes}m
                    </span>
                  </div>
                  <div style={{ marginTop: 18, fontSize: 17, fontWeight: 700 }}>{preset.label}</div>
                  <div style={{ marginTop: 6, color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{preset.detail}</div>
                </button>
              ))}
            </div>
          </PresenceCard>
        </div>

        <div className="pr-card-stack">
          <PresenceCard
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(34,211,238,0.06))',
            }}
          >
            <PresenceSectionHeading title="Streak Hero" subtitle="Consistency turns digital boundaries into automatic behavior." />
            <div className="pr-grid-2" style={{ marginTop: 16 }}>
              <PresenceMetricCard label="Current" value={`${data.streaks.current}`} tone={TOKENS.accentLight} detail="days under goal" />
              <PresenceMetricCard label="Longest" value={`${data.streaks.longest}`} tone={TOKENS.warning} detail="best run" />
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading
              title="Badge Rail"
              subtitle="Your next unlocks and recently earned milestones."
              action={<Link href="/presence/badges" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>Open Badges</Link>}
            />
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {data.badgePreview.map((badge) => (
                <div
                  key={badge.id}
                  style={{
                    ...PresencePanelInner,
                    display: 'grid',
                    gap: 10,
                    background: badge.earned ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          display: 'grid',
                          placeItems: 'center',
                          background: badge.earned ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <MaterialSymbol name={badge.icon} size={20} color={badge.earned ? TOKENS.accentLight : TOKENS.textTertiary} filled={badge.earned} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{badge.name}</div>
                        <div style={microCopyStyle}>
                          {badge.earned ? 'Earned' : `${badge.currentValue} / ${badge.target}`}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        color: badge.earned ? TOKENS.success : TOKENS.textSecondary,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {badge.earned ? 'Done' : `${Math.round(badge.progress * 100)}%`}
                    </div>
                  </div>
                  <div style={progressTrackStyle}>
                    <div style={{ ...progressFillStyle, width: `${Math.max(8, badge.progress * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading
              title="Recent Sessions"
              subtitle="The latest focus attempts, whether completed or interrupted."
              action={<Link href="/presence/sessions" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>All Sessions</Link>}
            />
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {data.sessions.length === 0 ? (
                <p style={emptyCopyStyle}>No focus sessions logged for today.</p>
              ) : (
                data.sessions.map((session) => (
                  <div key={session.id} style={{ ...PresencePanelInner, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MaterialSymbol
                          name={session.type === 'beast' ? 'local_fire_department' : session.type === 'group' ? 'groups' : 'person'}
                          size={18}
                          color={session.type === 'beast' ? TOKENS.beast : session.type === 'group' ? TOKENS.group : TOKENS.accentLight}
                        />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{session.type}</span>
                      </div>
                      <div style={{ ...microCopyStyle, marginTop: 6 }}>{formatDateTime(session.start_time)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.text }}>
                        {formatMinutes(session.actual_minutes ?? session.planned_minutes)}
                      </div>
                      <div style={{ ...microCopyStyle, color: session.completed === 1 ? TOKENS.success : TOKENS.warning }}>
                        {session.completed === 1 ? 'Completed' : 'Active'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PresenceCard>

          {data.commitment ? (
            <PresenceCard>
              <PresenceSectionHeading title="Commitment Contract" subtitle="A note from your calmer self for when the day starts slipping." />
              <p style={{ margin: '16px 0 0', color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.75 }}>
                {data.commitment.text}
              </p>
            </PresenceCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const PresencePanelInner: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.04)',
  border: `1.5px solid ${TOKENS.border}`,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const heroValueStyle: CSSProperties = {
  margin: '10px 0 0',
  fontSize: 42,
  lineHeight: 1,
  letterSpacing: '-0.04em',
  fontWeight: 800,
};

const progressTrackStyle: CSSProperties = {
  width: '100%',
  height: 10,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.08)',
};

const progressFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #22D3EE, #0891B2)',
};

const microCopyStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 12,
  lineHeight: 1.5,
};

const emptyCopyStyle: CSSProperties = {
  margin: 0,
  color: TOKENS.textSecondary,
  fontSize: 14,
  lineHeight: 1.7,
};
