import type { CSSProperties } from 'react';
import Link from 'next/link';
import type {
  YearReview,
  YearReviewLongestStreak,
  YearReviewMonthStats,
} from '@mylife/sleep';
import {
  generateYearReview,
  getStreakHistory,
  listDreams,
  listEntries,
  listNaps,
  SLEEP_STREAK_TYPES,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { readSleepTargetHours } from '../../presentation';

const LAVENDER = '#C4B5FD';
const CURRENT_YEAR = new Date().getFullYear();

function parseYear(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= CURRENT_YEAR
    ? parsed
    : CURRENT_YEAR;
}

function yearStart(year: number): string {
  return `${String(year).padStart(4, '0')}-01-01`;
}

function yearEnd(year: number): string {
  return `${String(year).padStart(4, '0')}-12-31`;
}

function queryEndDate(year: number): string {
  const endDate = yearEnd(year);
  const today = new Date().toISOString().slice(0, 10);

  return endDate > today ? today : endDate;
}

function formatHours(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '--';
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function formatQuality(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(1)}/5` : '--';
}

function formatTrend(value: YearReview['improvementMetric']['trend']): string {
  if (value === 'improved') return 'Improved';
  if (value === 'declined') return 'Declined';
  return 'Stable';
}

function formatStreak(streak: YearReviewLongestStreak): string {
  return streak.count > 0 ? `${streak.count} nights` : 'No streak yet';
}

function formatStreakType(value: YearReviewLongestStreak['type']): string {
  return value === 'none'
    ? 'Streak'
    : value
        .split('_')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' ');
}

function qualityFill(month: YearReviewMonthStats): string {
  if (month.avgQuality === null) {
    return 'rgba(255,255,255,0.05)';
  }

  const alpha = 0.12 + ((month.avgQuality - 1) / 4) * 0.36;
  return `rgba(167,139,250,${alpha.toFixed(2)})`;
}

export default async function SleepYearReviewPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: rawYear } = await params;
  const year = parseYear(rawYear);
  const adapter = getAdapter();
  const entries = listEntries(adapter, {
    startDate: yearStart(year - 1),
    endDate: queryEndDate(year),
    limit: 500,
  });
  const dreams = listDreams(adapter, {
    startDate: yearStart(year - 1),
    endDate: queryEndDate(year),
    limit: 500,
  });
  const naps = listNaps(adapter, {
    startDate: yearStart(year - 1),
    endDate: queryEndDate(year),
  });
  const streakHistory = SLEEP_STREAK_TYPES.flatMap((type) =>
    getStreakHistory(adapter, type),
  );
  const review = generateYearReview(year, {
    entries,
    dreams,
    naps,
    streakHistory,
    targetHours: readSleepTargetHours(adapter),
  });
  const populatedMonths = review.monthlyStats.filter(
    (month) => month.totalNights > 0,
  );

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Year in Review</p>
          <h2 style={styles.heroTitle}>{year} MySleep review</h2>
        </div>
        <p style={styles.body}>
          {review.totalNights > 0
            ? `${review.totalNights} logged nights, ${formatHours(review.totalHoursSlept)} asleep, and a ${formatQuality(review.averageQuality)} average quality.`
            : 'Your annual review will build from the sleep you have logged so far.'}
        </p>
        <div style={styles.ctaRow}>
          <Link href="/sleep/log" style={styles.primaryLink}>
            Log Sleep
          </Link>
          <a href="#share-card" style={styles.secondaryLink}>
            Share Card
          </a>
        </div>
      </section>

      <section style={styles.metricGrid}>
        <Metric label="Total hours" value={formatHours(review.totalHoursSlept)} />
        <Metric label="Total nights" value={String(review.totalNights)} />
        <Metric label="Avg duration" value={formatHours(review.averageDuration)} />
        <Metric label="Avg quality" value={formatQuality(review.averageQuality)} />
      </section>

      <section style={styles.twoColumn}>
        <div style={styles.card}>
          <p style={styles.eyebrow}>Month highlights</p>
          <h3 style={styles.cardTitle}>Best and hardest months</h3>
          <MonthHighlight
            label="Best"
            month={review.bestMonth.label ?? '--'}
            quality={formatQuality(review.bestMonth.avgQuality)}
            duration={formatHours(review.bestMonth.avgDuration)}
          />
          <MonthHighlight
            label="Hardest"
            month={review.worstMonth.label ?? '--'}
            quality={formatQuality(review.worstMonth.avgQuality)}
            duration={formatHours(review.worstMonth.avgDuration)}
          />
        </div>

        <div style={styles.card}>
          <p style={styles.eyebrow}>Consistency</p>
          <h3 style={styles.cardTitle}>
            {Math.round(review.consistencyScore)} consistency score
          </h3>
          <StatRow label="Sleep debt" value={formatHours(review.sleepDebtTotal)} />
          <StatRow
            label={formatStreakType(review.longestStreak.type)}
            value={formatStreak(review.longestStreak)}
          />
          <StatRow
            label="Trend"
            value={`${formatTrend(review.improvementMetric.trend)} quality`}
          />
        </div>
      </section>

      <section style={styles.card}>
        <p style={styles.eyebrow}>Monthly quality</p>
        <h3 style={styles.cardTitle}>{populatedMonths.length} active months</h3>
        <div style={styles.heatmapGrid}>
          {review.monthlyStats.map((month) => (
            <div
              key={month.month}
              style={{
                ...styles.monthTile,
                background: qualityFill(month),
              }}
            >
              <span style={styles.monthLabel}>{month.label.slice(0, 3)}</span>
              <strong style={styles.monthValue}>
                {month.avgQuality === null ? '--' : month.avgQuality.toFixed(1)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.twoColumn}>
        <div style={styles.card}>
          <p style={styles.eyebrow}>Dreams and naps</p>
          <h3 style={styles.cardTitle}>
            {review.dreamStats.total} dreams and {review.totalNaps} naps
          </h3>
          <StatRow label="Lucid dreams" value={String(review.dreamStats.lucidCount)} />
          <StatRow label="Nightmares" value={String(review.dreamStats.nightmareCount)} />
          <StatRow
            label="Common emotion"
            value={review.dreamStats.mostCommonEmotion ?? '--'}
          />
          <div style={styles.tagRow}>
            {review.dreamStats.topThemes.length > 0
              ? review.dreamStats.topThemes.map((theme) => (
                  <span key={theme.theme} style={styles.tag}>
                    {theme.theme} x{theme.count}
                  </span>
                ))
              : <span style={styles.emptyText}>No dream themes logged.</span>}
          </div>
        </div>

        <div style={styles.card}>
          <p style={styles.eyebrow}>Quality arc</p>
          <h3 style={styles.cardTitle}>
            {formatTrend(review.improvementMetric.trend)}
          </h3>
          <StatRow
            label="Start"
            value={formatQuality(review.improvementMetric.startQuality)}
          />
          <StatRow
            label="End"
            value={formatQuality(review.improvementMetric.endQuality)}
          />
          <StatRow
            label="Last year"
            value={
              review.comparison
                ? `${review.comparison.averageQualityDelta?.toFixed(1) ?? '0.0'} quality`
                : 'Not enough data'
            }
          />
        </div>
      </section>

      <section style={styles.card}>
        <p style={styles.eyebrow}>Fun facts</p>
        <div style={styles.factGrid}>
          {review.funFacts.map((fact) => (
            <p key={fact} style={styles.factText}>
              {fact}
            </p>
          ))}
        </div>
      </section>

      <section id="share-card" style={styles.shareSection}>
        <div style={styles.shareCard}>
          <p style={styles.shareEyebrow}>MySleep</p>
          <h3 style={styles.shareTitle}>{year} Year in Review</h3>
          <div style={styles.shareStats}>
            <ShareStat
              label="Total hours"
              value={formatHours(review.totalHoursSlept)}
            />
            <ShareStat
              label="Average quality"
              value={formatQuality(review.averageQuality)}
            />
            <ShareStat label="Best streak" value={formatStreak(review.longestStreak)} />
            <ShareStat label="Dream count" value={String(review.dreamStats.total)} />
          </div>
        </div>
      </section>
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

function MonthHighlight({
  label,
  month,
  quality,
  duration,
}: {
  label: string;
  month: string;
  quality: string;
  duration: string;
}) {
  return (
    <div style={styles.monthHighlight}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.monthHighlightTitle}>{month}</strong>
      <span style={styles.monthHighlightMeta}>
        {quality} quality, {duration} average
      </span>
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

function ShareStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.shareStat}>
      <span style={styles.shareStatLabel}>{label}</span>
      <strong style={styles.shareStatValue}>{value}</strong>
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
    gap: 14,
    padding: 24,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.30)',
    background: 'rgba(167,139,250,0.12)',
  },
  eyebrow: {
    margin: 0,
    color: LAVENDER,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 34,
    lineHeight: 1.1,
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryLink: {
    borderRadius: 999,
    background: '#A78BFA',
    color: '#0A0A0F',
    padding: '11px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  secondaryLink: {
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.32)',
    background: 'rgba(167,139,250,0.12)',
    color: '#E9DDFF',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
  },
  metricCard: {
    display: 'grid',
    gap: 8,
    padding: 18,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 28,
    lineHeight: 1.1,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'grid',
    gap: 13,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 23,
    lineHeight: 1.2,
  },
  monthHighlight: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  monthHighlightTitle: {
    color: 'var(--text)',
    fontSize: 19,
  },
  monthHighlightMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '9px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
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
  heatmapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))',
    gap: 9,
  },
  monthTile: {
    display: 'grid',
    gap: 16,
    minHeight: 72,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  monthLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
  },
  monthValue: {
    color: 'var(--text)',
    fontSize: 20,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.32)',
    background: 'rgba(167,139,250,0.14)',
    color: '#E9DDFF',
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 800,
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  factGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 10,
  },
  factText: {
    margin: 0,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.55,
  },
  shareSection: {
    display: 'grid',
    justifyItems: 'center',
  },
  shareCard: {
    width: 'min(380px, 100%)',
    aspectRatio: '9 / 16',
    display: 'grid',
    alignContent: 'space-between',
    gap: 20,
    padding: 30,
    borderRadius: 28,
    border: '1px solid rgba(167,139,250,0.44)',
    background: '#0A0A0F',
    boxShadow: '0 24px 80px rgba(167,139,250,0.16)',
  },
  shareEyebrow: {
    margin: 0,
    color: LAVENDER,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  shareTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 42,
    lineHeight: 1.08,
  },
  shareStats: {
    display: 'grid',
    gap: 12,
  },
  shareStat: {
    display: 'grid',
    gap: 6,
    padding: 15,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.06)',
  },
  shareStatLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  shareStatValue: {
    color: 'var(--text)',
    fontSize: 28,
    lineHeight: 1.15,
  },
};
