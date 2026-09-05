import { MarketReviewsScreen } from '../../screens';

export default async function MarketReviewsPage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  return MarketReviewsScreen((await params).sellerId);
}
