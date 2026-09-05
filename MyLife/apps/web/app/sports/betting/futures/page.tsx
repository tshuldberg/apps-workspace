import { sportsGetFutures } from '../../actions';
import { FuturesClient } from './FuturesClient';

export const dynamic = 'force-dynamic';

export default async function SportsFuturesPage() {
  const initial = await sportsGetFutures();
  return <FuturesClient initial={initial} />;
}
