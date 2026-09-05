import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  buildWeeklyGoalDots,
  buildSleepTimelineSections,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  generateAccountabilityMessage,
  getActiveGoals,
  getLatestEntry,
  getSleepDurationTone,
  getSleepWeekStart,
  getSleepWakeFeelingMeta,
  getStreaks,
  getWeeklySummary,
  listEntries,
  renderSleepQualityStars,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepBulletList, SleepPanel } from './_ui';
import { readSleepTargetHours, SLEEP_DURATION_TONES } from './presentation';

const PAGE_SIZE = 50;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parsePageValue(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    return parsePageValue(value[0]);
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SleepPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const currentPage = parsePageValue(params.page);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const adapter = getAdapter();
  const rows = listEntries(adapter, { limit: PAGE_SIZE + 1, offset });
  const entries = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const targetHours = readSleepTargetHours(adapter);
  const latestEntry = getLatestEntry(adapter);
  const sections = buildSleepTimelineSections(entries);
  const weeklyAccountability =
    entries.length >= 7
      ? (() => {
          const goals = getActiveGoals(adapter);
          const streaks = getStreaks(adapter);
          const weekStart = getSleepWeekStart(latestEntry?.date ?? todayDate());
          const summary = getWeeklySummary(entries, goals, weekStart, streaks);
          return {
            summary,
            message: generateAccountabilityMessage(summary),
            dots: buildWeeklyGoalDots(entries, goals, weekStart),
          };
        })()
      : null;

  if (entries.length === 0) {
    if (currentPage > 1) {
      return (
        <SleepPanel
          eyebrow="Sleep Log"
          title="No more sleep logs on this page"
          body="You paged past the oldest loaded entry. Jump back to the first page to return to the current timeline."
        >
          <div style={styles.paginationRow}>
            <Link href="/sleep" style={styles.primaryLink}>
              Back to Page 1
            </Link>
          </div>
        </SleepPanel>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <SleepPanel
          eyebrow="Sleep Log"
          title="Log your first night's sleep"
          body="The MySleep list is now ready for weekly grouping, detail pages, and editing, but it still starts with one fast manual entry."
        >
          <div style={styles.ctaRow}>
            <Link href="/sleep/log" style={styles.primaryLink}>
              Log Sleep
            </Link>
          </div>
          <SleepBulletList
            items={[
              'Weekly grouping now organizes logs into This Week, Last Week, and older week buckets',
              'Each saved night opens into its own detail view with edit and delete actions',
              'Duration badges compare each night against the seeded target-hours setting',
            ]}
          />
        </SleepPanel>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SleepPanel
        eyebrow="Sleep Log"
        title="Nights are grouped by week so the timeline stays readable"
        body="Every saved log lands in chronological order, color-coded against your target hours and ready to open into a full entry view."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/log" style={styles.primaryLink}>
            Log Sleep
          </Link>
          <Link href="/sleep/factors/log" style={styles.secondaryLink}>
            Log Factors
          </Link>
          <Link href="/sleep/factors/log?quick=1" style={styles.secondaryLink}>
            Quick Log
          </Link>
          <Link href="/sleep/naps/log" style={styles.secondaryLink}>
            Log Nap
          </Link>
          <Link href="/sleep/hygiene" style={styles.secondaryLink}>
            Hygiene
          </Link>
          <div style={styles.statPill}>Target {targetHours}h</div>
          <div style={styles.statPill}>Page {currentPage}</div>
        </div>
      </SleepPanel>

      {latestEntry && currentPage === 1 && (
        <Link href={`/sleep/entry/${latestEntry.id}`} style={styles.latestCard}>
          <div style={styles.latestHeader}>
            <div>
              <p style={styles.cardEyebrow}>Latest Night</p>
              <h2 style={styles.latestTitle}>
                {formatSleepEntryDateLabel(latestEntry.date)}
              </h2>
            </div>
            <DurationBadge
              durationMinutes={latestEntry.duration_minutes}
              targetHours={targetHours}
            />
          </div>
          <p style={styles.latestCopy}>
            {formatSleepTimeLabel(latestEntry.bedtime)} to {formatSleepTimeLabel(latestEntry.wake_time)}
          </p>
          <div style={styles.metricRow}>
            <div style={styles.metricPill}>
              {renderSleepQualityStars(latestEntry.quality_rating)}
            </div>
            <div style={styles.metricPill}>
              {getSleepWakeFeelingMeta(latestEntry.wake_feeling).emoji}{' '}
              {getSleepWakeFeelingMeta(latestEntry.wake_feeling).label}
            </div>
          </div>
        </Link>
      )}

      {weeklyAccountability && currentPage === 1 && (
        <section style={styles.accountabilityCard}>
          <div style={styles.accountabilityHeader}>
            <div>
              <p style={styles.cardEyebrow}>Weekly Check-In</p>
              <h2 style={styles.accountabilityTitle}>
                {weeklyAccountability.summary.daysOnTarget} of{' '}
                {weeklyAccountability.summary.evaluatedDays} nights on target
              </h2>
            </div>
            <Link href="/sleep/insights" style={styles.secondaryLink}>
              Insights
            </Link>
          </div>
          <p style={styles.accountabilityCopy}>{weeklyAccountability.message}</p>
          <div style={styles.weekDotRow}>
            {weeklyAccountability.dots.map((dot) => (
              <div key={dot.date} style={styles.weekDotItem}>
                <span
                  style={{
                    ...styles.weekDot,
                    ...(dot.status === 'met' ? styles.weekDotMet : {}),
                    ...(dot.status === 'missed' ? styles.weekDotMissed : {}),
                  }}
                />
                <span style={styles.weekDotLabel}>{dot.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.map((section) => (
        <section key={section.weekStart} style={styles.sectionCard}>
          <p style={styles.sectionTitle}>{section.label}</p>
          <div style={styles.sectionList}>
            {section.entries.map((entry) => {
              const feeling = getSleepWakeFeelingMeta(entry.wake_feeling);
              return (
                <Link
                  key={entry.id}
                  href={`/sleep/entry/${entry.id}`}
                  style={styles.entryRow}
                >
                  <div style={styles.entryMain}>
                    <strong style={styles.entryDate}>
                      {formatSleepEntryDateLabel(entry.date)}
                    </strong>
                    <span style={styles.entryTimes}>
                      {formatSleepTimeLabel(entry.bedtime)} to {formatSleepTimeLabel(entry.wake_time)}
                    </span>
                    <span style={styles.entryMeta}>
                      {renderSleepQualityStars(entry.quality_rating)} • {feeling.emoji}{' '}
                      {feeling.label}
                    </span>
                  </div>
                  <div style={styles.entryAside}>
                    <DurationBadge
                      durationMinutes={entry.duration_minutes}
                      targetHours={targetHours}
                    />
                    <span style={styles.entryWakeCount}>
                      {entry.wake_count} wake-ups
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <div style={styles.paginationRow}>
        {currentPage > 1 ? (
          <Link href={currentPage === 2 ? '/sleep' : `/sleep?page=${currentPage - 1}`} style={styles.secondaryLink}>
            Newer Nights
          </Link>
        ) : (
          <span style={styles.paginationHint}>You&apos;re on the newest page.</span>
        )}

        {hasMore ? (
          <Link href={`/sleep?page=${currentPage + 1}`} style={styles.secondaryLink}>
            Older Nights
          </Link>
        ) : (
          <span style={styles.paginationHint}>No older pages left.</span>
        )}
      </div>
    </div>
  );
}

function DurationBadge({
  durationMinutes,
  targetHours,
}: {
  durationMinutes: number;
  targetHours: number;
}) {
  const tone = getSleepDurationTone(durationMinutes, targetHours);
  const toneStyle = SLEEP_DURATION_TONES[tone];

  return (
    <div
      style={{
        ...styles.durationBadge,
        background: toneStyle.background,
        borderColor: toneStyle.borderColor,
        color: toneStyle.color,
      }}
    >
      {formatDurationLabel(durationMinutes)}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  primaryLink: {
    borderRadius: 999,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '11px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  secondaryLink: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  statPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 700,
  },
  latestCard: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.12)',
    textDecoration: 'none',
  },
  latestHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEyebrow: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  latestTitle: {
    margin: '6px 0 0',
    color: 'var(--text)',
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
  },
  latestCopy: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  metricRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.3)',
    color: 'var(--text)',
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  accountabilityCard: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  accountabilityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  accountabilityTitle: {
    margin: '6px 0 0',
    color: 'var(--text)',
    fontSize: 24,
    lineHeight: 1.12,
  },
  accountabilityCopy: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.55,
  },
  weekDotRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 8,
  },
  weekDotItem: {
    display: 'grid',
    gap: 6,
    justifyItems: 'center',
  },
  weekDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  weekDotMet: {
    background: 'rgba(48,209,88,0.72)',
    borderColor: 'rgba(48,209,88,0.92)',
  },
  weekDotMissed: {
    background: 'rgba(255,69,58,0.55)',
    borderColor: 'rgba(255,69,58,0.82)',
  },
  weekDotLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
  },
  sectionCard: {
    display: 'grid',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  sectionList: {
    display: 'grid',
    gap: 12,
  },
  entryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    textDecoration: 'none',
  },
  entryMain: {
    display: 'grid',
    gap: 4,
  },
  entryDate: {
    color: 'var(--text)',
    fontSize: 15,
  },
  entryTimes: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  entryMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 600,
  },
  entryAside: {
    display: 'grid',
    justifyItems: 'end',
    gap: 8,
  },
  entryWakeCount: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 600,
  },
  durationBadge: {
    borderRadius: 999,
    border: '1px solid transparent',
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 800,
  },
  paginationRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationHint: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.6,
  },
};
