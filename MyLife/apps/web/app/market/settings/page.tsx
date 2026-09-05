import { MarketSettingsScreen } from '../screens';

export default async function MarketSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketSettingsScreen params={await searchParams} />;
}
