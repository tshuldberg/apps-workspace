import { MarketDisputeDetailScreen } from '../../screens';

export default async function MarketDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return MarketDisputeDetailScreen((await params).id);
}
