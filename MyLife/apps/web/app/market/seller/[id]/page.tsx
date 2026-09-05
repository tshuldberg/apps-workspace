import { MarketProfileScreen } from '../../screens';

export default async function MarketSellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return MarketProfileScreen((await params).id);
}
