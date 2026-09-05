import { sportsGetProps } from '../../actions';
import { PropsClient } from './PropsClient';

export const dynamic = 'force-dynamic';

export default async function SportsPropsPage() {
  const initial = await sportsGetProps();
  return <PropsClient initial={initial} />;
}
