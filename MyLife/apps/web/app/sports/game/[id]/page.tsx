import Link from 'next/link';
import { LAUNCH_LEAGUES, type LeagueId } from '@mylife/sports';
import { sportsGetGameDetail, sportsGetGameTimeline } from '../../actions';
import { sportsStyles } from '../../_ui';
import { GameDetailClient } from './GameDetailClient';

export const dynamic = 'force-dynamic';

type Params = { id: string };
type SearchParams = Promise<{ league?: string }>;

function pickLeague(raw: string | undefined, gameId: string): LeagueId | null {
  if (raw && LAUNCH_LEAGUES.some((l) => l.id === raw)) return raw as LeagueId;
  // Fallback: compound ids carry league as `espn:{league}:{externalId}`
  const parts = gameId.split(':');
  if (parts.length === 3 && LAUNCH_LEAGUES.some((l) => l.id === parts[1])) {
    return parts[1] as LeagueId;
  }
  return null;
}

export default async function SportsGameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const gameId = decodeURIComponent(id);
  const league = pickLeague(sp.league, gameId);

  if (!league) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Game not found</p>
        <h2 style={sportsStyles.title}>Unknown league</h2>
        <p style={sportsStyles.body}>
          This game link is missing its league. Try opening it again from the
          schedule.
        </p>
        <Link href="/sports/schedule" style={sportsStyles.primaryLink}>
          Back to schedule
        </Link>
      </section>
    );
  }

  const detail = await sportsGetGameDetail(gameId, league);

  // Timeline loads in parallel once we know the status. If detail is null
  // we skip the second fetch entirely.
  const initialTimeline = detail
    ? await sportsGetGameTimeline(gameId, league, detail.status)
    : [];

  if (!detail) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Game not found</p>
        <h2 style={sportsStyles.title}>We couldn&apos;t load this game</h2>
        <p style={sportsStyles.body}>
          ESPN didn&apos;t return a box score for this matchup. It may be too
          far in the past or pre-release.
        </p>
        <Link href="/sports/schedule" style={sportsStyles.primaryLink}>
          Back to schedule
        </Link>
      </section>
    );
  }

  return (
    <GameDetailClient
      detail={detail}
      initialTimeline={initialTimeline}
      league={league}
      gameId={gameId}
    />
  );
}
