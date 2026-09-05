import { MarketMessagesScreen } from '../../screens';

export default async function MarketMessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return MarketMessagesScreen((await params).id);
}
