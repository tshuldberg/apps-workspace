import { sportsGetBettingLimits } from '../../actions';
import { LogClient } from './LogClient';

export const dynamic = 'force-dynamic';

export default async function SportsBettingLogPage() {
  const limits = await sportsGetBettingLimits();
  return <LogClient limits={limits} />;
}
