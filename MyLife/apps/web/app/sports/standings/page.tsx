import { LAUNCH_LEAGUES, type LeagueId } from '@mylife/sports';
import { sportsGetStandings, sportsGetTeams } from '../actions';
import { StandingsClient } from './StandingsClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ league?: string }>;

function pickLeague(
  raw: string | undefined,
  followedLeagues: readonly string[],
): LeagueId {
  if (raw && LAUNCH_LEAGUES.some((l) => l.id === raw)) return raw as LeagueId;
  const first = followedLeagues[0];
  if (first && LAUNCH_LEAGUES.some((l) => l.id === first)) {
    return first as LeagueId;
  }
  return 'nfl';
}

export default async function SportsStandingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const followed = await sportsGetTeams();
  const league = pickLeague(
    params.league,
    followed.map((t) => t.league),
  );
  const groups = await sportsGetStandings(league);
  return (
    <StandingsClient
      initialLeague={league}
      initialGroups={groups}
      followedIds={followed.map((t) => t.id)}
      loadAction={sportsGetStandings}
    />
  );
}
