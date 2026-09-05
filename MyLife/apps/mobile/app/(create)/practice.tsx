import { useRouter } from 'expo-router';
import { CreateScreen } from './_ui';

export default function CreatePracticeScreen() {
  const router = useRouter();

  return (
    <CreateScreen
      eyebrow="Practice Loop"
      title="Daily Practice"
      body="Practice timers, streaks, and medium tracking are planned next. This shell already knows your default session length and weekly practice goal."
      actionLabel="Open Settings"
      onActionPress={() => router.push('/(create)/settings' as never)}
    />
  );
}
