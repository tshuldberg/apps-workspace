import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  sportsGetUpcomingRecGames,
  sportsListRecLeagues,
  type SportsUpcomingRecGame,
} from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';
import type { RecLeague, ScheduleEntry } from '@mylife/sports';

export const dynamic = 'force-dynamic';

const SPORT_ICON: Record<string, string> = {
  basketball: '🏀',
  soccer: '⚽️',
  softball: '🥎',
  baseball: '⚾️',
  volleyball: '🏐',
  hockey: '🏒',
  tennis: '🎾',
  running: '🏃',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function nextGame(league: RecLeague, nowMs: number): ScheduleEntry | null {
  const upcoming = league.schedule
    .filter((e) => e.starts_at > nowMs)
    .slice()
    .sort((a, b) => a.starts_at - b.starts_at);
  return upcoming[0] ?? null;
}

export default async function SportsRecLeaguesListPage() {
  const now = Date.now();
  const [listResult, upcomingResult] = await Promise.all([
    sportsListRecLeagues(),
    sportsGetUpcomingRecGames(now, 5),
  ]);
  const leagues: RecLeague[] = listResult.ok ? listResult.leagues : [];
  const upcoming: SportsUpcomingRecGame[] = upcomingResult.ok
    ? upcomingResult.games
    : [];
  const error = !listResult.ok ? listResult.error : null;

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Rec leagues</p>
      <h2 style={styles.title}>Your seasons</h2>
      <p style={styles.subtitle}>
        Track rec-league games, record, and upcoming matchups. Private to this device.
      </p>

      <Link href="/sports/play/leagues/add" style={styles.primaryLink}>
        Add league
      </Link>

      {upcoming.length > 0 ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Upcoming games</p>
          <div style={styles.stripRow}>
            {upcoming.map((row, idx) => (
              <Link
                key={`${row.league.id}-${idx}`}
                href={`/sports/play/leagues/${encodeURIComponent(row.league.id)}`}
                style={styles.stripCard}
              >
                <span style={styles.stripIcon}>
                  {SPORT_ICON[row.league.sport] ?? '🏟️'}
                </span>
                <span style={styles.stripOpp}>vs {row.entry.opponent}</span>
                <span style={styles.stripLeague}>
                  {row.league.league_name}
                </span>
                <span style={styles.stripDate}>
                  {formatDate(row.entry.starts_at)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.block}>
        <p style={styles.blockLabel}>Leagues</p>
        {error ? (
          <p style={styles.error}>Error: {error}</p>
        ) : leagues.length === 0 ? (
          <div style={styles.emptyCard}>
            <p style={styles.emptyText}>
              No rec leagues yet. Tap Add league to start tracking your season.
            </p>
          </div>
        ) : (
          <div style={styles.leagueList}>
            {leagues.map((league) => {
              const next = nextGame(league, now);
              return (
                <Link
                  key={league.id}
                  href={`/sports/play/leagues/${encodeURIComponent(league.id)}`}
                  style={styles.leagueRow}
                >
                  <span style={styles.leagueIcon}>
                    {SPORT_ICON[league.sport] ?? '🏟️'}
                  </span>
                  <span style={styles.leagueBody}>
                    <span style={styles.leagueName}>{league.league_name}</span>
                    <span style={styles.leagueMeta}>
                      {league.team_name} · {league.season}
                    </span>
                    <span style={styles.leagueRecord}>
                      {league.record_wins}-{league.record_losses}-
                      {league.record_ties}
                      {next ? ` · next ${formatDate(next.starts_at)}` : ''}
                    </span>
                  </span>
                </Link>
              );
            })}
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
    color: SPORTS_ACCENT,
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
  block: { display: 'grid', gap: 10, marginTop: 8 },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  stripRow: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  stripCard: {
    display: 'grid',
    gap: 4,
    minWidth: 170,
    padding: 14,
    borderRadius: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
  },
  stripIcon: { fontSize: 22 },
  stripOpp: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
  },
  stripLeague: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: 700,
  },
  stripDate: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  leagueList: { display: 'grid', gap: 8 },
  leagueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
  },
  leagueIcon: { fontSize: 24 },
  leagueBody: { display: 'grid', gap: 2, flex: 1 },
  leagueName: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
  },
  leagueMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  leagueRecord: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 700,
    marginTop: 2,
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
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
