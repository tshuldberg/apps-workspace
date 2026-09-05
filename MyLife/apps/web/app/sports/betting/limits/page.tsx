import { sportsGetBettingLimits } from '../../actions';
import { LimitsClient } from './LimitsClient';

export const dynamic = 'force-dynamic';

export default async function SportsBettingLimitsPage() {
  const initial = await sportsGetBettingLimits();
  return <LimitsClient initial={initial} />;
}
