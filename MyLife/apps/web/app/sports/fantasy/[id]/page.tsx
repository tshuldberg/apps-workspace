import { notFound } from 'next/navigation';
import { sportsGetFantasyLeague } from '../../actions';
import { LeagueDetailClient } from './LeagueDetailClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SportsFantasyLeaguePage({ params }: Props) {
  const { id } = await params;
  const data = await sportsGetFantasyLeague(decodeURIComponent(id));
  if (!data) notFound();
  return (
    <LeagueDetailClient
      league={data.league}
      transactions={data.transactions}
    />
  );
}
