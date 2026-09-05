'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { pickInterval, type Game, type Team } from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from './_ui';
import type { SportsScoreboardData } from './actions';

type Props = {
  initial: SportsScoreboardData;
  refreshAction: () => Promise<SportsScoreboardData>;
};

type Grouped = {
  live: Game[];
  upcoming: Game[];
  final: Game[];
};

function groupGames(games: readonly Game[]): Grouped {
  const live: Game[] = [];
  const upcoming: Game[] = [];
  const final: Game[] = [];
  for (const g of games) {
    if (g.status === 'live') live.push(g);
    else if (g.status === 'final') final.push(g);
    else upcoming.push(g);
  }
  live.sort((a, b) => a.startAt - b.startAt);
  upcoming.sort((a, b) => a.startAt - b.startAt);
  final.sort((a, b) => b.startAt - a.startAt);
  return { live, upcoming, final };
}

function formatKickoff(startAt: number): string {
  const d = new Date(startAt);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ScoreboardClient({ initial, refreshAction }: Props) {
  const [followed, setFollowed] = useState<Team[]>(initial.followed);
  const [games, setGames] = useState<Game[]>(initial.games);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsRefreshing(true);
    setError(null);
    try {
      const next = await refreshAction();
      setFollowed(next.followed);
      setGames(next.games);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      pendingRef.current = false;
      setIsRefreshing(false);
    }
  }, [refreshAction]);

  // Initial network refresh after hydration.
  useEffect(() => {
    if (initial.followed.length > 0) {
      void refresh();
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // visibilitychange: refresh when the tab becomes visible again.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'visible' && followed.length > 0) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [followed.length, refresh]);

  // Polling: setInterval driven by pickInterval(games).
  const pollMs = useMemo(() => pickInterval(games), [games]);
  useEffect(() => {
    if (followed.length === 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, pollMs);
    return () => window.clearInterval(id);
  }, [followed.length, pollMs, refresh]);

  const grouped = useMemo(() => groupGames(games), [games]);

  if (followed.length === 0) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Scores</p>
        <h2 style={sportsStyles.title}>Your sports day, in one quiet place</h2>
        <p style={sportsStyles.body}>
          Follow a team to see live scores, upcoming games, and finals without
          ads, sponsored picks, or dark-pattern betting funnels.
        </p>
        <Link href="/sports/teams" style={sportsStyles.primaryLink}>
          Follow your first team
        </Link>
      </section>
    );
  }

  return (
    <div style={layoutStyles.root}>
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Today</p>
        <h2 style={sportsStyles.title}>
          {followed.length === 1
            ? `1 team followed`
            : `${followed.length} teams followed`}
        </h2>
        <p style={sportsStyles.body}>
          Live, upcoming, and final scores for the teams you follow.
        </p>
        <div style={layoutStyles.actionRow}>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            style={layoutStyles.refreshButton}
            aria-label="Refresh scoreboard"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link href="/sports/standings" style={layoutStyles.standingsLink}>
            View standings →
          </Link>
          <Link href="/sports/schedule" style={layoutStyles.standingsLink}>
            View full schedule →
          </Link>
          {error ? <span style={layoutStyles.errorText}>{error}</span> : null}
        </div>
      </section>

      {grouped.live.length > 0 ? (
        <ScoreGroup title="Live" accent games={grouped.live} />
      ) : null}
      {grouped.upcoming.length > 0 ? (
        <ScoreGroup title="Upcoming today" games={grouped.upcoming} />
      ) : null}
      {grouped.final.length > 0 ? (
        <ScoreGroup title="Final" games={grouped.final} />
      ) : null}

      {grouped.live.length === 0 &&
      grouped.upcoming.length === 0 &&
      grouped.final.length === 0 ? (
        <section style={layoutStyles.emptyCard}>
          <p style={sportsStyles.body}>
            No games today for your followed teams. Use refresh to check again.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ScoreGroup({
  title,
  games,
  accent,
}: {
  title: string;
  games: Game[];
  accent?: boolean;
}) {
  return (
    <section style={layoutStyles.group}>
      <h3
        style={{
          ...layoutStyles.groupHeader,
          color: accent ? SPORTS_ACCENT : 'var(--text-secondary)',
        }}
      >
        {title}
      </h3>
      <div style={layoutStyles.grid}>
        {games.map((g) => (
          <ScoreCard key={g.id} game={g} />
        ))}
      </div>
    </section>
  );
}

function ScoreCard({ game }: { game: Game }) {
  const statusLabel =
    game.status === 'live'
      ? game.period ?? 'Live'
      : game.status === 'final'
        ? 'Final'
        : formatKickoff(game.startAt);

  const pillStyle: CSSProperties = {
    ...layoutStyles.statusPill,
    ...(game.status === 'live'
      ? { background: SPORTS_ACCENT, color: '#0E0E13', borderColor: SPORTS_ACCENT }
      : {}),
  };

  return (
    <article style={layoutStyles.card}>
      <header style={layoutStyles.cardHeader}>
        <span style={layoutStyles.leagueText}>{game.league.toUpperCase()}</span>
        <span style={pillStyle}>{statusLabel}</span>
      </header>
      <div style={layoutStyles.teamRow}>
        <span style={layoutStyles.teamName}>{game.away.name}</span>
        <span style={layoutStyles.scoreText}>
          {game.away.score ?? '—'}
        </span>
      </div>
      <div style={layoutStyles.teamRow}>
        <span style={layoutStyles.teamName}>{game.home.name}</span>
        <span style={layoutStyles.scoreText}>
          {game.home.score ?? '—'}
        </span>
      </div>
      {game.status === 'live' && game.clock ? (
        <p style={layoutStyles.smallMeta}>{game.clock}</p>
      ) : null}
      {game.broadcast ? (
        <p style={layoutStyles.smallMeta}>{game.broadcast}</p>
      ) : null}
    </article>
  );
}

const layoutStyles: Record<string, CSSProperties> = {
  root: {
    display: 'grid',
    gap: 20,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  refreshButton: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  standingsLink: {
    color: SPORTS_ACCENT,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  group: {
    display: 'grid',
    gap: 10,
  },
  groupHeader: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  },
  card: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leagueText: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
  },
  statusPill: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  teamRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
  },
  scoreText: {
    color: 'var(--text)',
    fontSize: 18,
    fontWeight: 800,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  smallMeta: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
};
