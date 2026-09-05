import type { CSSProperties } from 'react';
import type {
  SleepEntryRecord,
  SleepRestrictionWindow,
} from '@mylife/sleep';
import {
  exportToCBTIFormat,
  formatDurationLabel,
  formatReminderSummary,
  getActiveGoals,
  getEfficiencyTrend,
  getSleepRestrictionWindow,
  listEntries,
  listFactors,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { readSleepTargetHours } from '../presentation';
import { saveSleepSettingsAction } from '../actions';
import { SleepReminderPermission } from './SleepReminderPermission';

const REMINDER_OPTIONS = [15, 30, 45, 60];
const CLOCK_TIME_RE = /T(\d{2}:\d{2})/;

function readSetting(
  key: string,
  fallback: string,
): string {
  const adapter = getAdapter();
  return adapter.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    [key],
  )[0]?.value ?? fallback;
}

function resolveReminderTargetBedtime(): string {
  const saved = readSetting('sleep.reminder.targetBedtime', '');
  if (saved) {
    return saved;
  }

  return (
    getActiveGoals(getAdapter()).find((goal) => goal.type === 'bedtime')
      ?.target_value ?? '22:30'
  );
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clockTimeFromDateTime(value: string): string | undefined {
  return CLOCK_TIME_RE.exec(value)?.[1];
}

function getRestrictionPreview(
  entries: readonly SleepEntryRecord[],
): SleepRestrictionWindow | null {
  const trend = getEfficiencyTrend(entries);
  const efficiencyValues = trend
    .map((point) => point.sleepEfficiency)
    .filter((value): value is number => typeof value === 'number');
  const timeInBedValues = trend
    .map((point) => point.timeInBedMinutes)
    .filter((value): value is number => typeof value === 'number');
  const totalSleepValues = trend
    .map((point) => point.totalSleepTimeMinutes)
    .filter((value): value is number => typeof value === 'number');
  const currentEfficiency = average(efficiencyValues);

  if (currentEfficiency === null) {
    return null;
  }

  return getSleepRestrictionWindow(currentEfficiency, 85, {
    averageSleepMinutes: average(totalSleepValues) ?? undefined,
    currentTimeInBedMinutes: average(timeInBedValues) ?? undefined,
    preferredWakeTime: clockTimeFromDateTime(entries[0]?.wake_time ?? '') ?? '07:00',
  });
}

export default function SleepSettingsPage() {
  const adapter = getAdapter();
  const targetHours = readSleepTargetHours(adapter);
  const entries = listEntries(adapter, { limit: 500 });
  const factors = listFactors(adapter, { limit: 500 });
  const cbtiExport = exportToCBTIFormat(entries, factors);
  const exportHref = `data:${cbtiExport.mimeType};charset=utf-8,${encodeURIComponent(cbtiExport.content)}`;
  const restrictionPreview = getRestrictionPreview(entries.slice(0, 30));
  const reminderEnabled =
    readSetting('sleep.reminder.enabled', 'false') === 'true';
  const restrictionEnabled =
    readSetting('sleep.restriction.enabled', 'false') === 'true';
  const reminderMinutes = Number(
    readSetting('sleep.reminder.minutesBefore', '30'),
  ) || 30;
  const targetBedtime = resolveReminderTargetBedtime();

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Settings</p>
        <h2 style={styles.heroTitle}>Tune targets, reminders, and bridge boundaries.</h2>
        <p style={styles.heroCopy}>
          MySleep reminders use local browser permission, while Mood, Habits, and Health bridges remain explicit opt-ins.
        </p>
      </section>

      <form action={saveSleepSettingsAction} style={styles.panel}>
        <div style={styles.grid}>
          <label style={styles.field}>
            <span style={styles.label}>Target hours</span>
            <input
              name="target_hours"
              defaultValue={String(targetHours)}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Target bedtime</span>
            <input
              name="target_bedtime"
              defaultValue={targetBedtime}
              placeholder="22:30"
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.reminderRow}>
          <label style={styles.checkboxLabel}>
            <input
              name="reminder_enabled"
              type="checkbox"
              defaultChecked={reminderEnabled}
            />
            <span>Enable bedtime reminder</span>
          </label>
          <select
            name="reminder_minutes"
            defaultValue={String(reminderMinutes)}
            style={styles.input}
          >
            {REMINDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} minutes before
              </option>
            ))}
          </select>
        </div>

        <p style={styles.body}>
          {formatReminderSummary(
            reminderEnabled,
            targetBedtime,
            reminderMinutes,
          )}
        </p>

        <SleepReminderPermission
          enabled={reminderEnabled}
          targetBedtime={targetBedtime}
          minutesBefore={reminderMinutes}
        />

        <label style={styles.checkboxLabel}>
          <input
            name="restriction_enabled"
            type="checkbox"
            defaultChecked={restrictionEnabled}
          />
          <span>Enable sleep restriction tracking</span>
        </label>
        <p style={styles.body}>
          Advanced CBT-I tracking should be used with therapist guidance. MySleep never recommends less than 5.5 hours in bed.
        </p>

        <button type="submit" style={styles.primaryButton}>
          Save Settings
        </button>
      </form>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>CBT-I diary</p>
        <h3 style={styles.panelTitle}>Therapist export</h3>
        <p style={styles.body}>
          Export date, bedtime, sleep onset, time in bed, total sleep time, efficiency, awakenings, quality, supplements, and notes as a CBT-I CSV.
        </p>
        <a
          download={cbtiExport.filename}
          href={exportHref}
          style={styles.downloadLink}
        >
          Export for Therapist
        </a>
        <p style={styles.body}>
          {cbtiExport.rowCount} diary rows ready.
        </p>
      </section>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>Advanced CBT-I</p>
        <h3 style={styles.panelTitle}>Sleep restriction window</h3>
        {restrictionPreview ? (
          <div style={styles.restrictionPreview}>
            <strong style={styles.restrictionValue}>
              {restrictionPreview.recommendedBedtime} - {restrictionPreview.recommendedWakeTime}
            </strong>
            <span style={styles.restrictionMeta}>
              {formatDurationLabel(restrictionPreview.recommendedTimeInBedMinutes)} in bed, {restrictionPreview.currentEfficiency.toFixed(1)}% efficiency
            </span>
            <p style={styles.body}>{restrictionPreview.rationale}</p>
          </div>
        ) : (
          <p style={styles.body}>
            Log bedtime and wake time to preview a restriction window.
          </p>
        )}
      </section>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>Privacy boundary</p>
        <h3 style={styles.panelTitle}>Local first</h3>
        <p style={styles.body}>
          Sleep goals, streaks, and bedtime reminder settings stay within MySleep. Future CBT-I exports and Health bridge imports must still be user-initiated from this settings surface.
        </p>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: 'grid',
    gap: 16,
  },
  hero: {
    display: 'grid',
    gap: 10,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(167,139,250,0.10)',
  },
  eyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 30,
    lineHeight: 1.08,
  },
  heroCopy: {
    margin: 0,
    maxWidth: 760,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  panel: {
    display: 'grid',
    gap: 14,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  panelTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 22,
    lineHeight: 1.15,
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.55,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 7,
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14,
  },
  reminderRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkboxLabel: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
  },
  primaryButton: {
    width: 'fit-content',
    border: 0,
    borderRadius: 999,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
  },
  downloadLink: {
    width: 'fit-content',
    borderRadius: 999,
    background: 'rgba(167,139,250,0.18)',
    border: '1px solid rgba(167,139,250,0.46)',
    color: '#F5F3FF',
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 900,
    textDecoration: 'none',
  },
  restrictionPreview: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
  },
  restrictionValue: {
    color: 'var(--text)',
    fontSize: 28,
    lineHeight: 1.05,
  },
  restrictionMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
  },
};
