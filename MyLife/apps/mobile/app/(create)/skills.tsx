import { useRouter } from 'expo-router';
import { CreateScreen } from './_ui';

export default function CreateSkillsScreen() {
  const router = useRouter();

  return (
    <CreateScreen
      eyebrow="Skill Tree"
      title="Skills"
      body="Self-assessed proficiency, milestones, and practice-hour rollups will sit here once the phase-3 data model lands."
      actionLabel="Tune Defaults"
      onActionPress={() => router.push('/(create)/settings' as never)}
    />
  );
}
