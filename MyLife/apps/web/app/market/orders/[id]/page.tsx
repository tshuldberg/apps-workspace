import { MarketOrderDetailScreen } from '../../screens';

export default async function MarketOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return MarketOrderDetailScreen((await params).id);
}
