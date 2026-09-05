import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  formatDurationLabel,
  getNapSummary,
  listEntries,
  listNaps,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatNapTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16);
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatNumber(value: number | null): string {
  return typeof value === 'number' ? value.toFixed(1) : '--';
}

export default function SleepNapsPage() {
  const adapter = getAdapter();
  const naps = listNaps(adapter, {
    startDate: '1900-01-01',
    endDate: todayDate(),
  });
  const entries = listEntries(adapter, { limit: 500 });
  const summary = getNapSummary(naps, entries);
  const recentTrend = summary.durationTrend.slice(-7).reverse();
  const recentNaps = naps.slice(0, 30);

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Nap Tracking</p>
        <h2 style={styles.heroTitle}>Quick rests, separate from nights.</h2>
        <p style={styles.body}>
          Track intentional and accidental naps, watch duration trends, and
          compare next-night sleep quality after nap days.
        </p>
        <div style={styles.ctaRow}>
          <Link href="/sleep/naps/log" style={styles.primaryLink}>
            Log Nap
          </Link>
          <Link href="/sleep/hygiene" style={styles.secondaryLink}>
            Hygiene
          </Link>
        </div>
      </section>

      <section style={styles.metricGrid}>
        <Metric label="Total naps" value={String(summary.totalNaps)} />
        <Metric label="Total rest" value={formatDurationLabel(summary.totalMinutes)} />
        <Metric
          label="Avg duration"
          value={
            summary.averageDuration
              ? `${Math.round(summary.averageDuration)}m`
              : '--'
          }
        />
        <Metric label="Avg quality" value={`${formatNumber(summary.averageQuality)}/5`} />
      </section>

      <section style={styles.twoColumn}>
        <div style={styles.panel}>
          <p style={styles.eyebrow}>Nap impact</p>
          <h3 style={styles.panelTitle}>
            {summary.impactInsight.status === 'reportable'
              ? 'Next-night quality comparison'
              : 'Keep logging to compare'}
          </h3>
          <p style={styles.body}>{summary.impactInsight.insight}</p>
          <StatRow
            label="Nap-night sample"
            value={String(summary.impactInsight.napNightSampleSize)}
          />
          <StatRow
            label="Non-nap sample"
            value={String(summary.impactInsight.noNapNightSampleSize)}
          />
          <StatRow
            label="Quality delta"
            value={
              summary.impactInsight.qualityDelta === null
                ? '--'
                : summary.impactInsight.qualityDelta.toFixed(1)
            }
          />
        </div>

        <div style={styles.panel}>
          <p style={styles.eyebrow}>Duration trend</p>
          <h3 style={styles.panelTitle}>Recent nap days</h3>
          {recentTrend.length > 0 ? (
            <div style={styles.statStack}>
              {recentTrend.map((point) => (
                <StatRow
                  key={point.date}
                  label={point.date}
                  value={`${point.count} nap${point.count === 1 ? '' : 's'} - ${Math.round(point.averageDuration)}m avg`}
                />
              ))}
            </div>
          ) : (
            <p style={styles.body}>Log a nap to start the duration trend.</p>
          )}
        </div>
      </section>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>History</p>
        <h3 style={styles.panelTitle}>{recentNaps.length} recent naps</h3>
        {recentNaps.length > 0 ? (
          <div style={styles.napList}>
            {recentNaps.map((nap) => (
              <div key={nap.id} style={styles.napRow}>
                <div>
                  <strong style={styles.napDate}>{nap.date}</strong>
                  <p style={styles.napMeta}>
                    {formatNapTime(nap.start_time)} - {nap.duration_minutes}m
                  </p>
                </div>
                <div style={styles.napAside}>
                  <span>{nap.intentional ? 'Intentional' : 'Accidental'}</span>
                  <span>{nap.quality ? `${nap.quality}/5` : 'No quality'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.body}>
            No naps logged yet. The log page is tuned for a fast first entry.
          </p>
        )}
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
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
  statStack: {
    display: 'grid',
    gap: 8,
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
  napList: {
    display: 'grid',
    gap: 10,
  },
  napRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  napDate: {
    color: 'var(--text)',
  },
  napMeta: {
    margin: '4px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  napAside: {
    display: 'grid',
    gap: 6,
    justifyItems: 'end',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
  },
};
