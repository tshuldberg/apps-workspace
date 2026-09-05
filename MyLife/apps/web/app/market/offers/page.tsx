import { MarketOffersScreen } from '../screens';

export default async function MarketOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  return MarketOffersScreen(tab);
}
