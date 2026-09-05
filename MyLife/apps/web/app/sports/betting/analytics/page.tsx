import { sportsGetBettingLimits, sportsListBets } from '../../actions';
import { AnalyticsClient } from './AnalyticsClient';

export const dynamic = 'force-dynamic';

export default async function SportsBettingAnalyticsPage() {
  const [bets, limits] = await Promise.all([
    sportsListBets({ limit: 500 }),
    sportsGetBettingLimits(),
  ]);
  return <AnalyticsClient bets={bets} unitSizeCents={limits.unit_size_cents} />;
}
