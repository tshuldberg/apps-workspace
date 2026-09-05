import { notFound } from 'next/navigation';
import { sportsGetBet } from '../../actions';
import { BetDetailClient } from './BetDetailClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SportsBetDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await sportsGetBet(id);
  if (!result) notFound();
  return <BetDetailClient bet={result.bet} legs={result.legs} />;
}
