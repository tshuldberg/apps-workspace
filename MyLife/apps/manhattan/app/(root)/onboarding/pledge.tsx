import { useRouter } from 'expo-router';
import { Button, OnboardingFeatureRow, OnboardingPage } from '@mylife/ui';
import { setSetting } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

export default function PledgeScreen() {
  const router = useRouter();
  const db = useManhattanDatabase();

  function handleAccept() {
    setSetting(db, 'onboardingComplete', 'true');
    router.replace('/(root)/(tabs)/discover');
  }

  return (
    <OnboardingPage
      icon="🗽"
      title="Your city, on your device."
      subtitle="Manhattan keeps your places, plans, and calendar completely private."
      footer={
        <Button variant="primary" title="I'm in" onPress={handleAccept} />
      }
    >
      <OnboardingFeatureRow icon="🚫" text="No data sale, ever." />
      <OnboardingFeatureRow icon="📵" text="No ads, ever." />
      <OnboardingFeatureRow
        icon="📱"
        text="Everything stays on your phone unless you choose to sync."
      />
    </OnboardingPage>
  );
}
