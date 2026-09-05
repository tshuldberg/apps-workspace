import { ScoreboardClient } from './ScoreboardClient';
import { sportsGetScoreboard, sportsRefreshScoreboard } from './actions';

export const dynamic = 'force-dynamic';

export default async function SportsScoresPage() {
  const initial = await sportsGetScoreboard();
  return (
    <ScoreboardClient
      initial={initial}
      refreshAction={sportsRefreshScoreboard}
    />
  );
}
