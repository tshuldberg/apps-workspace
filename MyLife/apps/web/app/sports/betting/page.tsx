import { sportsGetBettingDashboard } from '../actions';
import { BettingDashboardClient } from './BettingDashboardClient';

export const dynamic = 'force-dynamic';

export default async function SportsBettingDashboardPage() {
  const initial = await sportsGetBettingDashboard();
  return <BettingDashboardClient initial={initial} />;
}
