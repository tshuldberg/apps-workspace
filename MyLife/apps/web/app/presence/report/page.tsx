'use client';

import type { CSSProperties } from 'react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  MaterialSymbol,
  TOKENS,
  addDays,
  formatLongDate,
  formatMinutes,
  gradientButtonStyle,
} from '../ui';
import { fetchPresenceReport } from '../actions';

interface ReportData {
  date: string;
  summary: {
    totalMinutes: number;
    goalMinutes: number | null;
    goalMet: boolean;
    pickups: number;
    topApps: Array<{ appName: string; minutes: number; category: string }>;
  } | null;
  goal: { daily_minutes: number } | null;
  focusSessions: Array<{ id: string; completed: number; actual_minutes: number | null; planned_minutes: number }>;
  recentUsage: Array<{ date: string; total_minutes: number }>;
  xpEntries: Array<{ id: string; source: string; amount: number }>;
  xpTotal: number;
  activeCommitment: { text: string } | null;
  streaks: { current: number; longest: number };
  intentionCompliance: number;
  intentionStatus: Array<{ appName: string; compliant: boolean; opens: number; minutes: number }>;
  recommendations: Array<{ title: string; body: string }>;
}

function gradeForDay(totalMinutes: number, goalMinutes: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  const ratio = goalMinutes > 0 ? totalMinutes / goalMinutes : 1;
  if (ratio <= 0.65) return 'A';
  if (ratio <= 0.85) return 'B';
  if (ratio <= 1) return 'C';
  if (ratio <= 1.2) return 'D';
  return 'F';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return TOKENS.success;
    case 'B':
      return TOKENS.accentLight;
    case 'C':
      return TOKENS.warning;
    case 'D':
      return '#FB923C';
    default:
      return TOKENS.danger;
  }
}

function PresenceReportPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(targetDate: string) {
    try {
      setError(null);
      setLoading(true);
      setData((await fetchPresenceReport(targetDate)) as ReportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(date);
  }, [date]);

  const grade = useMemo(() => {
    if (!data?.summary) return 'C';
    return gradeForDay(data.summary.totalMinutes, data.goal?.daily_minutes ?? data.summary.goalMinutes ?? 180);
  }, [data]);

  async function handleShare() {
    try {
      const url = `${window.location.origin}/presence/report?date=${date}`;
      await navigator.clipboard.writeText(url);
    } catch {
      setError('Could not copy the report link.');
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 240 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Daily report unavailable"
        body={error}
      />
    );
  }

  if (!data?.summary) {
    return (
      <PresenceEmptyState
        icon="summarize"
        title="No report for this day yet"
        body="Presence will generate the report once usage has been recorded for the selected date."
      />
    );
  }

  const goalMinutes = data.goal?.daily_minutes ?? data.summary.goalMinutes ?? 180;
  const difference = data.summary.totalMinutes - goalMinutes;
  const completedSessions = data.focusSessions.filter((session) => session.completed === 1);

  return (
    <div className="pr-main-stack">
      <PresenceCard
        padding={28}
        style={{
          background: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(19,19,24,0.94) 58%)',
          boxShadow: '0 24px 60px rgba(8,145,178,0.16)',
        }}
      >
        <PresenceSectionHeading
          title="Daily Report"
          subtitle="A single-page summary of total screen time, compliance, focus work, XP, and the next moves that would improve tomorrow."
          action={(
            <div className="pr-chip-row">
              <button type="button" onClick={() => router.replace(`/presence/report?date=${addDays(date, -1)}`)} style={gradientButtonStyle}>
                <MaterialSymbol name="chevron_left" size={18} color="#03161C" />
              </button>
              <button type="button" onClick={() => router.replace(`/presence/report?date=${addDays(date, 1)}`)} style={gradientButtonStyle}>
                <MaterialSymbol name="chevron_right" size={18} color="#03161C" />
              </button>
              <button type="button" onClick={() => void handleShare()} style={gradientButtonStyle}>
                Share
              </button>
            </div>
          )}
        />

        <div className="pr-report-grid" style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {formatLongDate(date)}
            </div>
            <div style={{ fontSize: 48, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.04em' }}>
              Grade {grade}
            </div>
            <div style={{ color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.8 }}>
              {difference <= 0 ? `${Math.abs(difference)} minutes under goal.` : `${difference} minutes over goal.`}
              {' '}Intentions were {data.intentionCompliance}% compliant and the current streak is {data.streaks.current} days.
            </div>
          </div>

          <div
            style={{
              width: 180,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: `1.5px solid ${TOKENS.borderStrong}`,
              display: 'grid',
              placeItems: 'center',
              marginLeft: 'auto',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: gradeColor(grade), fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{grade}</div>
              <div style={{ color: TOKENS.textTertiary, fontSize: 12, marginTop: 6 }}>for today</div>
            </div>
          </div>
        </div>

        <div className="pr-grid-4" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="Screen Time" value={formatMinutes(data.summary.totalMinutes)} tone={TOKENS.accentLight} detail={`Goal ${formatMinutes(goalMinutes)}`} />
          <PresenceMetricCard label="Pickups" value={`${data.summary.pickups}`} tone={TOKENS.info} detail="total device pickups" />
          <PresenceMetricCard label="Focus Time" value={formatMinutes(completedSessions.reduce((sum, session) => sum + (session.actual_minutes ?? session.planned_minutes), 0))} tone={TOKENS.success} detail={`${completedSessions.length} completed sessions`} />
          <PresenceMetricCard label="XP" value={`${data.xpTotal}`} tone={TOKENS.warning} detail={`${data.xpEntries.length} XP events`} />
        </div>
      </PresenceCard>

      <div className="pr-report-grid">
        <PresenceCard>
          <PresenceSectionHeading title="App Breakdown" subtitle="Which apps consumed the most attention on the selected date." />
          <table className="pr-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>App</th>
                <th>Category</th>
                <th>Minutes</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.topApps.map((app) => (
                <tr key={app.appName}>
                  <td style={{ color: TOKENS.text, fontWeight: 700 }}>{app.appName}</td>
                  <td>{app.category}</td>
                  <td>{formatMinutes(app.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <PresenceSectionHeading title="Intentions" subtitle="Whether your high-friction app rules held today." />
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {data.intentionStatus.length === 0 ? (
              <p style={emptyCopyStyle}>No active intentions for this date.</p>
            ) : (
              data.intentionStatus.map((item) => (
                <div key={item.appName} style={{ padding: 16, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${item.compliant ? 'rgba(48,209,88,0.22)' : 'rgba(255,184,119,0.22)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{item.appName}</div>
                      <div style={microCopyStyle}>{item.opens} opens · {formatMinutes(item.minutes)}</div>
                    </div>
                    <div style={{ color: item.compliant ? TOKENS.success : TOKENS.warning, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      {item.compliant ? 'Held' : 'Missed'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PresenceCard>

        <div className="pr-card-stack">
          <PresenceCard>
            <PresenceSectionHeading title="Focus Sessions" subtitle="The sessions that added structure to this day." />
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {completedSessions.length === 0 ? (
                <p style={emptyCopyStyle}>No completed focus sessions today.</p>
              ) : (
                completedSessions.map((session) => (
                  <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: TOKENS.text, fontSize: 14 }}>Completed session</span>
                    <span style={{ color: TOKENS.accentLight, fontSize: 14, fontWeight: 700 }}>
                      {formatMinutes(session.actual_minutes ?? session.planned_minutes)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading title="XP Breakdown" subtitle="Every XP award that landed today." />
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {data.xpEntries.length === 0 ? (
                <p style={emptyCopyStyle}>No XP awarded for this date.</p>
              ) : (
                data.xpEntries.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: TOKENS.text, fontSize: 14 }}>{entry.source}</span>
                    <span style={{ color: TOKENS.warning, fontSize: 14, fontWeight: 700 }}>+{entry.amount}</span>
                  </div>
                ))
              )}
            </div>
          </PresenceCard>

          {data.activeCommitment ? (
            <PresenceCard>
              <PresenceSectionHeading title="Commitment" subtitle="The message meant for the version of you most likely to drift." />
              <p style={{ margin: '16px 0 0', color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.8 }}>
                {data.activeCommitment.text}
              </p>
            </PresenceCard>
          ) : null}
        </div>
      </div>

      <PresenceCard>
        <PresenceSectionHeading title="Recommendations" subtitle="Actions driven by goal compliance, focus sessions, and intention misses." />
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {data.recommendations.map((recommendation) => (
            <div key={recommendation.title} style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{recommendation.title}</div>
              <div style={{ color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.8, marginTop: 8 }}>{recommendation.body}</div>
            </div>
          ))}
        </div>
      </PresenceCard>
    </div>
  );
}

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

export default function PresenceReportPage() {
  return (
    <Suspense fallback={null}>
      <PresenceReportPageContent />
    </Suspense>
  );
}
