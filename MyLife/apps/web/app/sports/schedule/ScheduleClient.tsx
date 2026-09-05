'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { Game, Team } from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../_ui';

const REFRESH_INTERVAL_MS = 15 * 60 * 1_000;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

type Props = {
  initialFollowed: Team[];
  initialGames: Game[];
  refreshAction: () => Promise<Game[]>;
};

function groupByDateKey(
  games: readonly Game[],
): Array<{ key: string; label: string; items: Game[] }> {
  const groups = new Map<string, Game[]>();
  for (const g of games) {
    const d = new Date(g.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = groups.get(key) ?? [];
    list.push(g);
    groups.set(key, list);
  }
  const keys = Array.from(groups.keys()).sort();
  return keys.map((key) => {
    const items = groups.get(key)!.sort((a, b) => a.startAt - b.startAt);
    const d = new Date(items[0].startAt);
    const label = d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return { key, label, items };
  });
}

function formatKickoff(startAt: number): string {
  return new Date(startAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ScheduleClient({
  initialFollowed,
  initialGames,
  refreshAction,
}: Props) {
  const [games, setGames] = useState<Game[]>(initialGames);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const next = await refreshAction();
      setGames(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      pendingRef.current = false;
      setIsLoading(false);
    }
  }, [refreshAction]);

  // Initial refresh after hydration
  useEffect(() => {
    if (initialFollowed.length > 0) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      if (
        document.visibilityState === 'visible' &&
        initialFollowed.length > 0
      ) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [initialFollowed.length, refresh]);

  useEffect(() => {
    if (initialFollowed.length === 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [initialFollowed.length, refresh]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = games.filter(
      (g) => g.startAt >= now - WINDOW_MS && g.startAt <= now + WINDOW_MS,
    );
    if (teamFilter) {
      list = list.filter(
        (g) => g.home.id === teamFilter || g.away.id === teamFilter,
      );
    }
    return list;
  }, [games, teamFilter]);

  const grouped = useMemo(() => groupByDateKey(filtered), [filtered]);

  if (initialFollowed.length === 0) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Schedule</p>
        <h2 style={sportsStyles.title}>All upcoming games</h2>
        <p style={sportsStyles.body}>
          Follow a team to see upcoming games in one combined schedule.
        </p>
        <Link href="/sports/teams" style={sportsStyles.primaryLink}>
          Follow your first team
        </Link>
      </section>
    );
  }

  return (
    <section style={sportsStyles.panel}>
      <p style={sportsStyles.eyebrow}>Schedule</p>
      <h2 style={sportsStyles.title}>All upcoming games</h2>
      <p style={sportsStyles.body}>
        Next 30 days across every team you follow. Click a game for the box
        score.
      </p>

      {initialFollowed.length > 1 ? (
        <div style={chipRowStyle}>
          <button
            type="button"
            onClick={() => setTeamFilter(null)}
            aria-pressed={teamFilter === null}
            style={teamFilter === null ? chipActiveStyle : chipStyle}
          >
            All teams
          </button>
          {initialFollowed.map((team) => {
            const externalId = team.id.split(':').pop() ?? team.id;
            const active = teamFilter === externalId;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setTeamFilter(active ? null : externalId)}
                aria-pressed={active}
                style={active ? chipActiveStyle : chipStyle}
              >
                {team.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          style={refreshBtnStyle}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
        {error ? <span style={errorTextStyle}>{error}</span> : null}
        <Link href="/sports" style={backLinkStyle}>
          Back to scores
        </Link>
        <Link href="/sports/history" style={backLinkStyle}>
          View history
        </Link>
      </div>

      {grouped.length === 0 && !isLoading ? (
        <p style={hintTextStyle}>
          No scheduled games in the next 30 days.
        </p>
      ) : null}

      {grouped.map((group) => (
        <div key={group.key} style={groupStyle}>
          <h3 style={groupHeaderStyle}>{group.label}</h3>
          {group.items.map((g) => (
            <Link
              key={g.id}
              href={`/sports/game/${encodeURIComponent(g.id)}?league=${g.league}`}
              style={cardStyle}
            >
              <div style={cardHeaderStyle}>
                <span style={leagueTextStyle}>{g.league.toUpperCase()}</span>
                <span style={statusTextStyle}>
                  {g.status === 'live'
                    ? g.period ?? 'Live'
                    : g.status === 'final'
                      ? 'Final'
                      : formatKickoff(g.startAt)}
                </span>
              </div>
              <div style={teamRowStyle}>
                <span style={teamNameStyle}>{g.away.name}</span>
                <span style={scoreTextStyle}>{g.away.score ?? '—'}</span>
              </div>
              <div style={teamRowStyle}>
                <span style={teamNameStyle}>{g.home.name}</span>
                <span style={scoreTextStyle}>{g.home.score ?? '—'}</span>
              </div>
              {g.broadcast ? (
                <p style={broadcastTextStyle}>{g.broadcast}</p>
              ) : null}
            </Link>
          ))}
        </div>
      ))}
    </section>
  );
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 8,
};

const chipStyle: CSSProperties = {
  padding: '6px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const chipActiveStyle: CSSProperties = {
  ...chipStyle,
  background: SPORTS_ACCENT,
  borderColor: SPORTS_ACCENT,
  color: '#0E0E13',
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 8,
};

const refreshBtnStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
};

const backLinkStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
};

const errorTextStyle: CSSProperties = {
  color: '#F87171',
  fontSize: 13,
};

const hintTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 14,
};

const groupStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 16,
};

const groupHeaderStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  textDecoration: 'none',
};

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const leagueTextStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
};

const statusTextStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
};

const teamRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const teamNameStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 700,
};

const scoreTextStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 800,
  minWidth: 36,
  textAlign: 'right' as const,
};

const broadcastTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 12,
};
