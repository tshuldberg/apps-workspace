import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  SLEEP_HYGIENE_PRACTICES,
  getEnabledHygienePracticeIds,
  getSleepHygieneDashboard,
  listEntries,
  listFactors,
  listHygieneChecks,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import {
  saveSleepHygieneChecksAction,
  saveSleepHygienePracticesAction,
} from '../actions';

const HYGIENE_ENABLED_KEY = 'sleep.hygiene.enabledPractices';
const TARGET_BEDTIME_KEY = 'sleep.reminder.targetBedtime';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function readSetting(key: string, fallback = ''): string {
  const adapter = getAdapter();
  return adapter.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    [key],
  )[0]?.value ?? fallback;
}

function statusLabel(status: string): string {
  if (status === 'met') return 'Met';
  if (status === 'missed') return 'Missed';
  return 'Needs data';
}

function statusStyle(status: string): CSSProperties {
  if (status === 'met') return styles.statusMet;
  if (status === 'missed') return styles.statusMissed;
  return styles.statusUnknown;
}

export default function SleepHygienePage() {
  const adapter = getAdapter();
  const referenceDate = todayDate();
  const startDate = addDays(referenceDate, -6);
  const enabledPracticeIds = getEnabledHygienePracticeIds(
    readSetting(HYGIENE_ENABLED_KEY),
  );
  const dashboard = getSleepHygieneDashboard({
    entries: listEntries(adapter, {
      startDate,
      endDate: referenceDate,
      limit: 200,
    }),
    factors: listFactors(adapter, {
      startDate,
      endDate: referenceDate,
      limit: 200,
    }),
    checks: listHygieneChecks(adapter, {
      startDate,
      endDate: referenceDate,
    }),
    referenceDate,
    enabledPracticeIds,
    targetBedtime: readSetting(TARGET_BEDTIME_KEY, '22:30'),
  });

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Sleep Hygiene</p>
        <h2 style={styles.heroTitle}>A daily checklist tied to actual sleep quality.</h2>
        <p style={styles.body}>
          MySleep auto-fills practices from factor logs when available, then
          lets manual check-offs fill the gaps for the current sleep date.
        </p>
        <div style={styles.ctaRow}>
          <Link href="/sleep/factors/log" style={styles.primaryLink}>
            Log Factors
          </Link>
          <Link href="/sleep/naps/log" style={styles.secondaryLink}>
            Log Nap
          </Link>
        </div>
      </section>

      <section style={styles.metricGrid}>
        <Metric
          label="Weekly score"
          value={
            dashboard.weeklyScore === null
              ? '--'
              : `${Math.round(dashboard.weeklyScore)}%`
          }
        />
        <Metric
          label="Today"
          value={
            dashboard.today.score === null
              ? '--'
              : `${Math.round(dashboard.today.score)}%`
          }
        />
        <Metric
          label="Known items"
          value={`${dashboard.today.knownCount}/${dashboard.today.totalCount}`}
        />
        <Metric
          label="Quality link"
          value={
            dashboard.correlation.status === 'reportable'
              ? dashboard.correlation.direction
              : 'learning'
          }
        />
      </section>

      <section style={styles.twoColumn}>
        <form action={saveSleepHygieneChecksAction} style={styles.panel}>
          <input name="date" type="hidden" value={referenceDate} />
          <p style={styles.eyebrow}>Today</p>
          <h3 style={styles.panelTitle}>{referenceDate} checklist</h3>
          <div style={styles.checkList}>
            {dashboard.today.items.map((item) => (
              <label key={item.practice.id} style={styles.checkRow}>
                <input
                  name="practice_id"
                  type="hidden"
                  value={item.practice.id}
                />
                <input
                  name="met"
                  type="checkbox"
                  value={item.practice.id}
                  defaultChecked={item.status === 'met'}
                />
                <span style={styles.checkCopy}>
                  <strong style={styles.checkTitle}>{item.practice.label}</strong>
                  <span style={styles.checkReason}>{item.reason}</span>
                </span>
                <span style={{ ...styles.statusPill, ...statusStyle(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </label>
            ))}
          </div>
          <button type="submit" style={styles.primaryButton}>
            Save Today
          </button>
        </form>

        <section style={styles.panel}>
          <p style={styles.eyebrow}>Quality correlation</p>
          <h3 style={styles.panelTitle}>
            {dashboard.correlation.status === 'reportable'
              ? 'Adherence has enough samples'
              : 'Still collecting samples'}
          </h3>
          <p style={styles.body}>{dashboard.correlation.insight}</p>
          <StatRow
            label="High-adherence nights"
            value={String(dashboard.correlation.highAdherenceSampleSize)}
          />
          <StatRow
            label="Low-adherence nights"
            value={String(dashboard.correlation.lowAdherenceSampleSize)}
          />
          <StatRow
            label="Quality delta"
            value={
              dashboard.correlation.qualityDelta === null
                ? '--'
                : dashboard.correlation.qualityDelta.toFixed(1)
            }
          />
        </section>
      </section>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>Weekly adherence</p>
        <h3 style={styles.panelTitle}>Last 7 sleep dates</h3>
        <div style={styles.weekGrid}>
          {dashboard.daily.map((day) => (
            <div key={day.date} style={styles.weekTile}>
              <span style={styles.weekDate}>{day.date.slice(5)}</span>
              <strong style={styles.weekScore}>
                {day.score === null ? '--' : `${Math.round(day.score)}%`}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <form action={saveSleepHygienePracticesAction} style={styles.panel}>
        <p style={styles.eyebrow}>Configured practices</p>
        <h3 style={styles.panelTitle}>Choose the daily checklist</h3>
        <div style={styles.practiceGrid}>
          {SLEEP_HYGIENE_PRACTICES.map((practice) => (
            <label key={practice.id} style={styles.practiceCard}>
              <input
                name="enabled_practice"
                type="checkbox"
                value={practice.id}
                defaultChecked={enabledPracticeIds.includes(practice.id)}
              />
              <span style={styles.checkCopy}>
                <strong style={styles.checkTitle}>{practice.label}</strong>
                <span style={styles.checkReason}>{practice.detail}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="submit" style={styles.primaryButton}>
          Save Practices
        </button>
      </form>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
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
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.26)',
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
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryLink: {
    borderRadius: 14,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '10px 14px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  secondaryLink: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 14px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  },
  metricCard: {
    display: 'grid',
    gap: 6,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 26,
    lineHeight: 1.1,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  panel: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  checkList: {
    display: 'grid',
    gap: 10,
  },
  checkRow: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text)',
  },
  checkCopy: {
    display: 'grid',
    gap: 4,
  },
  checkTitle: {
    color: 'var(--text)',
    fontSize: 14,
  },
  checkReason: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  statusPill: {
    minWidth: 82,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '6px 8px',
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 800,
    textAlign: 'center',
  },
  statusMet: {
    background: 'rgba(48,209,88,0.14)',
    borderColor: 'rgba(48,209,88,0.34)',
  },
  statusMissed: {
    background: 'rgba(255,69,58,0.14)',
    borderColor: 'rgba(255,69,58,0.34)',
  },
  statusUnknown: {
    background: 'rgba(255,255,255,0.05)',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '6px 0',
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  statLabel: {
    color: 'var(--text-secondary)',
  },
  statValue: {
    color: 'var(--text)',
    textAlign: 'right',
  },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
    gap: 10,
  },
  weekTile: {
    display: 'grid',
    gap: 6,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  weekDate: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
  },
  weekScore: {
    color: 'var(--text)',
    fontSize: 22,
  },
  practiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 10,
  },
  practiceCard: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gap: 10,
    alignItems: 'start',
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
  },
  primaryButton: {
    justifySelf: 'start',
    border: 0,
    borderRadius: 14,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
