import { MarketReportScreen } from '../screens';

export default async function MarketReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketReportScreen params={await searchParams} />;
}
