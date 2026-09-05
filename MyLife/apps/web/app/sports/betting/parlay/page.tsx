import { sportsGetBettingLimits } from '../../actions';
import { ParlayClient } from './ParlayClient';

export const dynamic = 'force-dynamic';

export default async function SportsBettingParlayPage() {
  const limits = await sportsGetBettingLimits();
  return <ParlayClient limits={limits} />;
}
