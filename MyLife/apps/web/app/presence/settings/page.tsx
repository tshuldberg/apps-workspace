'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceSectionHeading,
  TOKENS,
  chipStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  inputStyle,
} from '../ui';
import {
  doCreateGoal,
  doSetSetting,
  fetchExportAppUsageCSV,
  fetchExportDailyUsageCSV,
  fetchExportSessionsCSV,
  fetchPresenceSettingsSnapshot,
} from '../actions';

interface SettingsData {
  goalMinutes: string;
  scrollAlert: string;
  progressiveAlerts: boolean;
  morningBriefing: boolean;
  morningBriefingTime: string;
  bedtimeWindDown: boolean;
  bedtimeTime: string;
  streakReminders: boolean;
  timeDisplayMode: string;
  goals: Array<{ id: string; daily_minutes: number; effective_date: string }>;
  categories: Record<string, number>;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goalMinutes, setGoalMinutes] = useState('180');
  const [scrollAlert, setScrollAlert] = useState('60');
  const [morningTime, setMorningTime] = useState('07:30');
  const [bedtimeTime, setBedtimeTime] = useState('22:00');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function loadData() {
    try {
      setError(null);
      const snapshot = (await fetchPresenceSettingsSnapshot()) as SettingsData;
      setData(snapshot);
      setGoalMinutes(snapshot.goalMinutes);
      setScrollAlert(snapshot.scrollAlert);
      setMorningTime(snapshot.morningBriefingTime);
      setBedtimeTime(snapshot.bedtimeTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveGoal() {
    try {
      setSaving(true);
      const minutes = Number(goalMinutes);
      await doSetSetting('daily_goal_minutes', String(minutes));
      await doCreateGoal({ daily_minutes: minutes, effective_date: new Date().toISOString().slice(0, 10) });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the daily goal.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleSetting(key: string, current: boolean) {
    try {
      await doSetSetting(key, current ? '0' : '1');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that setting.');
    }
  }

  async function exportCsv(type: 'daily' | 'apps' | 'sessions') {
    try {
      setExporting(true);
      const csv =
        type === 'daily'
          ? ((await fetchExportDailyUsageCSV()) as string)
          : type === 'apps'
            ? ((await fetchExportAppUsageCSV()) as string)
            : ((await fetchExportSessionsCSV()) as string);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `presence-${type}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the data.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 260 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Settings unavailable"
        body={error}
      />
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Presence Settings"
          subtitle="A desktop control room for goals, notifications, display behavior, app categories, exports, and product context."
        />
      </PresenceCard>

      <div className="pr-grid-2">
        <div className="pr-card-stack">
          <PresenceCard>
            <PresenceSectionHeading title="Goal" subtitle="Set the daily screen-time target that drives grades, streaks, and alerts." />
            <div className="pr-form-grid" style={{ marginTop: 16 }}>
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Minutes per day</span>
                <input value={goalMinutes} onChange={(event) => setGoalMinutes(event.target.value)} style={inputStyle} inputMode="numeric" />
              </label>
              <button type="button" onClick={() => void saveGoal()} style={gradientButtonStyle} disabled={saving}>
                {saving ? 'Saving…' : 'Save Goal'}
              </button>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.goals.slice(0, 4).map((goal) => (
                  <div key={goal.id} style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                    {goal.effective_date} · {goal.daily_minutes} minutes
                  </div>
                ))}
              </div>
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading title="Notifications" subtitle="Decide when Presence nudges you before habits slide." />
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <ToggleRow label="Progressive alerts" enabled={data.progressiveAlerts} onToggle={() => void toggleSetting('progressive_alerts_enabled', data.progressiveAlerts)} />
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Scroll alert interval</span>
                <div className="pr-chip-row">
                  <input value={scrollAlert} onChange={(event) => setScrollAlert(event.target.value)} style={inputStyle} inputMode="numeric" />
                  <button type="button" onClick={() => void doSetSetting('scroll_alert_interval_minutes', scrollAlert).then(loadData)} style={chipStyle(false)}>
                    Save
                  </button>
                </div>
              </label>
              <ToggleRow label="Morning briefing" enabled={data.morningBriefing} onToggle={() => void toggleSetting('morning_briefing_enabled', data.morningBriefing)} />
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Morning time</span>
                <div className="pr-chip-row">
                  <input value={morningTime} onChange={(event) => setMorningTime(event.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => void doSetSetting('morning_briefing_time', morningTime).then(loadData)} style={chipStyle(false)}>
                    Save
                  </button>
                </div>
              </label>
              <ToggleRow label="Bedtime wind-down" enabled={data.bedtimeWindDown} onToggle={() => void toggleSetting('bedtime_wind_down_enabled', data.bedtimeWindDown)} />
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Bedtime</span>
                <div className="pr-chip-row">
                  <input value={bedtimeTime} onChange={(event) => setBedtimeTime(event.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => void doSetSetting('bedtime_time', bedtimeTime).then(loadData)} style={chipStyle(false)}>
                    Save
                  </button>
                </div>
              </label>
              <ToggleRow label="Streak reminders" enabled={data.streakReminders} onToggle={() => void toggleSetting('streak_reminders_enabled', data.streakReminders)} />
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading title="Display" subtitle="Choose how time is presented across report cards and charts." />
            <div className="pr-chip-row" style={{ marginTop: 16 }}>
              {['clock', 'minutes'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => void doSetSetting('time_display_mode', mode).then(loadData)}
                  style={chipStyle(data.timeDisplayMode === mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </PresenceCard>
        </div>

        <div className="pr-card-stack">
          <PresenceCard>
            <PresenceSectionHeading title="App Categories" subtitle="The current app-library mix used by the intentions screen and report classifications." />
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {Object.entries(data.categories).map(([category, count]) => (
                <div key={category} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: TOKENS.text, fontSize: 14, fontWeight: 700 }}>{category}</span>
                  <span style={{ color: TOKENS.textSecondary, fontSize: 13 }}>{count} apps</span>
                </div>
              ))}
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading title="App Intentions" subtitle="Jump directly to the behavior rules that shape your report grade." />
            <Link href="/presence/intentions" style={{ ...gradientButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: 16 }}>
              Open Intentions
            </Link>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading title="Data" subtitle="Export private local data without syncing it anywhere else." />
            <div className="pr-chip-row" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => void exportCsv('daily')} style={gradientButtonStyle} disabled={exporting}>
                Daily CSV
              </button>
              <button type="button" onClick={() => void exportCsv('apps')} style={gradientButtonStyle} disabled={exporting}>
                Apps CSV
              </button>
              <button type="button" onClick={() => void exportCsv('sessions')} style={gradientButtonStyle} disabled={exporting}>
                Sessions CSV
              </button>
            </div>
          </PresenceCard>

          <PresenceCard>
            <PresenceSectionHeading title="About" subtitle="Presence is privacy-first. All digital wellness data stays local inside your MyLife database." />
            <div style={{ color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.8, marginTop: 16 }}>
              Presence tracks screen time, focus sessions, app intentions, XP, badges, rewards, commitments, and daily reports without cloud analytics.
            </div>
            <div className="pr-chip-row" style={{ marginTop: 16 }}>
              <Link href="/presence/report" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
                Open Report
              </Link>
              <Link href="/presence/hub" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
                Open Hub
              </Link>
            </div>
          </PresenceCard>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={toggleRowStyle}>
      <div>
        <div style={{ color: TOKENS.text, fontSize: 14, fontWeight: 700 }}>{label}</div>
        <div style={{ color: TOKENS.textTertiary, fontSize: 12, marginTop: 6 }}>{enabled ? 'Enabled' : 'Disabled'}</div>
      </div>
      <button type="button" onClick={onToggle} style={chipStyle(enabled)}>
        {enabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const toggleRowStyle: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.04)',
  border: `1.5px solid ${TOKENS.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
};
