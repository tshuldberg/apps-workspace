import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { METRICS_BY_SPORT } from '@mylife/sports';
import { sportsGetSession } from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';
import { SessionActionsClient } from './SessionActionsClient';

export const dynamic = 'force-dynamic';

function formatMetricLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatValue(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

type Params = Promise<{ id: string }>;

export default async function SportsPlaySessionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const result = await sportsGetSession(id);
  if (!result.ok) {
    notFound();
  }
  const { session, pb } = result;

  const presetLookup = new Set(
    (METRICS_BY_SPORT[session.sport] ?? []).map((m) => m.name),
  );
  const pbByMetric = new Map(pb.breakdowns.map((b) => [b.metric, b]));
  const statEntries = Object.entries(session.stats);

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>{session.activity}</p>
      <div style={styles.titleRow}>
        <h2 style={styles.title}>{session.sport}</h2>
        {pb.isPB ? <span style={styles.pbBadge}>PB</span> : null}
      </div>

      <div style={styles.metaCard}>
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Played at</span>
          <span style={styles.metaValue}>
            {formatDateTime(session.started_at)}
          </span>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Duration</span>
          <span style={styles.metaValue}>
            {formatDuration(session.duration_minutes)}
          </span>
        </div>
      </div>

      {statEntries.length > 0 ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Stats</p>
          <div style={styles.statList}>
            {statEntries.map(([key, value]) => {
              const breakdown = pbByMetric.get(key);
              const isPreset = presetLookup.has(key);
              const improved = breakdown?.improved ?? false;
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statLabel}>
                    {formatMetricLabel(key)}
                  </span>
                  <span style={styles.statValueWrap}>
                    <span style={styles.statValue}>
                      {formatValue(Number(value))}
                    </span>
                    {isPreset && improved ? (
                      <span style={styles.newBestBadge}>new best</span>
                    ) : null}
                    {isPreset &&
                    !improved &&
                    breakdown?.previousBest !== null &&
                    breakdown?.previousBest !== undefined ? (
                      <span style={styles.prevBest}>
                        prev {formatValue(breakdown.previousBest)}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {session.notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Notes</p>
          <div style={styles.notesCard}>
            <p style={styles.notesText}>{session.notes_md}</p>
          </div>
        </section>
      ) : null}

      <div style={styles.actionRow}>
        <SessionActionsClient id={session.id} />
        <Link
          href={`/sports/play/log?editId=${encodeURIComponent(session.id)}`}
          style={styles.primaryLink}
        >
          Edit
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#4ADE80',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 800,
    color: 'var(--text)',
    textTransform: 'capitalize',
  },
  pbBadge: {
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
  },
  metaCard: {
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    display: 'grid',
    gap: 8,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: 'var(--text)',
    fontSize: 14,
  },
  block: { display: 'grid', gap: 10 },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  statList: {
    display: 'grid',
    gap: 8,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  statLabel: {
    color: 'var(--text)',
    fontSize: 14,
  },
  statValueWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    color: 'var(--text)',
    fontSize: 18,
    fontWeight: 800,
  },
  newBestBadge: {
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  prevBest: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  notesCard: {
    padding: 14,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  notesText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  actionRow: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
};
