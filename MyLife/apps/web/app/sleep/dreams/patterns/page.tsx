import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  getDreamPatternDashboard,
  listAllDreams,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepPanel } from '../../_ui';

export default function SleepDreamPatternsPage() {
  const adapter = getAdapter();
  const dreams = listAllDreams(adapter);

  if (dreams.length === 0) {
    return (
      <SleepPanel
        eyebrow="Dream Patterns"
        title="Log a few dreams before patterns appear"
        body="Once the archive has entries, this dashboard will surface themes, dream types, recurring loops, and weekly lucid or nightmare trends."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/dreams/log" style={styles.primaryLink}>
            Log Dream
          </Link>
          <Link href="/sleep/dreams" style={styles.secondaryLink}>
            Back to Archive
          </Link>
        </div>
      </SleepPanel>
    );
  }

  const dashboard = getDreamPatternDashboard(dreams);

  return (
    <div style={styles.page}>
      <SleepPanel
        eyebrow="Dream Patterns"
        title="See the themes that repeat when sleep becomes memory"
        body="All patterning is derived locally from the dream archive. No cloud scoring, no black-box sleep claims, just the tags and narratives you already saved."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/dreams/log" style={styles.primaryLink}>
            Log Dream
          </Link>
          <Link href="/sleep/dreams/dictionary" style={styles.secondaryLink}>
            Dream Dictionary
          </Link>
          <Link href="/sleep/dreams" style={styles.secondaryLink}>
            Back to Archive
          </Link>
        </div>
      </SleepPanel>

      <section style={styles.metricGrid}>
        <MetricCard label="Dreams Logged" value={String(dashboard.totalDreams)} detail="Total archive size" />
        <MetricCard
          label="Dreams / Week"
          value={dashboard.dreamsPerWeekAverage.toFixed(1)}
          detail="Average across the recorded date span"
        />
        <MetricCard
          label="Lucid Rate"
          value={`${dashboard.lucidRate.percentage}%`}
          detail={`${dashboard.lucidRate.count} of ${dashboard.lucidRate.total} dreams`}
        />
        <MetricCard
          label="Nightmare Rate"
          value={`${dashboard.nightmareRate.percentage}%`}
          detail={`${dashboard.nightmareRate.count} of ${dashboard.nightmareRate.total} dreams`}
        />
      </section>

      <div style={styles.twoColumn}>
        <SleepPanel
          eyebrow="Type Mix"
          title="Dream type distribution"
          body="A lightweight bar chart keeps type balance readable without leaving the dream archive."
        >
          <div style={styles.barList}>
            {dashboard.typeDistribution
              .filter((item) => item.count > 0)
              .map((item) => (
                <div key={item.type} style={styles.barRow}>
                  <div style={styles.barLabelRow}>
                    <span style={styles.barLabel}>{item.type}</span>
                    <span style={styles.barValue}>
                      {item.count} · {item.percentage}%
                    </span>
                  </div>
                  <div style={styles.barTrack}>
                    <div
                      style={{
                        ...styles.barFill,
                        width: `${Math.max(item.percentage, 6)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </SleepPanel>

        <SleepPanel
          eyebrow="Emotion Mix"
          title="Most common emotions"
          body="Emotion percentages are based on the emotion tags saved across the archive."
        >
          <div style={styles.barList}>
            {dashboard.mostCommonEmotions.map((item) => (
              <div key={item.emotion} style={styles.barRow}>
                <div style={styles.barLabelRow}>
                  <span style={styles.barLabel}>{item.emotion}</span>
                  <span style={styles.barValue}>
                    {item.count} · {item.percentage}%
                  </span>
                </div>
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.emotionFill,
                      width: `${Math.max(item.percentage, 6)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SleepPanel>
      </div>

      <SleepPanel
        eyebrow="Top Themes"
        title="The five themes that appear most often"
        body="Theme frequency is grouped from the tags you already use while logging."
      >
        <div style={styles.themeGrid}>
          {dashboard.topThemes.map((item) => (
            <div key={item.theme} style={styles.themeCard}>
              <strong style={styles.themeTitle}>{item.theme}</strong>
              <span style={styles.themeCount}>{item.count} mentions</span>
            </div>
          ))}
        </div>
      </SleepPanel>

      <SleepPanel
        eyebrow="Weekly Trend"
        title="Lucid and nightmare rates over time"
        body="Weekly buckets keep the trend readable without pretending to be scientific sleep telemetry."
      >
        <div style={styles.trendList}>
          {dashboard.lucidTrend.map((point) => (
            <div key={point.weekStart} style={styles.trendRow}>
              <div style={styles.trendHeader}>
                <strong style={styles.trendLabel}>{point.label}</strong>
                <span style={styles.trendMeta}>{point.totalDreams} dreams</span>
              </div>
              <div style={styles.trendMetric}>
                <span style={styles.trendMetricLabel}>Lucid</span>
                <div style={styles.trendTrack}>
                  <div
                    style={{
                      ...styles.trendFillLucid,
                      width: `${Math.max(point.lucidRate, 4)}%`,
                    }}
                  />
                </div>
                <span style={styles.trendValue}>{point.lucidRate}%</span>
              </div>
              <div style={styles.trendMetric}>
                <span style={styles.trendMetricLabel}>Nightmare</span>
                <div style={styles.trendTrack}>
                  <div
                    style={{
                      ...styles.trendFillNightmare,
                      width: `${Math.max(point.nightmareRate, 4)}%`,
                    }}
                  />
                </div>
                <span style={styles.trendValue}>{point.nightmareRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </SleepPanel>

      <SleepPanel
        eyebrow="Recurring"
        title="Recurring dream groups"
        body="Threads are grouped by the recurring links already attached in the archive."
      >
        {dashboard.recurringGroups.length > 0 ? (
          <div style={styles.recurringGrid}>
            {dashboard.recurringGroups.map((group) => (
              <div key={group.groupId} style={styles.recurringCard}>
                <div style={styles.recurringHeader}>
                  <strong style={styles.recurringTitle}>{group.themes.join(' · ') || 'Recurring thread'}</strong>
                  <span style={styles.recurringPill}>{group.frequency} dreams</span>
                </div>
                <p style={styles.recurringBody}>Last seen {group.lastOccurrence}</p>
                {group.emotions.length > 0 && (
                  <p style={styles.recurringBody}>Typical emotions: {group.emotions.join(', ')}</p>
                )}
                {group.exampleExcerpts.map((excerpt) => (
                  <p key={`${group.groupId}-${excerpt}`} style={styles.recurringExcerpt}>
                    {excerpt}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.emptyCopy}>Recurring groups will appear once multiple dreams share a recurring thread.</p>
        )}
      </SleepPanel>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <strong style={styles.metricValue}>{value}</strong>
      <p style={styles.metricDetail}>{detail}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 16,
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
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
    padding: '11px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  metricCard: {
    display: 'grid',
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#C4B5FD',
  },
  metricValue: {
    fontSize: 32,
    lineHeight: 1,
    letterSpacing: '-0.05em',
    color: 'var(--text)',
  },
  metricDetail: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  twoColumn: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  },
  barList: {
    display: 'grid',
    gap: 12,
  },
  barRow: {
    display: 'grid',
    gap: 8,
  },
  barLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
    textTransform: 'capitalize',
  },
  barValue: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(167,139,250,0.88), rgba(96,165,250,0.88))',
  },
  emotionFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(250,204,21,0.88), rgba(248,113,113,0.88))',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  themeCard: {
    display: 'grid',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  themeTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text)',
    textTransform: 'capitalize',
  },
  themeCount: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  trendList: {
    display: 'grid',
    gap: 14,
  },
  trendRow: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  trendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  trendLabel: {
    fontSize: 15,
    color: 'var(--text)',
  },
  trendMeta: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  trendMetric: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 56px',
    gap: 10,
    alignItems: 'center',
  },
  trendMetricLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  trendTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  trendFillLucid: {
    height: '100%',
    borderRadius: 999,
    background: 'rgba(96,165,250,0.9)',
  },
  trendFillNightmare: {
    height: '100%',
    borderRadius: 999,
    background: 'rgba(248,113,113,0.9)',
  },
  trendValue: {
    fontSize: 13,
    textAlign: 'right',
    color: 'var(--text)',
  },
  recurringGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  recurringCard: {
    display: 'grid',
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  recurringHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recurringTitle: {
    fontSize: 15,
    color: 'var(--text)',
    textTransform: 'capitalize',
  },
  recurringPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text)',
  },
  recurringBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  recurringExcerpt: {
    margin: 0,
    padding: 12,
    borderRadius: 14,
    background: 'rgba(167,139,250,0.1)',
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  emptyCopy: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
