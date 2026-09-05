import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  sportsGetPersonalBestsAcrossSports,
  sportsListRecentSessions,
  type SportsPersonalBestEntry,
} from '../actions';
import { SPORTS_ACCENT } from '../_ui';
import type { ParticipationSession } from '@mylife/sports';

export const dynamic = 'force-dynamic';

const SPORT_ICON: Record<string, string> = {
  basketball: '🏀',
  soccer: '⚽️',
  tennis: '🎾',
  golf: '⛳️',
  running: '🏃',
  volleyball: '🏐',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins <= 0) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function SportsPlayPage() {
  const listResult = await sportsListRecentSessions(20);
  const pbResult = await sportsGetPersonalBestsAcrossSports();

  const sessions: ParticipationSession[] =
    listResult.ok ? listResult.sessions : [];
  const pbs: SportsPersonalBestEntry[] = pbResult.ok ? pbResult.entries : [];
  const listError = !listResult.ok ? listResult.error : null;

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Play</p>
      <h2 style={styles.title}>Your sports life</h2>
      <p style={styles.subtitle}>
        Log pickup games, practice, and personal records. Stats stay on-device.
      </p>

      <Link href="/sports/play/log" style={styles.primaryLink}>
        Log session
      </Link>

      <Link href="/sports/play/leagues" style={styles.leaguesLink}>
        <span style={styles.leaguesLinkText}>Rec leagues</span>
        <span style={styles.leaguesLinkChev}>›</span>
      </Link>

      {pbs.length > 0 ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Personal bests</p>
          <div style={styles.pbRow}>
            {pbs.map((entry) => (
              <Link
                key={entry.sport}
                href={`/sports/play/${encodeURIComponent(entry.latest.id)}`}
                style={styles.pbCard}
              >
                <span style={styles.pbIcon}>
                  {SPORT_ICON[entry.sport] ?? '🏟️'}
                </span>
                <span style={styles.pbSport}>{entry.sport}</span>
                <span style={styles.pbCount}>
                  {entry.count} PB{entry.count === 1 ? '' : 's'}
                </span>
                <span style={styles.pbDate}>
                  {formatDate(entry.latest.started_at)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.block}>
        <p style={styles.blockLabel}>
          Recent sessions {sessions.length > 0 ? `(${sessions.length})` : ''}
        </p>
        {listError ? (
          <p style={styles.error}>Error: {listError}</p>
        ) : sessions.length === 0 ? (
          <div style={styles.emptyCard}>
            <p style={styles.emptyText}>
              No sessions yet. Tap Log Session to record your first pickup
              game.
            </p>
          </div>
        ) : (
          <div style={styles.sessionList}>
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/sports/play/${encodeURIComponent(s.id)}`}
                style={styles.sessionRow}
              >
                <span style={styles.sessionIcon}>
                  {SPORT_ICON[s.sport] ?? '🏟️'}
                </span>
                <span style={styles.sessionBody}>
                  <span style={styles.sessionHead}>
                    <span style={styles.sessionSport}>{s.sport}</span>
                    <span style={styles.sessionActivity}>{s.activity}</span>
                    {s.personal_best ? (
                      <span style={styles.pbBadge}>PB</span>
                    ) : null}
                  </span>
                  <span style={styles.sessionMeta}>
                    {formatDate(s.started_at)}
                    {s.duration_minutes
                      ? ` · ${formatDuration(s.duration_minutes)}`
                      : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
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
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    color: 'var(--text)',
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  primaryLink: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
  leaguesLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
    color: 'var(--text)',
  },
  leaguesLinkText: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  },
  leaguesLinkChev: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  block: {
    display: 'grid',
    gap: 10,
    marginTop: 8,
  },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  pbRow: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  pbCard: {
    display: 'grid',
    gap: 4,
    minWidth: 150,
    padding: 14,
    borderRadius: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
  },
  pbIcon: {
    fontSize: 22,
  },
  pbSport: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  pbCount: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 700,
  },
  pbDate: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  sessionList: {
    display: 'grid',
    gap: 8,
  },
  sessionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
  },
  sessionIcon: {
    fontSize: 22,
  },
  sessionBody: {
    display: 'grid',
    gap: 2,
    flex: 1,
  },
  sessionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sessionSport: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  sessionActivity: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  sessionMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  pbBadge: {
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  emptyText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  error: {
    margin: 0,
    color: '#F87171',
    fontSize: 13,
  },
};
