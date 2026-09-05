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
import {
  LAUNCH_LEAGUES,
  type CreateTeamInput,
  type FollowTier,
  type LeagueId,
  type Team,
  type TeamSearchResult,
} from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../_ui';
import { sportsSearchTeams, type SportsMyRecord } from '../actions';

const TIER_LABELS: Record<FollowTier, string> = {
  diehard: 'Die-hard',
  casual: 'Casual',
  occasional: 'Occasional',
};
const TIER_ORDER: FollowTier[] = ['diehard', 'casual', 'occasional'];

type Props = {
  initialFollowed: Team[];
  initialRecords: SportsMyRecord[];
  followAction: (input: CreateTeamInput) => Promise<Team>;
  unfollowAction: (id: string) => Promise<void>;
};

export function TeamsClient({
  initialFollowed,
  initialRecords,
  followAction,
  unfollowAction,
}: Props) {
  const [followed, setFollowed] = useState<Team[]>(initialFollowed);
  const followedIds = useMemo(
    () => new Set(followed.map((t) => t.id)),
    [followed],
  );

  const [query, setQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | null>(null);
  const [results, setResults] = useState<TeamSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server-action search. Each keystroke bumps a request id so
  // stale responses are discarded before they can flash into the UI.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    const rid = ++requestIdRef.current;
    setIsSearching(true);
    setError(null);

    debounceRef.current = setTimeout(() => {
      sportsSearchTeams(trimmed, leagueFilter ? [leagueFilter] : undefined)
        .then((nextResults) => {
          if (rid !== requestIdRef.current) return;
          setResults(nextResults);
          setIsSearching(false);
        })
        .catch((err: unknown) => {
          if (rid !== requestIdRef.current) return;
          setIsSearching(false);
          setError(err instanceof Error ? err.message : 'Search failed');
        });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, leagueFilter]);

  const handleFollow = useCallback(
    async (result: TeamSearchResult) => {
      try {
        const team = await followAction({
          id: result.id,
          name: result.name,
          league: result.league,
          sport: result.sport,
          conference: result.conference ?? null,
          division: result.division ?? null,
          logo_url: result.logoUrl ?? null,
          primary_color: result.primaryColor ?? null,
          secondary_color: result.secondaryColor ?? null,
        });
        setFollowed((prev) => {
          if (prev.some((t) => t.id === team.id)) return prev;
          return [...prev, team];
        });
      } catch (err) {
        console.error('[MySports] follow failed', err);
      }
    },
    [followAction],
  );

  const handleUnfollow = useCallback(
    async (id: string) => {
      try {
        await unfollowAction(id);
        setFollowed((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        console.error('[MySports] unfollow failed', err);
      }
    },
    [unfollowAction],
  );

  const grouped = useMemo(() => {
    const groups = new Map<FollowTier, Team[]>();
    for (const tier of TIER_ORDER) groups.set(tier, []);
    for (const team of followed) groups.get(team.follow_tier)?.push(team);
    return groups;
  }, [followed]);

  return (
    <section style={sportsStyles.panel}>
      <p style={sportsStyles.eyebrow}>Teams</p>
      <h2 style={sportsStyles.title}>Follow the teams that matter to you</h2>
      <p style={sportsStyles.body}>
        Search across the NFL, NBA, MLB, NHL, and MLS. Mark die-hard vs
        casual follows and flag rivals. Notifications arrive in a later
        phase.
      </p>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search teams (e.g. Cowboys, Lakers)"
        aria-label="Search teams"
        style={searchInputStyle}
      />

      <div style={chipRowStyle}>
        <LeagueChip
          label="All leagues"
          active={leagueFilter === null}
          onClick={() => setLeagueFilter(null)}
        />
        {LAUNCH_LEAGUES.map((league) => (
          <LeagueChip
            key={league.id}
            label={league.label}
            active={leagueFilter === league.id}
            onClick={() => setLeagueFilter(league.id)}
          />
        ))}
      </div>

      {query.trim().length >= 2 ? (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Search results</h3>
          {isSearching ? (
            <p style={hintTextStyle}>Searching ESPN…</p>
          ) : error ? (
            <p style={errorTextStyle}>{error}</p>
          ) : results.length === 0 ? (
            <p style={hintTextStyle}>No teams matched that search.</p>
          ) : (
            <ul style={listStyle}>
              {results.map((result) => (
                <li key={result.id} style={rowStyle}>
                  <div>
                    <div style={teamNameStyle}>{result.name}</div>
                    <div style={teamMetaStyle}>
                      {result.league.toUpperCase()}
                      {result.conference ? ` · ${result.conference}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      followedIds.has(result.id)
                        ? handleUnfollow(result.id)
                        : handleFollow(result)
                    }
                    style={
                      followedIds.has(result.id)
                        ? followingButtonStyle
                        : followButtonStyle
                    }
                  >
                    {followedIds.has(result.id) ? 'Following' : 'Follow'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {initialRecords.length > 0 ? (
        <div style={sectionStyle}>
          <div style={stripHeaderStyle}>
            <h3 style={sectionTitleStyle}>My season records</h3>
            <Link href="/sports/standings" style={standingsLinkStyle}>
              Standings →
            </Link>
          </div>
          <div style={recordStripStyle}>
            {initialRecords.map((r) => {
              const label = r.row
                ? `${r.row.wins}-${r.row.losses}${r.row.ties > 0 ? `-${r.row.ties}` : ''}`
                : '—';
              const abbr =
                r.row?.teamAbbreviation ??
                r.teamName.split(' ').pop() ??
                r.teamName;
              return (
                <Link
                  key={r.teamId}
                  href={`/sports/team/${encodeURIComponent(r.teamId)}`}
                  style={recordPillStyle}
                >
                  <span style={recordPillAbbrStyle}>{abbr}</span>
                  <span style={recordPillValueStyle}>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          Following {followed.length > 0 ? `(${followed.length})` : ''}
        </h3>
        {followed.length === 0 ? (
          <p style={hintTextStyle}>
            You're not following any teams yet. Search above to add one.
          </p>
        ) : (
          TIER_ORDER.map((tier) => {
            const teams = grouped.get(tier) ?? [];
            if (teams.length === 0) return null;
            return (
              <div key={tier} style={tierGroupStyle}>
                <p style={tierHeaderStyle}>{TIER_LABELS[tier]}</p>
                <ul style={listStyle}>
                  {teams.map((team) => (
                    <li key={team.id} style={rowStyle}>
                      <Link
                        href={`/sports/team/${encodeURIComponent(team.id)}`}
                        style={teamLinkStyle}
                      >
                        <div style={teamNameStyle}>{team.name}</div>
                        <div style={teamMetaStyle}>
                          {team.league.toUpperCase()}
                          {team.is_rival ? ' · Rival' : ''}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function LeagueChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={active ? chipActiveStyle : chipStyle}
    >
      {label}
    </button>
  );
}

const searchInputStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 15,
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 4,
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

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 12,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
};

const hintTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 14,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  color: '#F87171',
  fontSize: 14,
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 8,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: 14,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
};

const teamLinkStyle: CSSProperties = {
  textDecoration: 'none',
  color: 'inherit',
  flex: 1,
};

const teamNameStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 700,
};

const teamMetaStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginTop: 2,
};

const tierGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const tierHeaderStyle: CSSProperties = {
  margin: '8px 0 2px',
  color: SPORTS_ACCENT,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

const followButtonStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 999,
  background: SPORTS_ACCENT,
  color: '#0E0E13',
  fontWeight: 800,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
};

const followingButtonStyle: CSSProperties = {
  ...followButtonStyle,
  background: 'transparent',
  color: SPORTS_ACCENT,
  border: `1px solid ${SPORTS_ACCENT}`,
};

const stripHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const standingsLinkStyle: CSSProperties = {
  color: SPORTS_ACCENT,
  fontWeight: 700,
  fontSize: 13,
  textDecoration: 'none',
};

const recordStripStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  paddingTop: 4,
};

const recordPillStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 88,
  padding: '10px 14px',
  borderRadius: 14,
  background: 'var(--surface)',
  border: `1px solid ${SPORTS_ACCENT}`,
  textDecoration: 'none',
};

const recordPillAbbrStyle: CSSProperties = {
  color: SPORTS_ACCENT,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
};

const recordPillValueStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 800,
  marginTop: 2,
};
