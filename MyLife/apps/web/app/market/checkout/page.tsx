import { MarketCheckoutScreen } from '../screens';

export default async function MarketCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketCheckoutScreen params={await searchParams} />;
}
