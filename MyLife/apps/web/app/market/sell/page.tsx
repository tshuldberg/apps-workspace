import { MarketSellScreen } from '../screens';

export default async function MarketSellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketSellScreen params={await searchParams} />;
}
