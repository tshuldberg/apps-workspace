import {
  sportsGetScoreboard,
  sportsGetUpcoming,
} from '../actions';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SportsSchedulePage() {
  const [scoreboard, games] = await Promise.all([
    sportsGetScoreboard(),
    sportsGetUpcoming().catch(() => []),
  ]);
  return (
    <ScheduleClient
      initialFollowed={scoreboard.followed}
      initialGames={games}
      refreshAction={sportsGetUpcoming}
    />
  );
}
