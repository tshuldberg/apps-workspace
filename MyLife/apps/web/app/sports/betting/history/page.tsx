import { sportsListBets } from '../../actions';
import { BettingHistoryClient } from './BettingHistoryClient';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function SportsBettingHistoryPage() {
  const initial = await sportsListBets({
    placedSince: Date.now() - 30 * DAY_MS,
    limit: 200,
  });
  return <BettingHistoryClient initial={initial} />;
}
