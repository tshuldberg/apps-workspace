import { MarketBrowseScreen } from '../screens';

export default async function MarketBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketBrowseScreen params={await searchParams} />;
}
