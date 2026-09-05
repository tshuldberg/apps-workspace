'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  LAUNCH_LEAGUES,
  type LeagueId,
  type StandingGroup,
} from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../_ui';

const REFRESH_INTERVAL_MS = 30 * 60 * 1_000;

type Props = {
  initialLeague: LeagueId;
  initialGroups: StandingGroup[];
  followedIds: string[];
  loadAction: (league: LeagueId) => Promise<StandingGroup[]>;
};

export function StandingsClient({
  initialLeague,
  initialGroups,
  followedIds,
  loadAction,
}: Props) {
  const [league, setLeague] = useState<LeagueId>(initialLeague);
  const [groups, setGroups] = useState<StandingGroup[]>(initialGroups);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const followedSet = new Set(followedIds);

  const load = useCallback(
    async (target: LeagueId) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const next = await loadAction(target);
        setGroups(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load standings');
      } finally {
        pendingRef.current = false;
        setIsLoading(false);
      }
    },
    [loadAction],
  );

  // Switch league -> fetch.
  useEffect(() => {
    if (league === initialLeague && groups === initialGroups) return;
    void load(league);
    // Only react to league changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  // visibilitychange: refresh when the tab becomes visible again.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void load(league);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [league, load]);

  // Long-cadence interval (standings are slow-moving; 30min cadence).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(league);
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [league, load]);

  return (
    <section style={sportsStyles.panel}>
      <p style={sportsStyles.eyebrow}>Standings</p>
      <h2 style={sportsStyles.title}>League tables</h2>
      <p style={sportsStyles.body}>
        Conference and division records across the NFL, NBA, MLB, NHL, and MLS.
        Followed teams are highlighted.
      </p>

      <div style={chipRowStyle}>
        {LAUNCH_LEAGUES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLeague(l.id)}
            aria-pressed={league === l.id}
            style={league === l.id ? chipActiveStyle : chipStyle}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={() => void load(league)}
          disabled={isLoading}
          style={refreshBtnStyle}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
        {error ? <span style={errorTextStyle}>{error}</span> : null}
        <Link href="/sports/teams" style={linkStyle}>
          Back to teams
        </Link>
      </div>

      {groups.length === 0 && !isLoading && !error ? (
        <p style={hintTextStyle}>
          No standings available for {league.toUpperCase()} right now.
        </p>
      ) : null}

      {groups.map((g) => (
        <div
          key={`${g.conference ?? ''}|${g.division ?? ''}`}
          style={groupStyle}
        >
          <h3 style={groupHeaderStyle}>
            {g.division ?? g.conference ?? league.toUpperCase()}
          </h3>
          <div style={tableHeaderStyle}>
            <span style={{ ...colTeam, ...headerCellStyle }}>Team</span>
            <span style={{ ...colRecord, ...headerCellStyle }}>W-L-T</span>
            <span style={{ ...colPct, ...headerCellStyle }}>PCT</span>
          </div>
          {g.rows.map((row) => {
            const isFollowed = followedSet.has(row.teamId);
            return (
              <Link
                key={row.teamId}
                href={`/sports/team/${encodeURIComponent(row.teamId)}`}
                style={isFollowed ? rowFollowedStyle : rowStyle}
              >
                <span style={colTeam}>
                  <span
                    style={{
                      ...teamNameStyle,
                      color: isFollowed ? SPORTS_ACCENT : 'var(--text)',
                    }}
                  >
                    {row.teamAbbreviation ? `${row.teamAbbreviation} · ` : ''}
                    {row.teamName}
                  </span>
                  {row.streak ? (
                    <span style={metaStyle}>Streak: {row.streak}</span>
                  ) : null}
                </span>
                <span style={{ ...colRecord, ...numStyle }}>
                  {row.wins}-{row.losses}
                  {row.ties > 0 ? `-${row.ties}` : ''}
                </span>
                <span style={{ ...colPct, ...numStyle }}>
                  {row.winPct.toFixed(3).replace(/^0/, '')}
                </span>
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

const linkStyle: CSSProperties = {
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
  gap: 6,
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

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 14px',
};

const headerCellStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const colTeam: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column' };
const colRecord: CSSProperties = { width: 80, textAlign: 'right' as const };
const colPct: CSSProperties = { width: 60, textAlign: 'right' as const };

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 12,
  borderRadius: 10,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  textDecoration: 'none',
};

const rowFollowedStyle: CSSProperties = {
  ...rowStyle,
  borderColor: SPORTS_ACCENT,
  background: 'rgba(22,163,74,0.08)',
};

const teamNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
};

const metaStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  marginTop: 2,
};

const numStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 700,
};
