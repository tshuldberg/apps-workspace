import { useRouter } from 'expo-router';
import { CreateScreen } from './_ui';

export default function CreatePortfolioScreen() {
  const router = useRouter();

  return (
    <CreateScreen
      eyebrow="Private Portfolio"
      title="Portfolio"
      body="Portfolio pieces, temporary share links, and PDF export build on the private-first foundation that starts in this hidden module."
      actionLabel="Open Settings"
      onActionPress={() => router.push('/(create)/settings' as never)}
    />
  );
}
