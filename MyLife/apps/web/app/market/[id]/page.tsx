import { MarketListingScreen } from '../screens';

export default async function MarketListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return MarketListingScreen((await params).id);
}
