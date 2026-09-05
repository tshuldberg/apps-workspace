import { TeamsClient } from './TeamsClient';
import {
  sportsGetMyRecords,
  sportsGetTeams,
  sportsFollowTeam,
  sportsUnfollowTeam,
} from '../actions';

export const dynamic = 'force-dynamic';

export default async function SportsTeamsPage() {
  const [followed, records] = await Promise.all([
    sportsGetTeams(),
    sportsGetMyRecords(),
  ]);
  return (
    <TeamsClient
      initialFollowed={followed}
      initialRecords={records}
      followAction={sportsFollowTeam}
      unfollowAction={sportsUnfollowTeam}
    />
  );
}
