import Link from 'next/link';
import {
  fetchStandings,
  findTeamRecord,
  type Game,
  type LeagueId,
  type StandingRow,
} from '@mylife/sports';
import { sportsGetTeam, sportsGetTeamSchedule } from '../../actions';
import { sportsStyles } from '../../_ui';
import { TeamDetailClient } from './TeamDetailClient';

export const dynamic = 'force-dynamic';

type Params = { id: string };

export default async function SportsTeamDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const team = await sportsGetTeam(decodeURIComponent(id));

  if (!team) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Team not found</p>
        <h2 style={sportsStyles.title}>This team is no longer followed</h2>
        <p style={sportsStyles.body}>
          It may have been unfollowed from another device. Head back to the
          Teams tab to follow it again.
        </p>
        <Link href="/sports/teams" style={sportsStyles.primaryLink}>
          Back to teams
        </Link>
      </section>
    );
  }

  let record: StandingRow | null = null;
  try {
    const groups = await fetchStandings({ league: team.league as LeagueId });
    record = findTeamRecord(groups, team.id);
  } catch {
    // Silent fallback -- badge simply doesn't render.
  }

  let schedule: Game[] = [];
  try {
    schedule = await sportsGetTeamSchedule(team.id);
  } catch {
    // Silent fallback -- schedule section simply stays empty.
  }

  return (
    <TeamDetailClient team={team} record={record} schedule={schedule} />
  );
}
