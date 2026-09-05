import { getCreateSettings } from '@mylife/create';
import { useDatabase } from '../../components/DatabaseProvider';
import { CreateScreen, CreateSettingsCard } from './_ui';

export default function CreateSettingsScreen() {
  const db = useDatabase();
  const settings = getCreateSettings(db);

  return (
    <CreateScreen
      eyebrow="Persisted Defaults"
      title="Settings"
      body="These values already live in the local MyCreate store. Later phases will turn them into editable controls."
    >
      <CreateSettingsCard
        rows={[
          { label: 'Default landing tab', value: settings.defaultLandingTab },
          {
            label: 'Default session minutes',
            value: `${settings.defaultSessionMinutes} min`,
          },
          {
            label: 'Weekly practice goal',
            value: `${settings.weeklyPracticeGoalMinutes} min`,
          },
          {
            label: 'Portfolio visibility',
            value: settings.portfolioVisibility,
          },
          {
            label: 'Reflection prompts',
            value: settings.captureReflectionPrompts ? 'Enabled' : 'Disabled',
          },
        ]}
      />
    </CreateScreen>
  );
}
