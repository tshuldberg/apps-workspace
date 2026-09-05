'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import type { Game, Team } from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../_ui';
import { sportsGetHistory } from '../actions';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_OPTIONS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

type Props = {
  initialGames: Game[];
  initialTeams: Team[];
  initialRange: number;
  initialTeamId: string | null;
};

type BadgeSpec = { label: 'W' | 'L' | 'D' | '—'; color: string };

function resultFor(
  game: Game,
  teamSet: ReadonlySet<string>,
): BadgeSpec | null {
  if (game.status !== 'final') return null;
  const homeId = game.home.id ?? null;
  const awayId = game.away.id ?? null;
  const side: 'home' | 'away' | null =
    homeId && teamSet.has(homeId)
      ? 'home'
      : awayId && teamSet.has(awayId)
        ? 'away'
        : null;
  if (!side) return null;
  const hs = game.home.score ?? null;
  const as = game.away.score ?? null;
  if (hs === null || as === null) return { label: '—', color: '#9F8E81' };
  if (hs === as) return { label: 'D', color: '#9F8E81' };
  const home = side === 'home';
  const won = home ? hs > as : as > hs;
  return won
    ? { label: 'W', color: SPORTS_ACCENT }
    : { label: 'L', color: '#E57373' };
}

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
  const keys = Array.from(groups.keys()).sort().reverse();
  return keys.map((key) => {
    const items = groups.get(key)!.sort((a, b) => b.startAt - a.startAt);
    const d = new Date(items[0].startAt);
    const label = d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return { key, label, items };
  });
}

function normalizeRange(n: number): RangeDays {
  if (n <= 7) return 7;
  if (n <= 30) return 30;
  return 90;
}

export function HistoryClient({
  initialGames,
  initialTeams,
  initialRange,
  initialTeamId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [games, setGames] = useState<Game[]>(initialGames);
  const [range, setRange] = useState<RangeDays>(normalizeRange(initialRange));
  const [error, setError] = useState<string | null>(null);

  const teamIdFilter = initialTeamId;

  const activeIds = useMemo(() => {
    if (!teamIdFilter) return initialTeams.map((t) => t.id);
    return initialTeams
      .filter(
        (t) => t.id === teamIdFilter || t.id.endsWith(`:${teamIdFilter}`),
      )
      .map((t) => t.id);
  }, [initialTeams, teamIdFilter]);

  const teamSet = useMemo(() => new Set(activeIds), [activeIds]);

  const reload = useCallback(
    (nextRange: RangeDays) => {
      setError(null);
      setRange(nextRange);
      const now = Date.now();
      const since = now - nextRange * DAY_MS;
      startTransition(async () => {
        try {
          const data = await sportsGetHistory(
            since,
            now,
            teamIdFilter ? [teamIdFilter] : undefined,
          );
          setGames(data.games);
          // Update URL to reflect range + teamId.
          const params = new URLSearchParams(searchParams?.toString() ?? '');
          params.set('range', String(nextRange));
          if (teamIdFilter) params.set('teamId', teamIdFilter);
          router.replace(`/sports/history?${params.toString()}`, {
            scroll: false,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to refresh');
        }
      });
    },
    [router, searchParams, teamIdFilter],
  );

  const grouped = useMemo(() => groupByDateKey(games), [games]);

  if (initialTeams.length === 0) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>History</p>
        <h2 style={sportsStyles.title}>Past games</h2>
        <p style={sportsStyles.body}>
          Follow a team to see your scores history.
        </p>
        <Link href="/sports/teams" style={sportsStyles.primaryLink}>
          Follow your first team
        </Link>
      </section>
    );
  }

  return (
    <section style={sportsStyles.panel}>
      <p style={sportsStyles.eyebrow}>History</p>
      <h2 style={sportsStyles.title}>Past games</h2>
      <p style={sportsStyles.body}>
        Final scores for every team you follow
        {teamIdFilter ? ' (filtered to one team)' : ''}.
      </p>

      <div style={chipRowStyle}>
        {RANGE_OPTIONS.map((n) => {
          const active = range === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => reload(n)}
              aria-pressed={active}
              disabled={isPending}
              style={active ? chipActiveStyle : chipStyle}
            >
              Last {n} days
            </button>
          );
        })}
      </div>

      <div style={actionRowStyle}>
        {isPending ? <span style={hintTextStyle}>Loading…</span> : null}
        {error ? <span style={errorTextStyle}>{error}</span> : null}
        <Link href="/sports" style={backLinkStyle}>
          Back to scores
        </Link>
        <Link href="/sports/schedule" style={backLinkStyle}>
          Upcoming schedule
        </Link>
      </div>

      {grouped.length === 0 && !isPending ? (
        <p style={hintTextStyle}>
          No final scores in this window yet. Try widening the range.
        </p>
      ) : null}

      {grouped.map((group) => (
        <div key={group.key} style={groupStyle}>
          <h3 style={groupHeaderStyle}>{group.label}</h3>
          {group.items.map((g) => {
            const badge = resultFor(g, teamSet);
            return (
              <Link
                key={g.id}
                href={`/sports/game/${encodeURIComponent(g.id)}?league=${g.league}`}
                style={cardStyle}
              >
                <div style={cardHeaderStyle}>
                  <span style={leagueTextStyle}>
                    {g.league.toUpperCase()}
                  </span>
                  <span style={statusTextStyle}>Final</span>
                </div>
                <div style={teamRowStyle}>
                  <span style={teamNameStyle}>{g.away.name}</span>
                  <span style={scoreTextStyle}>{g.away.score ?? '—'}</span>
                </div>
                <div style={teamRowStyle}>
                  <span style={teamNameStyle}>{g.home.name}</span>
                  <span style={scoreTextStyle}>{g.home.score ?? '—'}</span>
                </div>
                {badge ? (
                  <span
                    style={{
                      ...badgeStyle,
                      borderColor: badge.color,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                ) : null}
              </Link>
            );
          })}
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
  flexWrap: 'wrap',
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

const badgeStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '3px 10px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  width: 'fit-content',
};
